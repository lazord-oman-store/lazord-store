import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ImagePlus,
  Info,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { readImageFileAsUploadDataUrl } from '../lib/imageUpload';
import {
  BANK_TRANSFER_INSTRUCTION,
  OMAN_GOVERNORATES,
  ORDER_CONFIRMATION_MESSAGE,
  calculateCartTotals,
  formatCustomerOrderWhatsAppMessage,
  isProductOutOfStock,
  validateCheckoutInput,
} from '../lib/storeLogic';
import { storeRepository } from '../services/storeRepository';
import type { CartItem, Order, PromoCode, StoreSettings } from '../types/store';
import { OmrPrice } from './OmrPrice';
import { WhatsAppIcon } from './WhatsAppIcon';

interface CartCheckoutDrawerProps {
  isOpen: boolean;
  items: CartItem[];
  settings: StoreSettings;
  onClose: () => void;
  onUpdateQty: (productId: string, qty: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onTrackNewOrder: (trackingNumber: string) => void;
}

type DrawerStep = 'cart' | 'checkout' | 'confirmation';

export function CartCheckoutDrawer({
  isOpen,
  items,
  settings,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onTrackNewOrder,
}: CartCheckoutDrawerProps) {
  const [step, setStep] = useState<DrawerStep>('cart');

  // Promo state
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Checkout customer & receipt state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [receiptImageUrl, setReceiptImageUrl] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Copy states
  const [copiedBank, setCopiedBank] = useState(false);
  const [copiedOrderNum, setCopiedOrderNum] = useState(false);
  const [copiedTrackingNum, setCopiedTrackingNum] = useState(false);
  const [copiedOrderMessage, setCopiedOrderMessage] = useState(false);
  const [whatsappCopyNotice, setWhatsappCopyNotice] = useState(false);

  // Confirmation state
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [showTrackingReminder, setShowTrackingReminder] = useState(false);

  const totals = useMemo(
    () => calculateCartTotals(items, appliedPromo),
    [items, appliedPromo]
  );

  const hasOutOfStockItem = useMemo(
    () => items.some((item) => isProductOutOfStock(item.product)),
    [items]
  );

  const orderWhatsAppMessage = useMemo(
    () => (confirmedOrder ? formatCustomerOrderWhatsAppMessage(confirmedOrder) : ''),
    [confirmedOrder]
  );

  useEffect(() => {
    if (!isOpen || step !== 'confirmation' || !confirmedOrder) {
      setShowTrackingReminder(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowTrackingReminder(true);
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen, step, confirmedOrder]);

  if (!isOpen) return null;

  const fallbackCopyToClipboard = (value: string): boolean => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  };

  const copyTextReliable = (value: string, onDone?: () => void): void => {
    const syncCopied = fallbackCopyToClipboard(value);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard
        .writeText(value)
        .then(() => {
          onDone?.();
        })
        .catch(() => {
          if (syncCopied) {
            onDone?.();
          }
        });
      if (syncCopied) {
        onDone?.();
      }
      return;
    }
    if (syncCopied) {
      onDone?.();
    }
  };

  const copyText = (value: string, setter: (v: boolean) => void) => {
    copyTextReliable(value, () => {
      setter(true);
      setTimeout(() => setter(false), 2400);
    });
  };

  const handleApplyPromo = async () => {
    const trimmed = promoInput.trim();
    if (!trimmed) {
      setPromoError('يرجى إدخال كود الخصم.');
      return;
    }
    setPromoLoading(true);
    setPromoError(null);
    try {
      const res = await storeRepository.validatePromoCode(
        trimmed,
        items.map((item) => ({ productId: item.product.id, quantity: item.quantity }))
      );
      setAppliedPromo(res.promo);
    } catch (err) {
      setAppliedPromo(null);
      setPromoError(err instanceof Error ? err.message : 'كود الخصم غير صالح.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  };

  const handleReceiptFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCheckoutError(null);
    setUploadingReceipt(true);
    try {
      const dataUrl = await readImageFileAsUploadDataUrl(file);
      const uploadedUrl = await storeRepository.uploadImage(dataUrl);
      setReceiptImageUrl(uploadedUrl);
    } catch (err) {
      setReceiptImageUrl('');
      setCheckoutError(
        err instanceof Error ? err.message : 'تعذر رفع صورة الإيصال، حاول مرة أخرى.'
      );
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmitOrder = async (e: FormEvent) => {
    e.preventDefault();
    if (hasOutOfStockItem) {
      setCheckoutError('عذراً، يحتوي طلبك على منتج نفذت كميته حالياً. يرجى إزالته أولاً.');
      return;
    }
    const validationError = validateCheckoutInput({
      customerName,
      customerPhone,
      city,
      address,
      receiptImageUrl,
      itemCount: items.length,
    });
    if (validationError) {
      setCheckoutError(validationError);
      return;
    }

    setSubmittingOrder(true);
    setCheckoutError(null);
    try {
      const created = await storeRepository.submitOrder({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        city: city.trim(),
        address: address.trim(),
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity })),
        promoCode: totals.appliedCode,
        receiptImageUrl,
      });

      setShowTrackingReminder(false);
      setConfirmedOrder(created);
      onClearCart();
      setAppliedPromo(null);
      setPromoInput('');
      setCustomerName('');
      setCustomerPhone('');
      setCity('');
      setAddress('');
      setReceiptImageUrl('');
      setStep('confirmation');
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'تعذر إرسال الطلب، يرجى المحاولة مرة أخرى.'
      );
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleDrawerClose = () => {
    setShowTrackingReminder(false);
    if (step === 'confirmation') {
      setStep('cart');
      setConfirmedOrder(null);
      setCopiedOrderMessage(false);
      setWhatsappCopyNotice(false);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/55 backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg bg-[#FAF8F4] h-full shadow-2xl flex flex-col border-s border-[#DFD6C3]">
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-[#141311] text-[#FAF8F4] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {step === 'checkout' && (
              <button
                type="button"
                onClick={() => setStep('cart')}
                aria-label="العودة إلى سلة التسوق"
                className="p-1.5 rounded-lg text-[#CFC7B8] hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
            <h2 id="cart-drawer-title" className="font-editorial text-xl font-bold">
              {step === 'cart' && 'سلة التسوق'}
              {step === 'checkout' && 'إتمام الطلب والتحويل البنكي'}
              {step === 'confirmation' && 'تم استلام طلبك بنجاح'}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleDrawerClose}
            aria-label="إغلاق السلة"
            className="p-2 rounded-lg text-[#CFC7B8] hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'cart' && (
            <div className="space-y-6">
              {items.length === 0 ? (
                <div className="py-16 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-[#EFE9DC] flex items-center justify-center">
                    <ShoppingBag className="w-6 h-6 text-[#8E6F2D]" aria-hidden="true" />
                  </div>
                  <p className="text-base font-medium text-[#181715]">سلة التسوق فارغة حالياً</p>
                  <p className="text-sm text-[#615B52]">
                    أضف عطورك وبخورك المفضل من المجموعة للبدء في الطلب.
                  </p>
                </div>
              ) : (
                <>
                  {/* Items List */}
                  {hasOutOfStockItem && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm font-medium text-red-800"
                    >
                      يوجد منتج في سلتك «نفذت الكميه» حالياً. يرجى إزالته لتتمكن من إتمام الطلب.
                    </div>
                  )}

                  <ul className="space-y-3">
                    {items.map((item) => {
                      const itemOutOfStock = isProductOutOfStock(item.product);
                      return (
                      <li
                        key={item.product.id}
                        className={`bg-white border rounded-xl p-4 flex gap-4 items-center ${
                          itemOutOfStock ? 'border-red-300 bg-red-50/40' : 'border-[#E7E0D2]'
                        }`}
                      >
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.nameAr}
                          referrerPolicy="no-referrer"
                          className="w-16 h-16 rounded-lg object-cover bg-[#F2EDE3] shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-[#181715] truncate">
                            {item.product.nameAr}
                          </h3>
                          <p className="text-xs text-[#615B52] mt-0.5">{item.product.sizeLabel}</p>
                          {itemOutOfStock && (
                            <p className="text-xs font-bold text-red-700 mt-1">نفذت الكميه</p>
                          )}
                          <p className="text-sm font-semibold text-[#8E6F2D] mt-1">
                            <OmrPrice amount={item.product.priceOmr * item.quantity} />
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.product.id)}
                            aria-label={`إزالة ${item.product.nameAr}`}
                            className="p-1.5 text-[#7A7367] hover:text-red-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>

                          <div className="inline-flex items-center border border-[#DFD6C3] rounded-lg bg-[#FAF8F4]">
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.product.id, item.quantity - 1)}
                              aria-label={`إنقاص كمية ${item.product.nameAr}`}
                              className="p-1.5 text-[#181715] hover:bg-[#EFE9DC] rounded-s-lg cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                            <span className="px-2.5 text-xs font-mono font-semibold tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.product.id, item.quantity + 1)}
                              aria-label={`زيادة كمية ${item.product.nameAr}`}
                              className="p-1.5 text-[#181715] hover:bg-[#EFE9DC] rounded-e-lg cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </li>
                      );
                    })}
                  </ul>

