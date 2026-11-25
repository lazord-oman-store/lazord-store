import { useRef } from 'react';
import { Instagram } from 'lucide-react';
import { normalizeSeasonalTheme, type SeasonalThemeId } from '../lib/seasonalTheme';
import { LAZORD_INSTAGRAM_URL } from '../lib/storeLogic';
import type { StoreSettings } from '../types/store';
import { BrandLogo } from './BrandLogo';
import { SeasonalHeroDecorations } from './SeasonalDecorations';
import { WhatsAppIcon } from './WhatsAppIcon';

interface StoreFooterProps {
  settings: StoreSettings;
  seasonalTheme?: SeasonalThemeId;
  onSecretAdminTrigger: () => void;
}

export function StoreFooter({ settings, seasonalTheme, onSecretAdminTrigger }: StoreFooterProps) {
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const activeTheme = normalizeSeasonalTheme(seasonalTheme ?? settings.seasonalTheme);

  const handleCopyrightClick = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current > 3000) {
      clickCountRef.current = 1;
    } else {
      clickCountRef.current += 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 5) {
      clickCountRef.current = 0;
      onSecretAdminTrigger();
    }
  };

  return (
    <footer className="relative overflow-hidden bg-[#141311] text-[#CFC7B8] border-t border-[#2B2721]">
      <SeasonalHeroDecorations theme={activeTheme} compact />
      <div className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8 pb-8 sm:pb-10 border-b border-[#2A2620]">
          <div className="md:col-span-6 space-y-4">
            <BrandLogo
              variant="dark"
              className="w-32 h-32 sm:w-44 sm:h-44"
              imgClassName="scale-[1.02]"
            />
            <p className="text-sm leading-relaxed text-[#B5AEA0] max-w-xl">
              {settings.brandBio}
            </p>
          </div>

          <div className="md:col-span-6 flex flex-col md:items-end justify-center gap-3">
            <p className="text-sm font-medium text-[#FAF8F4]">خدمة العملاء والاستفسارات</p>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 w-full md:w-auto">
              <div
                data-testid="footer-whatsapp-info"
                className="inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border border-[#3A342B] bg-[#1E1C19] text-xs sm:text-sm text-[#FAF8F4] text-center sm:text-start sm:whitespace-nowrap max-w-full select-text"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#B59449] shrink-0" />
                <span>تواصل معنا عبر الواتساب على الرقم 79115527</span>
              </div>

              <a
                href={LAZORD_INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border border-[#3A342B] bg-[#1E1C19] hover:border-[#B59449] text-xs sm:text-sm text-[#FAF8F4] transition-colors sm:whitespace-nowrap"
              >
                <Instagram className="w-4 h-4 text-[#B59449] shrink-0" aria-hidden="true" />
                <span>تواصل معنا عبر إنستجرام</span>
              </a>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs text-[#8D867A] text-center sm:text-start">
          {/* Secret 5-click trigger on © LAZORD — styled cleanly as copyright text */}
          <button
            type="button"
            onClick={handleCopyrightClick}
            data-testid="copyright-secret-trigger"
            className="text-xs text-[#8D867A] hover:text-[#B5AEA0] transition-colors cursor-default select-none focus:outline-none"
          >
            © LAZORD · جميع الحقوق محفوظة لدار لازورد للعطور والبخور {new Date().getFullYear()}
          </button>

          <p>توصيل لجميع محافظات السلطنة</p>
        </div>
      </div>
    </footer>
  );
}
