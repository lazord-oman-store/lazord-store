import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  Bell,
  Check,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Package,
  Plus,
  Receipt,
  Settings,
  Tag,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  collectOrderIdSet,
  detectNewPendingOrders,
  formatPendingAlertHeadline,
  shouldPlayOrderChime,
} from '../lib/adminAlertLogic';
import { playOrderChime, unlockOrderAudioContext } from '../lib/soundChime';
import { readImageFileAsUploadDataUrl } from '../lib/imageUpload';
import {
  formatOmr,
  getCategoryLabelAr,
} from '../lib/storeLogic';
import { storeRepository, UnauthorizedError } from '../services/storeRepository';
import { BrandLogo } from './BrandLogo';
import { OmrPrice } from './OmrPrice';
import {
  ORDER_STATUS_LIST,
  type AdminDashboardData,
  type DiscountType,
  type Order,
  type OrderStatus,
  type Product,
  type ProductCategory,
} from '../types/store';

interface AdminDashboardProps {
  onLogout: () => void;
  onUnauthorized: () => void;
  onExitToStore: () => void;
  onStorefrontUpdated: () => void;
}

type AdminTab = 'orders' | 'products' | 'promos' | 'settings';

const SOUND_MUTE_STORAGE_KEY = 'lazord_admin_sound_muted';
const ADMIN_POLL_INTERVAL_MS = 10000;

function readInitialSoundMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SOUND_MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function AdminDashboard({
  onLogout,
  onUnauthorized,
  onExitToStore,
  onStorefrontUpdated,
}: AdminDashboardProps) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('orders');
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending'>('all');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [soundMuted, setSoundMuted] = useState<boolean>(() => readInitialSoundMuted());
  const [latestIncomingOrderNumber, setLatestIncomingOrderNumber] = useState<string | null>(null);

  const knownOrderIdsRef = useRef<Set<string> | null>(null);
  const soundMutedRef = useRef(soundMuted);
  soundMutedRef.current = soundMuted;

  // Receipt image modal
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // Product form state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState<ProductCategory>('perfume');
  const [prodNotes, setProdNotes] = useState('');
  const [prodSize, setProdSize] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodImage, setProdImage] = useState('');
  const [prodOutOfStock, setProdOutOfStock] = useState(false);
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);

  // Promo form state
  const [promoCode, setPromoCode] = useState('');
  const [promoType, setPromoType] = useState<DiscountType>('percentage');
  const [promoValue, setPromoValue] = useState('');
  const [savingPromo, setSavingPromo] = useState(false);

  // Store settings form state
  const [bankPhone, setBankPhone] = useState('');
  const [bankLabel, setBankLabel] = useState('');
  const [whatsappNum, setWhatsappNum] = useState('');
  const [brandBio, setBrandBio] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Admin password change form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const handleAdminError = useCallback(
    (err: unknown, fallbackMessage: string) => {
      if (err instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      setError(err instanceof Error ? err.message : fallbackMessage);
    },
    [onUnauthorized]
  );

  const loadDashboard = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = Boolean(options?.silent);
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await storeRepository.getAdminDashboard();
        const newlyArrived = detectNewPendingOrders(knownOrderIdsRef.current, res.orders);
        knownOrderIdsRef.current = collectOrderIdSet(res.orders);

        setData(res);
        if (!silent) {
          setBankPhone(res.settings.bankPhoneNumber);
          setBankLabel(res.settings.bankAccountLabel);
          setWhatsappNum(res.settings.whatsappNumber);
          setBrandBio(res.settings.brandBio);
        }

        if (newlyArrived.length > 0) {
          setLatestIncomingOrderNumber(newlyArrived[0].orderNumber);
          if (
            shouldPlayOrderChime({
              soundMuted: soundMutedRef.current,
              newPendingCount: newlyArrived.length,
            })
          ) {
            void playOrderChime();
          }
        }
      } catch (err) {
        if (!silent || err instanceof UnauthorizedError) {
          handleAdminError(err, 'تعذر تحميل بيانات لوحة التحكم.');
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [handleAdminError]
  );

  useEffect(() => {
    void loadDashboard({ silent: false });
  }, [loadDashboard]);

  // Periodically check for newly arrived orders while dashboard is open
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadDashboard({ silent: true });
      }
    }, ADMIN_POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadDashboard({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadDashboard]);

  // Unlock browser AudioContext cleanly on the owner's first pointer/keyboard gesture
  useEffect(() => {
    if (soundMuted) return;
    const unlockOnGesture = () => {
      void unlockOrderAudioContext();
    };
    window.addEventListener('pointerdown', unlockOnGesture, { once: true, passive: true });
    window.addEventListener('keydown', unlockOnGesture, { once: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
    };
  }, [soundMuted]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleToggleSound = () => {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    soundMutedRef.current = nextMuted;
    try {
      window.localStorage.setItem(SOUND_MUTE_STORAGE_KEY, nextMuted ? '1' : '0');
    } catch {
      // ignore storage restrictions
    }
    if (!nextMuted) {
      void playOrderChime({ fromUserGesture: true });
    }
  };

  const handleJumpToPendingOrders = () => {
    setActiveTab('orders');
    setOrderFilter('pending');
    window.requestAnimationFrame(() => {
      document.getElementById('admin-orders-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    try {
      const res = await storeRepository.updateOrderStatus(orderId, status);
      setData((prev) =>
        prev
          ? {
              ...prev,
              analytics: res.analytics,
              orders: prev.orders.map((o) => (o.id === orderId ? res.order : o)),
            }
          : prev
      );
      showToast(`تم تحديث حالة الطلب ${res.order.orderNumber} إلى "${status}"`);
    } catch (err) {
      handleAdminError(err, 'تعذر تحديث حالة الطلب.');
    }
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setProdName('');
    setProdCategory('perfume');
    setProdNotes('');
    setProdSize('');
    setProdPrice('');
    setProdImage('');
    setProdOutOfStock(false);
  };

  const startEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProdName(product.nameAr);
    setProdCategory(product.category);
    setProdNotes(product.notesAr);
    setProdSize(product.sizeLabel);
    setProdPrice(String(product.priceOmr));
    setProdImage(product.imageUrl);
    setProdOutOfStock(Boolean(product.outOfStock));
  };

  const handleProductImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploadingProductImage(true);
    setError(null);
    try {
      const dataUrl = await readImageFileAsUploadDataUrl(file);
      const url = await storeRepository.uploadImage(dataUrl);
      setProdImage(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر رفع صورة المنتج.');
    } finally {
      setUploadingProductImage(false);
      input.value = '';
    }
  };

  const handleSaveProduct = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    setError(null);
    try {
      const priceNum = Number(prodPrice);
      if (editingProduct) {
        const updated = await storeRepository.updateProduct(editingProduct.id, {
          nameAr: prodName,
          category: prodCategory,
          notesAr: prodNotes,
          sizeLabel: prodSize,
          priceOmr: priceNum,
          imageUrl: prodImage,
          outOfStock: prodOutOfStock,
        });
        setData((prev) =>
          prev
            ? {
                ...prev,
                products: prev.products.map((p) => (p.id === updated.id ? updated : p)),
              }
            : prev
        );
        showToast(`تم تحديث المنتج "${updated.nameAr}" بنجاح.`);
      } else {
        const created = await storeRepository.createProduct({
          nameAr: prodName,
          category: prodCategory,
          notesAr: prodNotes,
          sizeLabel: prodSize || (prodCategory === 'perfume' ? '100 مل · Eau de Parfum' : '60 جم'),
          priceOmr: priceNum,
          imageUrl: prodImage,
          outOfStock: prodOutOfStock,
        });
        setData((prev) =>
          prev ? { ...prev, products: [created, ...prev.products] } : prev
        );
        showToast(`تمت إضافة "${created.nameAr}" إلى المتجر.`);
      }
      resetProductForm();
      onStorefrontUpdated();
    } catch (err) {
      handleAdminError(err, 'تعذر حفظ المنتج.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleToggleProductStock = async (product: Product) => {
    const nextOutOfStock = !Boolean(product.outOfStock);
    try {
      const updated = await storeRepository.updateProduct(product.id, {
        outOfStock: nextOutOfStock,
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              products: prev.products.map((p) => (p.id === updated.id ? updated : p)),
            }
          : prev
      );
      if (editingProduct?.id === updated.id) {
        setEditingProduct(updated);
        setProdOutOfStock(Boolean(updated.outOfStock));
      }
      onStorefrontUpdated();
      showToast(
        nextOutOfStock
          ? `تم تحديد "${updated.nameAr}" كـ نفذت الكميه.`
          : `تمت إعادة "${updated.nameAr}" إلى متوفر.`
      );
    } catch (err) {
      handleAdminError(err, 'تعذر تحديث حالة توفر المنتج.');
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    try {
      await storeRepository.deleteProduct(product.id);
      setData((prev) =>
        prev
          ? { ...prev, products: prev.products.filter((p) => p.id !== product.id) }
          : prev
      );
      if (editingProduct?.id === product.id) {
        resetProductForm();
      }
      onStorefrontUpdated();
      showToast(`تم حذف "${product.nameAr}".`);
    } catch (err) {
      handleAdminError(err, 'تعذر حذف المنتج.');
    }
  };

  const handleCreatePromo = async (e: FormEvent) => {
    e.preventDefault();
    setSavingPromo(true);
    setError(null);
    try {
      const created = await storeRepository.createPromoCode({
        code: promoCode,
        discountType: promoType,
        value: Number(promoValue),
        active: true,
      });
      setData((prev) =>
        prev ? { ...prev, promoCodes: [created, ...prev.promoCodes] } : prev
      );
      setPromoCode('');
      setPromoValue('');
      showToast(`تم إنشاء كود الخصم ${created.code}`);
    } catch (err) {
      handleAdminError(err, 'تعذر إنشاء كود الخصم.');
    } finally {
      setSavingPromo(false);
    }
  };

  const handleTogglePromo = async (id: string, currentActive: boolean) => {
    try {
      const updated = await storeRepository.togglePromoCode(id, !currentActive);
      setData((prev) =>
        prev
          ? {
              ...prev,
              promoCodes: prev.promoCodes.map((p) => (p.id === id ? updated : p)),
            }
          : prev
      );
    } catch (err) {
      handleAdminError(err, 'تعذر تحديث حالة الكود.');
    }
  };

  const handleDeletePromo = async (id: string) => {
    try {
      await storeRepository.deletePromoCode(id);
      setData((prev) =>
        prev ? { ...prev, promoCodes: prev.promoCodes.filter((p) => p.id !== id) } : prev
      );
      showToast('تم حذف كود الخصم.');
    } catch (err) {
      handleAdminError(err, 'تعذر حذف كود الخصم.');
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setError(null);
    try {
      const updated = await storeRepository.updateSettings({
        bankPhoneNumber: bankPhone,
        bankAccountLabel: bankLabel,
        whatsappNumber: whatsappNum,
        brandBio,
      });
      setData((prev) => (prev ? { ...prev, settings: updated } : prev));
      onStorefrontUpdated();
      showToast('تم حفظ إعدادات المتجر والدفع بنجاح.');
    } catch (err) {
      handleAdminError(err, 'تعذر حفظ الإعدادات.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    const cleanCurrent = currentPassword.trim();
    const cleanNew = newPassword.trim();
    const cleanConfirm = confirmPassword.trim();

    if (!cleanCurrent) {
      setPasswordError('يرجى إدخال كلمة المرور الحالية.');
      return;
    }
    if (cleanNew.length < 6) {
      setPasswordError('يجب أن لا تقل كلمة المرور الجديدة عن 6 أحرف.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setPasswordError('كلمة المرور الجديدة وتأكيدها غير متطابقتين.');
      return;
    }

    setSavingPassword(true);
    try {
      await storeRepository.changeOwnerPassword({
        currentPassword: cleanCurrent,
        newPassword: cleanNew,
        confirmPassword: cleanConfirm,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setPasswordSuccess('تم تحديث كلمة المرور بنجاح وحفظها في النظام بشكل مشفر.');
      showToast('تم تغيير كلمة مرور لوحة التحكم بنجاح.');
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      setPasswordError(err instanceof Error ? err.message : 'تعذر تحديث كلمة المرور.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogoutClick = async () => {
    await storeRepository.logoutOwner();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#181715]">
      {/* Protected Dashboard Header */}
      <header className="sticky top-0 z-30 bg-[#141311] text-[#FAF8F4] border-b border-[#2D2923]">
        <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo
              variant="dark"
              className="w-14 h-14 shrink-0"
              imgClassName="scale-[1.08]"
            />
            <span className="font-editorial text-xl font-bold text-[#D4B774] whitespace-nowrap">
              لوحة تحكم صاحب البراند
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleToggleSound}
              aria-pressed={!soundMuted}
              aria-label={soundMuted ? 'التنبيه الصوتي: مكتوم' : 'التنبيه الصوتي: مفعّل'}
              data-testid="sound-alert-toggle"
              title={soundMuted ? 'تفعيل التنبيه الصوتي للطلبات الجديدة' : 'كتم التنبيه الصوتي'}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                soundMuted
                  ? 'border-[#383229] text-[#A8A092] hover:text-white'
                  : 'border-[#B59449]/60 bg-[#B59449]/15 text-[#E5C983] hover:bg-[#B59449]/25'
              }`}
            >
              {soundMuted ? (
                <VolumeX className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Volume2 className="w-4 h-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {soundMuted ? 'التنبيه الصوتي: مكتوم' : 'التنبيه الصوتي: مفعّل'}
              </span>
            </button>
            <button
              type="button"
              onClick={onExitToStore}
              className="px-3.5 py-2 min-h-[40px] text-xs sm:text-sm font-medium text-[#DFD6C3] hover:text-white border border-[#383229] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              معاينة المتجر
            </button>
            <button
              type="button"
              onClick={handleLogoutClick}
              data-testid="owner-logout-btn"
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs sm:text-sm font-semibold bg-[#B59449] hover:bg-[#C6A558] text-[#141311] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {feedback && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-emerald-900"
          >
            {feedback}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-red-900"
          >
            {error}
          </div>
        )}

        {loading || !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="h-28 rounded-xl bg-white border border-[#E7E0D2] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Top Pending/Unreviewed Orders Alert Banner */}
            {data.analytics.pendingOrders > 0 && (
              <section
                role="region"
                aria-label="تنبيه الطلبات الجديدة قيد المراجعة"
                data-testid="top-pending-orders-banner"
                className="bg-[#141311] text-[#FAF8F4] border border-[#B59449] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-[#B59449]/20 border border-[#B59449]/40 flex items-center justify-center shrink-0">
                    <Bell className="w-5 h-5 text-[#E5C983]" aria-hidden="true" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-sm sm:text-base font-bold text-[#FAF8F4]">
                      {formatPendingAlertHeadline(data.analytics.pendingOrders)}
                    </p>
                    <p className="text-xs text-[#CFC7B8]">
                      الطلبات الجديدة / قيد المراجعة:{' '}
                      <span
                        data-testid="top-banner-pending-count"
                        className="font-mono font-bold text-[#E5C983] tabular-nums"
                      >
                        {data.analytics.pendingOrders}
                      </span>
                      {latestIncomingOrderNumber && (
                        <>
                          {' '}
                          <span aria-hidden="true">·</span> أحدث طلب وارد:{' '}
                          <span className="font-mono font-semibold text-[#E5C983] tabular-nums">
                            {latestIncomingOrderNumber}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleJumpToPendingOrders}
                  data-testid="jump-to-pending-orders-btn"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] bg-[#B59449] hover:bg-[#C6A558] text-[#141311] text-xs sm:text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Clock className="w-4 h-4" aria-hidden="true" />
                  <span>عرض الطلبات قيد المراجعة</span>
                </button>
              </section>
            )}

            {/* 4 Live KPI Cards */}
            <section aria-label="إحصائيات المبيعات والمتجر" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-[#E7E0D2] rounded-xl p-5 space-y-1.5">
                <p className="text-xs font-medium text-[#615B52]">إجمالي المبيعات</p>
                <p
                  data-testid="kpi-revenue"
                  className="text-2xl font-bold text-[#181715]"
                >
                  <OmrPrice amount={data.analytics.totalSalesRevenue} />
                </p>
              </div>

              <div className="bg-white border border-[#E7E0D2] rounded-xl p-5 space-y-1.5">
                <p className="text-xs font-medium text-[#615B52]">عدد الطلبات</p>
                <p
                  data-testid="kpi-orders"
                  className="text-2xl font-mono font-bold text-[#181715] tabular-nums"
                >
                  {data.analytics.totalOrders}
                </p>
              </div>

              <div
                className={`rounded-xl p-5 space-y-1.5 border ${
                  data.analytics.pendingOrders > 0
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-white border-[#E7E0D2]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-[#615B52]">الطلبات الجديدة / قيد المراجعة</p>
                  <Clock
                    className={`w-4 h-4 ${
                      data.analytics.pendingOrders > 0 ? 'text-amber-700' : 'text-[#8D867A]'
                    }`}
                    aria-hidden="true"
                  />
                </div>
                <p
                  data-testid="kpi-pending"
                  className="text-2xl font-mono font-bold text-[#8E6F2D] tabular-nums"
                >
                  {data.analytics.pendingOrders}
                </p>
              </div>

              <div className="bg-white border border-[#E7E0D2] rounded-xl p-5 space-y-1.5">
                <p className="text-xs font-medium text-[#615B52]">عدد زيارات المتجر</p>
                <p
                  data-testid="kpi-visits"
                  className="text-2xl font-mono font-bold text-[#181715] tabular-nums"
                >
                  {data.analytics.totalStoreVisits}
                </p>
              </div>
            </section>

            {/* Management Navigation Tabs */}
            <div
              role="tablist"
              aria-label="أقسام لوحة التحكم"
              className="flex flex-wrap items-center gap-2 border-b border-[#E7E0D2] pb-3"
            >
              {(
                [
                  { id: 'orders', label: 'الطلبات والإيصالات', icon: Receipt },
                  { id: 'products', label: 'إدارة المنتجات والأسعار', icon: Package },
                  { id: 'promos', label: 'أكواد الخصم', icon: Tag },
                  { id: 'settings', label: 'إعدادات المتجر والدفع', icon: Settings },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                const showPendingCount =
                  tab.id === 'orders' && data.analytics.pendingOrders > 0;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-[42px] text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? 'bg-[#141311] text-[#FAF8F4]'
                        : 'bg-white border border-[#E7E0D2] text-[#4F4A42] hover:text-[#181715]'
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{tab.label}</span>
                    {showPendingCount && (
                      <span
                        data-testid="orders-tab-pending-badge"
                        className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-xs font-mono font-bold tabular-nums rounded-full bg-[#B59449] text-[#141311]"
                      >
                        {data.analytics.pendingOrders}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: Orders & Receipt Management */}
            {activeTab === 'orders' && (
              <section id="admin-orders-section" className="space-y-4 scroll-mt-20">
                {/* Pending Orders Alert Banner & Filter Bar */}
                <div className="bg-white border border-[#E7E0D2] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Clock
                      className={`w-4 h-4 shrink-0 ${
                        data.analytics.pendingOrders > 0 ? 'text-amber-700' : 'text-[#615B52]'
                      }`}
                      aria-hidden="true"
                    />
                    <p data-testid="pending-orders-alert" className="text-sm font-medium text-[#181715]">
                      {data.analytics.pendingOrders > 0 ? (
                        <>
                          الطلبات الجديدة / قيد المراجعة:{' '}
                          <span className="font-mono font-bold text-amber-800 tabular-nums">
                            {data.analytics.pendingOrders}
                          </span>{' '}
                          بانتظار مراجعة الإيصال والتأكيد
                        </>
                      ) : (
                        'الطلبات الجديدة / قيد المراجعة: لا توجد طلبات معلّقة حالياً'
                      )}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-1 p-1 bg-[#F2EDE3] border border-[#E2D9C5] rounded-lg self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setOrderFilter('all')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        orderFilter === 'all'
                          ? 'bg-[#141311] text-[#FAF8F4]'
                          : 'text-[#4F4A42] hover:text-[#181715]'
                      }`}
                    >
                      جميع الطلبات ({data.orders.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderFilter('pending')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        orderFilter === 'pending'
                          ? 'bg-[#141311] text-[#FAF8F4]'
                          : 'text-[#4F4A42] hover:text-[#181715]'
                      }`}
                    >
                      قيد المراجعة ({data.analytics.pendingOrders})
                    </button>
                  </div>
                </div>

                {data.orders.filter((o) =>
                  orderFilter === 'pending' ? o.status === 'قيد المراجعة' : true
                ).length === 0 ? (
                  <div className="bg-white border border-[#E7E0D2] rounded-xl p-10 text-center text-sm text-[#615B52]">
                    {orderFilter === 'pending'
                      ? 'لا توجد طلبات قيد المراجعة حالياً.'
                      : 'لا توجد طلبات مسجلة حتى الآن.'}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.orders
                      .filter((o) =>
                        orderFilter === 'pending' ? o.status === 'قيد المراجعة' : true
                      )
                      .map((order) => (
                      <article
                        key={order.id}
                        data-testid={`admin-order-${order.orderNumber}`}
                        className={`rounded-xl p-5 space-y-4 border ${
                          order.status === 'قيد المراجعة'
                            ? 'bg-amber-50/35 border-amber-300'
                            : 'bg-white border-[#E7E0D2]'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#F2EDE3]">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                              <span className="font-mono font-bold text-base text-[#181715] tabular-nums">
                                {order.orderNumber}
                              </span>
                              <span className="text-[#B5AEA0]" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-mono text-xs text-[#8E6F2D] tabular-nums">
                                {order.trackingNumber}
                              </span>
                              <span className="text-[#B5AEA0]" aria-hidden="true">
                                ·
                              </span>
                              <span
                                data-testid={
                                  order.status === 'قيد المراجعة'
                                    ? 'pending-order-badge'
                                    : undefined
                                }
                                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                  order.status === 'قيد المراجعة'
                                    ? 'px-2.5 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-900'
                                    : order.status === 'مرفوض'
                                      ? 'text-red-700'
                                      : 'text-[#181715]'
                                }`}
                              >
                                {order.status === 'قيد المراجعة' && (
                                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                                )}
                                <span>
                                  {order.status === 'قيد المراجعة'
                                    ? 'طلب جديد · قيد المراجعة'
                                    : order.status}
                                </span>
                              </span>
                            </div>
                            <p className="text-sm text-[#4F4A42]">
                              {order.customerName} ·{' '}
                              <span dir="ltr" className="font-mono">
                                {order.customerPhone}
                              </span>{' '}
                              · {order.city} — {order.address}
                            </p>
                          </div>

                          <div className="text-end">
                            <p className="text-xs text-[#615B52]">الإجمالي النهائي</p>
                            <p className="text-lg font-bold text-[#8E6F2D]">
                              <OmrPrice amount={order.finalTotal} />
                            </p>
                            {order.promoCodeUsed && (
                              <p className="text-xs text-[#15803D]">
                                خصم {order.promoCodeUsed}: <OmrPrice amount={order.discountAmount} prefix="-" />
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Ordered Items */}
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs sm:text-sm text-[#4F4A42]">
                          {order.items.map((item) => (
                            <span key={`${order.id}-${item.productId}`}>
                              {item.nameAr} × <strong className="font-mono">{item.quantity}</strong> (
                              {formatOmr(item.lineTotalOmr)})
                            </span>
                          ))}
                        </div>

                        {/* Owner Actions Bar */}
                        <div className="pt-3 border-t border-[#F2EDE3] flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setReceiptOrder(order)}
                              className={`inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap transition-colors ${
                                order.status === 'قيد المراجعة'
                                  ? 'bg-[#FFF7E6] border border-[#B59449] hover:bg-[#F7ECD1] text-[#181715]'
                                  : 'bg-[#F2EDE3] hover:bg-[#E6DEC9] text-[#181715]'
                              }`}
                            >
                              <Eye className="w-4 h-4 text-[#8E6F2D]" aria-hidden="true" />
                              <span>عرض صورة إيصال الدفع</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStatusChange(order.id, 'تم تأكيد الدفع')}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold bg-[#15803D] hover:bg-[#166534] text-white rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>تأكيد الطلب</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStatusChange(order.id, 'مرفوض')}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold bg-white border border-red-300 hover:bg-red-50 text-red-700 rounded-lg cursor-pointer whitespace-nowrap"
                            >
                              <X className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>رفض الطلب</span>
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <label htmlFor={`status-${order.id}`} className="sr-only">
                              تحديث حالة الطلب {order.orderNumber}
                            </label>
                            <select
                              id={`status-${order.id}`}
                              value={order.status}
                              onChange={(e) =>
                                handleStatusChange(order.id, e.target.value as OrderStatus)
                              }
                              className="px-3 py-2 min-h-[40px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-xs font-medium text-[#181715] focus:outline-none focus:border-[#8E6F2D]"
                            >
                              {ORDER_STATUS_LIST.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </article>
                      ))}
                  </div>
                )}
              </section>
            )}

            {/* TAB 2: Products & Pricing Manager */}
            {activeTab === 'products' && (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={handleSaveProduct}
                  className="lg:col-span-5 bg-white border border-[#E7E0D2] rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-[#181715]">
                      {editingProduct ? `تعديل: ${editingProduct.nameAr}` : 'إضافة عطر أو بخور جديد'}
                    </h2>
                    {editingProduct && (
                      <button
                        type="button"
                        onClick={resetProductForm}
                        className="text-xs text-[#8E6F2D] hover:underline cursor-pointer"
                      >
                        إلغاء التعديل
                      </button>
                    )}
                  </div>

                  <div>
                    <label htmlFor="prod-name" className="block text-xs font-medium text-[#4F4A42] mb-1">
                      اسم المنتج بالعربية *
                    </label>
                    <input
                      id="prod-name"
                      type="text"
                      required
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="مثال: عطر ليالي ظفار"
                      className="w-full px-3.5 py-2 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="prod-cat" className="block text-xs font-medium text-[#4F4A42] mb-1">
                        التصنيف
                      </label>
                      <select
                        id="prod-cat"
                        value={prodCategory}
                        onChange={(e) => setProdCategory(e.target.value as ProductCategory)}
                        className="w-full px-3 py-2 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm"
                      >
                        <option value="perfume">عطور</option>
                        <option value="bukhoor">بخور</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="prod-price" className="block text-xs font-medium text-[#4F4A42] mb-1">
                        السعر (ر.ع) *
                      </label>
                      <input
                        id="prod-price"
                        type="number"
                        step="0.001"
                        min="0.1"
                        required
                        dir="ltr"
                        value={prodPrice}
                        onChange={(e) => setProdPrice(e.target.value)}
                        placeholder="25.000"
                        className="w-full px-3.5 py-2 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="prod-size" className="block text-xs font-medium text-[#4F4A42] mb-1">
                      الحجم أو الوزن
                    </label>
                    <input
                      id="prod-size"
                      type="text"
                      value={prodSize}
                      onChange={(e) => setProdSize(e.target.value)}
                      placeholder="100 مل · Eau de Parfum"
                      className="w-full px-3.5 py-2 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-notes" className="block text-xs font-medium text-[#4F4A42] mb-1">
                      النوتات العطرية / الوصف *
                    </label>
                    <textarea
                      id="prod-notes"
                      required
                      rows={3}
                      value={prodNotes}
                      onChange={(e) => setProdNotes(e.target.value)}
                      placeholder="عود طبيعي · عنبر · زعفران"
                      className="w-full px-3.5 py-2 bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="prod-img-upload" className="block text-xs font-medium text-[#4F4A42] mb-1">
                      صورة المنتج (رفع صورة أو رابط)
                    </label>
                    <input
                      id="prod-img-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleProductImageUpload}
                      disabled={uploadingProductImage}
                      className="block w-full text-xs text-[#4F4A42] file:me-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#EFE9DC] file:text-[#181715] file:font-medium cursor-pointer disabled:opacity-60"
                    />
                    {uploadingProductImage && (
                      <p className="mt-1.5 text-xs text-[#8E6F2D]">
                        جاري معالجة ورفع صورة المنتج...
                      </p>
                    )}
                    {prodImage && (
                      <img
                        src={prodImage}
                        alt="معاينة صورة المنتج"
                        className="mt-2 h-28 w-full object-cover rounded-lg border border-[#E7E0D2]"
                      />
                    )}
                  </div>

                  <div>
                    <label htmlFor="prod-stock-status" className="block text-xs font-medium text-[#4F4A42] mb-1">
                      حالة التوفر في المتجر
                    </label>
                    <select
                      id="prod-stock-status"
                      data-testid="prod-stock-status-select"
                      value={prodOutOfStock ? 'out_of_stock' : 'available'}
                      onChange={(e) => setProdOutOfStock(e.target.value === 'out_of_stock')}
                      className="w-full px-3 py-2 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm font-medium text-[#181715]"
                    >
                      <option value="available">متوفر</option>
                      <option value="out_of_stock">نفذت الكميه</option>
                    </select>
                    {prodOutOfStock && (
                      <p className="mt-1.5 text-xs text-amber-800">
                        سيظهر هذا المنتج للزبائن بحالة «نفذت الكميه» ولن يتمكنوا من إضافته للسلة.
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={savingProduct || uploadingProductImage}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-5 min-h-[44px] bg-[#141311] hover:bg-[#8E6F2D] disabled:opacity-60 text-[#FAF8F4] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {uploadingProductImage
                        ? 'جاري رفع الصورة...'
                        : savingProduct
                          ? 'جاري الحفظ...'
                          : editingProduct
                            ? 'حفظ التعديلات'
                            : 'إضافة المنتج للمتجر'}
                    </span>
                  </button>
                </form>

                <div className="lg:col-span-7 space-y-3">
                  {data.products.map((product) => {
                    const outOfStock = Boolean(product.outOfStock);
                    return (
                      <div
                        key={product.id}
                        data-testid={`admin-product-${product.id}`}
                        className="bg-white border border-[#E7E0D2] rounded-xl p-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <img
                            src={product.imageUrl}
                            alt={product.nameAr}
                            className={`w-16 h-16 rounded-lg object-cover bg-[#F2EDE3] shrink-0 ${
                              outOfStock ? 'opacity-65 grayscale-[30%]' : ''
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs text-[#8E6F2D] font-medium">
                                {getCategoryLabelAr(product.category)} · {product.sizeLabel}
                              </p>
                              {outOfStock && (
                                <span
                                  data-testid={`admin-out-of-stock-badge-${product.id}`}
                                  className="px-2 py-0.5 text-[11px] font-bold rounded bg-red-50 border border-red-200 text-red-700"
                                >
                                  نفذت الكميه
                                </span>
                              )}
                            </div>
                            <h3 className="text-sm sm:text-base font-semibold text-[#181715] truncate">
                              {product.nameAr}
                            </h3>
                            <p className="text-sm font-bold text-[#181715]">
                              <OmrPrice amount={product.priceOmr} />
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleProductStock(product)}
                            data-testid={`toggle-stock-${product.id}`}
                            className={`px-3 py-2 min-h-[38px] text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                              outOfStock
                                ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100 text-emerald-800'
                                : 'bg-amber-50 border-amber-300 hover:bg-amber-100 text-amber-900'
                            }`}
                          >
                            {outOfStock ? 'إرجاع كـ متوفر' : 'تحديد: نفذت الكميه'}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditProduct(product)}
                            aria-label={`تعديل ${product.nameAr}`}
                            className="p-2.5 rounded-lg border border-[#DFD6C3] hover:bg-[#F2EDE3] text-[#181715] cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product)}
                            aria-label={`حذف ${product.nameAr}`}
                            className="p-2.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* TAB 3: Discount Codes Manager */}
            {activeTab === 'promos' && (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={handleCreatePromo}
                  className="lg:col-span-5 bg-white border border-[#E7E0D2] rounded-xl p-5 space-y-4"
                >
                  <h2 className="text-base font-bold text-[#181715]">إنشاء كود خصم جديد</h2>

                  <div>
                    <label htmlFor="new-promo-code" className="block text-xs font-medium text-[#4F4A42] mb-1">
                      نص الكود *
                    </label>
                    <input
                      id="new-promo-code"
                      type="text"
                      required
                      dir="ltr"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      placeholder="RAMADAN20"
                      className="w-full px-3.5 py-2 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm font-mono uppercase"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="new-promo-type" className="block text-xs font-medium text-[#4F4A42] mb-1">
                        نوع الخصم
                      </label>
                      <select
                        id="new-promo-type"
                        value={promoType}
                        onChange={(e) => setPromoType(e.target.value as DiscountType)}
                        className="w-full px-3 py-2 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm"
                      >
                        <option value="percentage">نسبة مئوية (%)</option>
                        <option value="fixed">مبلغ ثابت (ر.ع)</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="new-promo-value" className="block text-xs font-medium text-[#4F4A42] mb-1">
                        القيمة *
                      </label>
                      <input
                        id="new-promo-value"
                        type="number"
                        step="0.001"
                        min="0.1"
                        required
                        dir="ltr"
                        value={promoValue}
                        onChange={(e) => setPromoValue(e.target.value)}
                        placeholder="15"
                        className="w-full px-3.5 py-2 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingPromo}
                    className="w-full py-2.5 px-5 min-h-[44px] bg-[#141311] hover:bg-[#8E6F2D] text-[#FAF8F4] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {savingPromo ? 'جاري الإنشاء...' : 'إضافة كود الخصم'}
                  </button>
                </form>

                <div className="lg:col-span-7 space-y-3">
                  {data.promoCodes.map((promo) => (
                    <div
                      key={promo.id}
                      className="bg-white border border-[#E7E0D2] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div>
                        <p className="font-mono font-bold text-base text-[#181715]">
                          {promo.code}
                        </p>
                        <p className="text-xs text-[#615B52] mt-0.5">
                          {promo.discountType === 'percentage'
                            ? `خصم ${promo.value}%`
                            : `خصم ثابت ${formatOmr(promo.value)}`}{' '}
                          · {promo.active ? 'مفعّل' : 'متوقف'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleTogglePromo(promo.id, promo.active)}
                          className={`px-3.5 py-2 min-h-[38px] text-xs font-semibold rounded-lg cursor-pointer ${
                            promo.active
                              ? 'bg-[#EFE9DC] text-[#181715] hover:bg-[#E2D9C5]'
                              : 'bg-[#15803D] text-white hover:bg-[#166534]'
                          }`}
                        >
                          {promo.active ? 'إيقاف' : 'تفعيل'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePromo(promo.id)}
                          aria-label={`حذف الكود ${promo.code}`}
                          className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TAB 4: Store & Payment Settings */}
            {activeTab === 'settings' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <section className="lg:col-span-7 bg-white border border-[#E7E0D2] rounded-xl p-6">
                  <h2 className="text-base font-bold text-[#181715] mb-4">
                    إعدادات التحويل البنكي والهوية
                  </h2>
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div>
                      <label htmlFor="settings-bank-phone" className="block text-xs font-medium text-[#4F4A42] mb-1">
                        رقم الهاتف المسجل بالبنك للتحويل *
                      </label>
                      <input
                        id="settings-bank-phone"
                        type="text"
                        dir="ltr"
                        required
                        value={bankPhone}
                        onChange={(e) => setBankPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm font-mono"
                      />
                    </div>

                    <div>
                      <label htmlFor="settings-bank-label" className="block text-xs font-medium text-[#4F4A42] mb-1">
                        وصف حساب التحويل
                      </label>
                      <input
                        id="settings-bank-label"
                        type="text"
                        value={bankLabel}
                        onChange={(e) => setBankLabel(e.target.value)}
                        className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="settings-wa" className="block text-xs font-medium text-[#4F4A42] mb-1">
                        رقم واتساب المتجر *
                      </label>
                      <input
                        id="settings-wa"
                        type="text"
                        dir="ltr"
                        required
                        value={whatsappNum}
                        onChange={(e) => setWhatsappNum(e.target.value)}
                        className="w-full px-3.5 py-2.5 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm font-mono"
                      />
                    </div>

                    <div>
                      <label htmlFor="settings-bio" className="block text-xs font-medium text-[#4F4A42] mb-1">
                        النبذة التعريفية عن براند لازورد
                      </label>
                      <textarea
                        id="settings-bio"
                        rows={4}
                        value={brandBio}
                        onChange={(e) => setBrandBio(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm leading-relaxed"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingSettings}
                      className="px-6 py-3 min-h-[44px] bg-[#141311] hover:bg-[#8E6F2D] text-[#FAF8F4] text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                    </button>
                  </form>
                </section>

                <section
                  aria-label="تغيير كلمة المرور"
                  data-testid="change-password-section"
                  className="lg:col-span-5 bg-white border border-[#E7E0D2] rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2.5 pb-3 border-b border-[#F2EDE3]">
                    <div className="w-9 h-9 rounded-lg bg-[#141311] text-[#B59449] flex items-center justify-center shrink-0">
                      <KeyRound className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[#181715]">تغيير كلمة المرور</h2>
                      <p className="text-xs text-[#615B52]">
                        تحديث كلمة مرور دخول صاحب البراند مع الحفاظ على جلستك الحالية
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label
                        htmlFor="current-admin-password"
                        className="block text-xs font-medium text-[#4F4A42] mb-1"
                      >
                        كلمة المرور الحالية *
                      </label>
                      <div className="relative" dir="ltr">
                        <input
                          id="current-admin-password"
                          type={showCurrentPassword ? 'text' : 'password'}
                          dir="ltr"
                          required
                          autoComplete="current-password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="أدخل كلمة المرور الحالية"
                          className="w-full pl-3.5 pr-11 py-2.5 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm text-[#181715] focus:outline-none focus:border-[#8E6F2D]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((prev) => !prev)}
                          aria-label={
                            showCurrentPassword
                              ? 'إخفاء كلمة المرور الحالية'
                              : 'إظهار كلمة المرور الحالية'
                          }
                          aria-pressed={showCurrentPassword}
                          data-testid="toggle-current-password-visibility"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-[#8E6F2D] hover:text-[#141311] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B59449] transition-colors cursor-pointer"
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="new-admin-password"
                        className="block text-xs font-medium text-[#4F4A42] mb-1"
                      >
                        كلمة المرور الجديدة *
                      </label>
                      <div className="relative" dir="ltr">
                        <input
                          id="new-admin-password"
                          type={showNewPassword ? 'text' : 'password'}
                          dir="ltr"
                          required
                          autoComplete="new-password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="6 أحرف فأكثر"
                          className="w-full pl-3.5 pr-11 py-2.5 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm text-[#181715] focus:outline-none focus:border-[#8E6F2D]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          aria-label={
                            showNewPassword
                              ? 'إخفاء كلمة المرور الجديدة'
                              : 'إظهار كلمة المرور الجديدة'
                          }
                          aria-pressed={showNewPassword}
                          data-testid="toggle-new-password-visibility"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-[#8E6F2D] hover:text-[#141311] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B59449] transition-colors cursor-pointer"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="confirm-admin-password"
                        className="block text-xs font-medium text-[#4F4A42] mb-1"
                      >
                        تأكيد كلمة المرور الجديدة *
                      </label>
                      <div className="relative" dir="ltr">
                        <input
                          id="confirm-admin-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          dir="ltr"
                          required
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="أعد إدخال كلمة المرور الجديدة"
                          className="w-full pl-3.5 pr-11 py-2.5 min-h-[42px] bg-[#FAF8F4] border border-[#D7CCB8] rounded-lg text-sm text-[#181715] focus:outline-none focus:border-[#8E6F2D]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={
                            showConfirmPassword
                              ? 'إخفاء تأكيد كلمة المرور الجديدة'
                              : 'إظهار تأكيد كلمة المرور الجديدة'
                          }
                          aria-pressed={showConfirmPassword}
                          data-testid="toggle-confirm-password-visibility"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-[#8E6F2D] hover:text-[#141311] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B59449] transition-colors cursor-pointer"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    {passwordError && (
                      <div
                        role="alert"
                        data-testid="password-change-error"
                        className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800"
                      >
                        {passwordError}
                      </div>
                    )}

                    {passwordSuccess && (
                      <div
                        role="status"
                        data-testid="password-change-success"
                        className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900"
                      >
                        {passwordSuccess}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingPassword}
                      data-testid="save-password-btn"
                      className="w-full px-6 py-3 min-h-[44px] bg-[#141311] hover:bg-[#8E6F2D] disabled:opacity-60 text-[#FAF8F4] border border-[#B59449]/40 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      {savingPassword ? 'جاري التحديث...' : 'حفظ كلمة المرور الجديدة'}
                    </button>
                  </form>
                </section>
              </div>
            )}
          </>
        )}
      </main>

      {/* Receipt Image Modal */}
      {receiptOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg bg-white border border-[#DFD6C3] rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 bg-[#141311] text-[#FAF8F4] flex items-center justify-between">
              <h3 id="receipt-modal-title" className="text-sm font-bold">
                إيصال الدفع — {receiptOrder.orderNumber} ({receiptOrder.customerName})
              </h3>
              <button
                type="button"
                onClick={() => setReceiptOrder(null)}
                aria-label="إغلاق صورة الإيصال"
                className="p-1.5 rounded-lg text-[#CFC7B8] hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-5 bg-[#FAF8F4] flex flex-col items-center gap-4">
              <img
                src={receiptOrder.receiptImageUrl}
                alt={`إيصال التحويل البنكي للطلب ${receiptOrder.orderNumber}`}
                className="max-h-[65vh] w-auto object-contain rounded-lg border border-[#E7E0D2] bg-white"
              />
              <div className="w-full flex items-center justify-between text-xs text-[#615B52]">
                <span>المبلغ المطلوب: {formatOmr(receiptOrder.finalTotal)}</span>
                <span className="font-mono">{receiptOrder.trackingNumber}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