                  {/* Promo Code Section */}
                  <div className="bg-white border border-[#E7E0D2] rounded-xl p-4 space-y-3">
                    <label
                      htmlFor="promo-code-input"
                      className="block text-sm font-medium text-[#181715]"
                    >
                      كود الخصم (اختياري)
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="promo-code-input"
                        type="text"
                        dir="ltr"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        placeholder=""
                        className="flex-1 px-3.5 py-2 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm font-mono uppercase text-[#181715] focus:outline-none focus:border-[#8E6F2D]"
                      />
                      {appliedPromo ? (
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          className="px-4 py-2 min-h-[42px] text-xs font-medium bg-[#EFE9DC] hover:bg-[#E2D9C5] text-[#181715] rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          إلغاء الكود
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          disabled={promoLoading}
                          className="px-4 py-2 min-h-[42px] text-xs font-medium bg-[#141311] hover:bg-[#8E6F2D] disabled:opacity-60 text-[#FAF8F4] rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          {promoLoading ? 'تحقق...' : 'تطبيق الكود'}
                        </button>
                      )}
                    </div>

                    {promoError && (
                      <p role="alert" className="text-xs text-red-700">
                        {promoError}
                      </p>
                    )}

                    {appliedPromo && (
                      <p className="text-xs font-medium text-[#15803D]">
                        تم تطبيق كود الخصم ({appliedPromo.code}) بنجاح.
                      </p>
                    )}
                  </div>

