import { useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { ApiRequestError, storeRepository } from '../services/storeRepository';
import { BrandLogo } from './BrandLogo';

interface OwnerLoginViewProps {
  initialNeedsSetup?: boolean;
  onLoginSuccess: () => void;
  onBackToStore: () => void;
}

export function OwnerLoginView({
  initialNeedsSetup = false,
  onLoginSuccess,
  onBackToStore,
}: OwnerLoginViewProps) {
  const [needsSetup, setNeedsSetup] = useState(initialNeedsSetup);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('يرجى إدخال البريد الإلكتروني أو اسم المستخدم وكلمة المرور.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (needsSetup) {
        await storeRepository.setupOwner(username.trim(), password);
      } else {
        await storeRepository.loginOwner(username.trim(), password);
      }
      onLoginSuccess();
    } catch (err) {
      if (err instanceof ApiRequestError && err.needsSetup) {
        setNeedsSetup(true);
      }
      setError(err instanceof Error ? err.message : 'فشل تسجيل الدخول.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141311] text-[#FAF8F4] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1C1A17] border border-[#2F2A22] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="space-y-2 text-center">
          <BrandLogo
            variant="dark"
            className="mx-auto w-36 h-36"
            imgClassName="scale-[1.08]"
          />
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#FAF8F4]">
            {needsSetup ? 'إعداد حساب صاحب البراند' : 'تسجيل دخول صاحب البراند'}
          </h1>
          <p className="text-xs sm:text-sm text-[#B5AEA0]">
            {needsSetup
              ? 'أنشئ بيانات دخول صاحب البراند لأول مرة، أو اضبط LAZORD_ADMIN_USERNAME و LAZORD_ADMIN_PASSWORD في إعدادات Vercel.'
              : 'منطقة محمية خاصة بإدارة متجر لازورد للعطور والبخور.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="owner-username"
              className="block text-xs font-medium text-[#D6CFC2] mb-1.5"
            >
              البريد الإلكتروني أو اسم المستخدم
            </label>
            <input
              id="owner-username"
              type="text"
              dir="ltr"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="أدخل اسم المستخدم"
              className="w-full px-4 py-2.5 min-h-[44px] bg-[#141311] border border-[#383229] rounded-lg text-sm text-[#FAF8F4] placeholder:text-[#7B7468] focus:outline-none focus:border-[#B59449]"
            />
          </div>

          <div>
            <label
              htmlFor="owner-password"
              className="block text-xs font-medium text-[#D6CFC2] mb-1.5"
            >
              كلمة المرور
            </label>
            <div className="relative" dir="ltr">
              <input
                id="owner-password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete={needsSetup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className="w-full pl-4 pr-11 py-2.5 min-h-[44px] bg-[#141311] border border-[#383229] rounded-lg text-sm text-[#FAF8F4] placeholder:text-[#7B7468] focus:outline-none focus:border-[#B59449]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                aria-pressed={showPassword}
                data-testid="toggle-login-password-visibility"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-[#B59449] hover:text-[#E5C983] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B59449] transition-colors cursor-pointer"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs sm:text-sm text-red-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-5 min-h-[46px] bg-[#B59449] hover:bg-[#C6A558] disabled:opacity-60 text-[#141311] font-bold text-sm rounded-lg transition-colors cursor-pointer"
          >
            {loading
              ? 'جاري التحقق...'
              : needsSetup
                ? 'حفظ بيانات الدخول والدخول للوحة'
                : 'دخول إلى لوحة التحكم'}
          </button>
        </form>

        <div className="pt-4 border-t border-[#2D2923] flex justify-center">
          <button
            type="button"
            onClick={onBackToStore}
            className="inline-flex items-center gap-2 text-xs text-[#B5AEA0] hover:text-[#FAF8F4] transition-colors cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
            <span>العودة إلى متجر LAZORD</span>
          </button>
        </div>
      </div>
    </div>
  );
}
