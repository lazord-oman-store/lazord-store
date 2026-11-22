import { useRef } from 'react';
import { Instagram } from 'lucide-react';
import {
  LAZORD_INSTAGRAM_URL,
  LAZORD_WHATSAPP_NUMBER,
  buildBrandDirectWhatsAppUrl,
} from '../lib/storeLogic';
import type { StoreSettings } from '../types/store';
import { WhatsAppIcon } from './WhatsAppIcon';

interface StoreFooterProps {
  settings: StoreSettings;
  onSecretAdminTrigger: () => void;
}

export function StoreFooter({ settings, onSecretAdminTrigger }: StoreFooterProps) {
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

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

  const waUrl = buildBrandDirectWhatsAppUrl(
    settings.whatsappNumber || LAZORD_WHATSAPP_NUMBER
  );

  return (
    <footer className="bg-[#141311] text-[#CFC7B8] border-t border-[#2B2721]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-[#2A2620]">
          <div className="md:col-span-6 space-y-3">
            <p className="font-editorial text-2xl font-bold text-[#FAF8F4]">
              {settings.brandName}
            </p>
            <p className="text-sm leading-relaxed text-[#B5AEA0] max-w-xl">
              {settings.brandBio}
            </p>
          </div>

          <div className="md:col-span-6 flex flex-col md:items-end justify-center gap-3">
            <p className="text-sm font-medium text-[#FAF8F4]">خدمة العملاء والاستفسارات</p>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="footer-whatsapp-btn"
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border border-[#3A342B] bg-[#1E1C19] hover:border-[#B59449] text-sm text-[#FAF8F4] transition-colors whitespace-nowrap"
              >
                <WhatsAppIcon className="w-4 h-4 text-[#B59449] shrink-0" />
                <span>تواصل معنا عبر واتساب</span>
              </a>

              <a
                href={LAZORD_INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg border border-[#3A342B] bg-[#1E1C19] hover:border-[#B59449] text-sm text-[#FAF8F4] transition-colors whitespace-nowrap"
              >
                <Instagram className="w-4 h-4 text-[#B59449]" aria-hidden="true" />
                <span>تواصل معنا عبر إنستجرام</span>
              </a>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8D867A]">
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