                  {/* Order Totals Breakdown */}
                  <div className="bg-white border border-[#E7E0D2] rounded-xl p-4 space-y-2.5 text-sm">
                    <div className="flex items-center justify-between text-[#575148]">
                      <span>السعر الأصلي</span>
                      <OmrPrice amount={totals.originalSubtotal} />
                    </div>

                    {totals.discountAmount > 0 && (
                      <div className="flex items-center justify-between text-[#15803D]">
                        <span>قيمة الخصم ({totals.appliedCode})</span>
                        <OmrPrice amount={totals.discountAmount} prefix="-" />
                      </div>
                    )}

                    <div className="pt-2.5 border-t border-[#EFE9DC] flex items-center justify-between text-base font-bold text-[#181715]">
                      <span>السعر النهائي بعد الخصم</span>
                      <span data-testid="cart-final-total" className="text-[#8E6F2D]">
                        <OmrPrice amount={totals.finalTotal} />
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 'checkout' && (
            <form id="checkout-form" onSubmit={handleSubmitOrder} className="space-y-5">
              {/* Bank Transfer Payment Instructions Box */}
              <div className="bg-[#141311] text-[#FAF8F4] rounded-xl p-5 space-y-4 border border-[#2D2923]">
                <p className="text-sm sm:text-base font-semibold leading-relaxed text-[#D4B774]">
                  {BANK_TRANSFER_INSTRUCTION}
                </p>

                <div className="bg-[#1E1C19] border border-[#342F27] rounded-lg p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-[#B5AEA0]">{settings.bankAccountLabel}</p>
                    <p
                      dir="ltr"
                      data-testid="bank-phone-display"
                      className="inline-block text-lg font-mono font-bold text-[#FAF8F4] tracking-wider tabular-nums mt-0.5"
                    >
                      {settings.bankPhoneNumber}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => copyText(settings.bankPhoneNumber, setCopiedBank)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-[#B59449] hover:bg-[#C6A558] text-[#141311] text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedBank ? (
                      <>
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>نسخ الرقم</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-[#CFC7B8] pt-1">
                  <span>المبلغ المطلوب تحويله</span>
                  <span className="font-bold text-sm text-[#D4B774]">
                    <OmrPrice amount={totals.finalTotal} />
                  </span>
                </div>
              </div>

              {/* Customer Delivery Fields */}
              <div className="bg-white border border-[#E7E0D2] rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-[#181715]">بيانات العميل والتوصيل</h3>

                <div>
                  <label htmlFor="customer-name" className="block text-xs font-medium text-[#4F4A42] mb-1.5">
                    الاسم الكامل *
                  </label>
                  <input
                    id="customer-name"
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="مثال: أحمد بن سالم الحارثي"
                    className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm text-[#181715] focus:outline-none focus:border-[#8E6F2D]"
                  />
                </div>

                <div>
                  <label htmlFor="customer-phone" className="block text-xs font-medium text-[#4F4A42] mb-1.5">
                    رقم الهاتف (واتساب) *
                  </label>
                  <input
                    id="customer-phone"
                    type="tel"
                    dir="ltr"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="9XXXXXXX"
                    className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm font-mono text-[#181715] focus:outline-none focus:border-[#8E6F2D]"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="customer-city" className="block text-xs font-medium text-[#4F4A42] mb-1.5">
                      المحافظة (سلطنة عُمان) *
                    </label>
                    <select
                      id="customer-city"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm text-[#181715] focus:outline-none focus:border-[#8E6F2D]"
                    >
                      <option value="">اختر المحافظة...</option>
                      {OMAN_GOVERNORATES.map((gov) => (
                        <option key={gov} value={gov}>
                          {gov}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="customer-address" className="block text-xs font-medium text-[#4F4A42] mb-1.5">
                      الولاية والمنطقة وتفاصيل العنوان *
                    </label>
                    <input
                      id="customer-address"
                      type="text"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="الولاية، المنطقة، الشارع، رقم المنزل"
                      className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm text-[#181715] focus:outline-none focus:border-[#8E6F2D]"
                    />
                  </div>
                </div>
              </div>

              {/* Required Receipt Image Upload */}
              <div className="bg-white border border-[#E7E0D2] rounded-xl p-5 space-y-3">
                <label
                  htmlFor="receipt-upload-input"
                  className="block text-sm font-semibold text-[#181715]"
                >
                  صورة إيصال التحويل *
                </label>
                <p className="text-xs text-[#615B52]">
                  ارفع لقطة شاشة أو صورة إيصال التحويل البنكي لتأكيد طلبك.
                </p>

                <label
                  htmlFor="receipt-upload-input"
                  className="flex flex-col items-center justify-center gap-2 p-5 border border-dashed border-[#B59449] rounded-xl bg-[#FAF8F4] hover:bg-[#F2EDE3] transition-colors cursor-pointer text-center"
                >
                  <ImagePlus className="w-6 h-6 text-[#8E6F2D]" aria-hidden="true" />
                  <span className="text-sm font-medium text-[#181715]">
                    {uploadingReceipt
                      ? 'جاري رفع صورة الإيصال...'
                      : receiptImageUrl
                        ? 'تم إرفاق الإيصال بنجاح (اضغط للتغيير)'
                        : 'اختر صورة إيصال التحويل (PNG / JPG)'}
                  </span>
                </label>
                <input
                  id="receipt-upload-input"
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptFileChange}
                  className="sr-only"
                />

                {receiptImageUrl && (
                  <div className="pt-2">
                    <img
                      src={receiptImageUrl}
                      alt="معاينة إيصال التحويل البنكي"
                      className="w-full max-h-48 object-contain rounded-lg border border-[#E7E0D2] bg-[#FAF8F4]"
                    />
                  </div>
                )}
              </div>

              {checkoutError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
                >
                  {checkoutError}
                </div>
              )}
            </form>
          )}

          {step === 'confirmation' && confirmedOrder && (
            <div data-testid="order-confirmation" className="space-y-6 py-2">
              <div className="bg-white border border-[#E7E0D2] rounded-xl p-6 text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-[#15803D]" aria-hidden="true" />
                </div>

                <p className="text-base sm:text-lg font-semibold leading-relaxed text-[#181715]">
                  {ORDER_CONFIRMATION_MESSAGE}
                </p>
              </div>

              {/* Strictly Separated Order Number & Tracking Number Copyable Boxes */}
              <div className="space-y-3">
                <div className="bg-white border border-[#E7E0D2] rounded-xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#615B52]">رقم الطلب</p>
                    <p
                      dir="ltr"
                      data-testid="confirmed-order-number"
                      className="inline-block text-lg font-mono font-bold text-[#181715] tabular-nums mt-0.5"
                    >
                      {confirmedOrder.orderNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(confirmedOrder.orderNumber, setCopiedOrderNum)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-[#EFE9DC] hover:bg-[#E2D9C5] text-[#181715] text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    {copiedOrderNum ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>نسخ رقم الطلب</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-[#141311] text-[#FAF8F4] border border-[#2D2923] rounded-xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#CFC7B8]">رقم التتبع</p>
                    <p
                      dir="ltr"
                      data-testid="confirmed-tracking-number"
                      className="inline-block text-lg font-mono font-bold text-[#D4B774] tabular-nums mt-0.5"
                    >
                      {confirmedOrder.trackingNumber}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(confirmedOrder.trackingNumber, setCopiedTrackingNum)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-[#B59449] hover:bg-[#C6A558] text-[#141311] text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    {copiedTrackingNum ? (
                      <>
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>تم النسخ</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>نسخ رقم التتبع</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div
                  data-testid="confirm-whatsapp-info"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 min-h-[48px] bg-[#15803D] text-white text-sm sm:text-base font-bold rounded-lg shadow-sm text-center select-text"
                >
                  <WhatsAppIcon className="w-4 h-4 shrink-0" />
                  <span>قم بنسخ تفاصيل طلبك وارسلها عبر الرقم 79115527</span>
                </div>

                {whatsappCopyNotice && (
                  <div
                    role="status"
                    data-testid="whatsapp-copy-notice"
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-xs sm:text-sm font-semibold text-emerald-900 text-center"
                  >
                    تم نسخ تفاصيل طلبك، قم بلصقها في محادثة الواتساب
                  </div>
                )}

                <div className="bg-white border border-[#E7E0D2] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#181715]">نص تفاصيل الطلب للواتساب</p>
                    <button
                      type="button"
                      data-testid="copy-order-message-btn"
                      onClick={() =>
                        copyText(orderWhatsAppMessage, (copied) => {
                          setCopiedOrderMessage(copied);
                          if (copied) setWhatsappCopyNotice(true);
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] bg-[#EFE9DC] hover:bg-[#E2D9C5] text-[#181715] text-xs font-medium rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      {copiedOrderMessage ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#15803D]" aria-hidden="true" />
                          <span>تم النسخ</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>نسخ نص الطلب</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div
                    dir="rtl"
                    data-testid="order-whatsapp-message-preview"
                    className="p-3 rounded-lg bg-[#FAF8F4] border border-[#EAE3D5] text-xs sm:text-sm text-[#181715] text-start whitespace-pre-line font-sans leading-relaxed select-all"
                  >
                    {orderWhatsAppMessage}
                  </div>
                </div>

                <p className="text-xs text-center text-[#615B52]">
                  انسخ تفاصيل الطلب من الزر أعلاه وأرسلها عبر الواتساب إلى الرقم 79115527.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    const trk = confirmedOrder.trackingNumber;
                    handleDrawerClose();
                    onTrackNewOrder(trk);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] bg-white border border-[#D7CCB8] hover:bg-[#F2EDE3] text-[#181715] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <span>تتبع حالة الطلب الآن</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer CTA */}
        {step === 'cart' && items.length > 0 && (
          <div className="p-6 bg-white border-t border-[#E7E0D2] shrink-0">
            <button
              type="button"
              disabled={hasOutOfStockItem}
              onClick={() => {
                setCheckoutError(null);
                setStep('checkout');
              }}
              className="w-full py-3.5 px-6 min-h-[46px] bg-[#141311] hover:bg-[#8E6F2D] disabled:opacity-50 disabled:cursor-not-allowed text-[#FAF8F4] text-sm sm:text-base font-semibold rounded-lg transition-colors cursor-pointer"
            >
              إتمام الطلب والدفع بالتحويل البنكي
            </button>
          </div>
        )}

        {step === 'checkout' && (
          <div className="p-6 bg-white border-t border-[#E7E0D2] shrink-0">
            <button
              type="submit"
              form="checkout-form"
              disabled={submittingOrder || uploadingReceipt || hasOutOfStockItem}
              className="w-full py-3.5 px-6 min-h-[46px] bg-[#B59449] hover:bg-[#9E7E38] disabled:opacity-60 disabled:cursor-not-allowed text-[#141311] text-sm sm:text-base font-bold rounded-lg transition-colors cursor-pointer"
            >
              {submittingOrder ? 'جاري تأكيد وإرسال الطلب...' : 'تأكيد الطلب وإرسال الإيصال'}
            </button>
          </div>
        )}

        {step === 'confirmation' && showTrackingReminder && (
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="tracking-reminder-title"
            data-testid="tracking-reminder-modal"
            className="absolute inset-0 z-20 flex items-center justify-center p-5 bg-black/55 backdrop-blur-[2px]"
          >
            <div className="w-full max-w-sm bg-[#FAF8F4] border border-[#D7CCB8] rounded-2xl shadow-2xl p-6 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#EFE9DC] border border-[#D7CCB8] flex items-center justify-center">
                <Info className="w-6 h-6 text-[#8E6F2D]" aria-hidden="true" />
              </div>

              <div className="space-y-2">
                <h3
                  id="tracking-reminder-title"
                  className="font-editorial text-lg font-bold text-[#181715]"
                >
                  تذكير بنسخ رقم التتبع
                </h3>
                <p className="text-sm leading-relaxed text-[#4F4A42]">
                  يرجى نسخ رقم التتبع الخاص بطلبك لتتمكن من معرفة حالة طلبك ومتابعته في أي وقت.
                </p>
              </div>

              <button
                type="button"
                data-testid="tracking-reminder-ok-btn"
                onClick={() => setShowTrackingReminder(false)}
                className="w-full py-3 px-5 min-h-[44px] bg-[#141311] hover:bg-[#8E6F2D] text-[#FAF8F4] text-sm font-bold rounded-lg transition-colors cursor-pointer"
              >
                حسناً
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
