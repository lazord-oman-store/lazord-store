import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Clock, PackageCheck, Search, Truck, X, XCircle } from 'lucide-react';
import { storeRepository } from '../services/storeRepository';
import type { OrderStatus, PublicOrderTracking } from '../types/store';
import { OmrPrice } from './OmrPrice';
import { WhatsAppIcon } from './WhatsAppIcon';

interface TrackOrderModalProps {
  isOpen: boolean;
  initialTrackingNumber?: string;
  onClose: () => void;
}

const PROGRESS_STEPS: OrderStatus[] = [
  'قيد المراجعة',
  'تم تأكيد الدفع',
  'جاري التجهيز',
  'تم الشحن',
  'تم التوصيل',
];

function StatusIcon({ status }: { status: OrderStatus }) {
  switch (status) {
    case 'قيد المراجعة':
      return <Clock className="w-5 h-5 text-[#B45309]" aria-hidden="true" />;
    case 'تم تأكيد الدفع':
      return <CheckCircle2 className="w-5 h-5 text-[#15803D]" aria-hidden="true" />;
    case 'جاري التجهيز':
      return <PackageCheck className="w-5 h-5 text-[#8E6F2D]" aria-hidden="true" />;
    case 'تم الشحن':
      return <Truck className="w-5 h-5 text-[#1D4ED8]" aria-hidden="true" />;
    case 'تم التوصيل':
      return <CheckCircle2 className="w-5 h-5 text-[#15803D]" aria-hidden="true" />;
    case 'مرفوض':
      return <XCircle className="w-5 h-5 text-[#B91C1C]" aria-hidden="true" />;
  }
}

export function TrackOrderModal({
  isOpen,
  initialTrackingNumber = '',
  onClose,
}: TrackOrderModalProps) {
  const [trackingInput, setTrackingInput] = useState(initialTrackingNumber);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicOrderTracking | null>(null);

  useEffect(() => {
    if (isOpen && initialTrackingNumber) {
      setTrackingInput(initialTrackingNumber);
      setLoading(true);
      setError(null);
      storeRepository
        .trackOrder(initialTrackingNumber)
        .then((order) => setResult(order))
        .catch((err: Error) => {
          setResult(null);
          setError(err.message);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, initialTrackingNumber]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = trackingInput.trim();
    if (!trimmed) {
      setError('يرجى إدخال رقم التتبع الخاص بك (مثال: TRK-LZD-84920).');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const order = await storeRepository.trackOrder(trimmed);
      setResult(order);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'تعذر البحث عن الطلب.');
    } finally {
      setLoading(false);
    }
  };

  const activeStepIndex = result ? PROGRESS_STEPS.indexOf(result.status) : -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-order-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div className="w-full max-w-xl bg-[#FAF8F4] border border-[#DFD6C3] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 bg-[#141311] text-[#FAF8F4] flex items-center justify-between">
          <h2 id="track-order-title" className="font-editorial text-xl font-bold">
            تتبع طلبك
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة تتبع الطلب"
            className="p-2 rounded-lg text-[#CFC7B8] hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label
              htmlFor="tracking-number-input"
              className="block text-sm font-medium text-[#181715]"
            >
              أدخل رقم التتبع
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="tracking-number-input"
                type="text"
                dir="ltr"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="TRK-LZD-84920"
                className="flex-1 px-4 py-2.5 min-h-[44px] bg-white border border-[#D7CCB8] rounded-lg text-sm font-mono text-[#181715] focus:outline-none focus:border-[#8E6F2D]"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] bg-[#141311] hover:bg-[#8E6F2D] disabled:opacity-60 text-[#FAF8F4] text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Search className="w-4 h-4" aria-hidden="true" />
                <span>{loading ? 'جاري البحث...' : 'تحقق من الحالة'}</span>
              </button>
            </div>
            <p className="text-xs text-[#615B52]">
              أدخل رقم التتبع الذي ظهر لك بعد تأكيد الطلب بصيغة TRK-LZD-XXXXX.
            </p>
          </form>

          {error && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          {result && (
            <div
              data-testid="tracking-result"
              className="bg-white border border-[#E7E0D2] rounded-xl p-5 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EFE9DC]">
                <div>
                  <p className="text-xs text-[#615B52]">رقم الطلب المرتبط</p>
                  <p className="font-mono font-bold text-base text-[#181715] tabular-nums">
                    {result.orderNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#615B52]">رقم التتبع</p>
                  <p className="font-mono font-semibold text-sm text-[#8E6F2D] tabular-nums">
                    {result.trackingNumber}
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F2EDE3] text-sm font-semibold text-[#181715]">
                  <StatusIcon status={result.status} />
                  <span>{result.status}</span>
                </div>
              </div>

              {/* Status Progress Steps */}
              {result.status === 'مرفوض' ? (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900 space-y-3">
                  <p>
                    تم رفض الطلب أو تعذر تأكيد إيصال التحويل البنكي. يرجى التواصل مع خدمة العملاء عبر واتساب للمراجعة.
                  </p>
                  <div
                    data-testid="track-rejected-whatsapp-info"
                    className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-lg bg-[#141311] text-[#FAF8F4] text-xs font-semibold whitespace-nowrap select-text"
                  >
                    <WhatsAppIcon className="w-4 h-4 text-[#B59449] shrink-0" />
                    <span>تواصل معنا عبر الواتساب على الرقم 79115527</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[#615B52]">مراحل تنفيذ الطلب</p>
                  <div className="grid grid-cols-5 gap-1.5">
                    {PROGRESS_STEPS.map((step, idx) => {
                      const reached = idx <= activeStepIndex;
                      return (
                        <div key={step} className="space-y-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              reached ? 'bg-[#B59449]' : 'bg-[#EAE3D5]'
                            }`}
                          />
                          <p
                            className={`text-[11px] leading-tight ${
                              reached ? 'font-semibold text-[#181715]' : 'text-[#7A7367]'
                            }`}
                          >
                            {step}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div className="space-y-2 pt-2 border-t border-[#EFE9DC]">
                <p className="text-xs font-medium text-[#615B52]">
                  العميل: <span className="text-[#181715]">{result.customerName}</span> ·{' '}
                  <span>{result.city}</span>
                </p>
                <ul className="divide-y divide-[#F4EFE5] text-sm">
                  {result.items.map((item) => (
                    <li
                      key={`${item.productId}-${item.nameAr}`}
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <span className="text-[#181715]">
                        {item.nameAr} × <span className="font-mono">{item.quantity}</span>
                      </span>
                      <span className="text-[#4F4A42]">
                        <OmrPrice amount={item.lineTotalOmr} />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="pt-2 border-t border-[#EFE9DC] flex items-center justify-between text-sm font-bold text-[#181715]">
                  <span>الإجمالي النهائي</span>
                  <span className="text-[#8E6F2D]">
                    <OmrPrice amount={result.finalTotal} />
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
