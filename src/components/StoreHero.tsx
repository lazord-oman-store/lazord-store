import { useState } from 'react';
import { ArrowDownLeft, Sparkles } from 'lucide-react';

interface StoreHeroProps {
  brandBio: string;
  onExploreCatalog: () => void;
}

export function StoreHero({ brandBio, onExploreCatalog }: StoreHeroProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <section id="top" className="bg-[#141311] text-[#FAF8F4] border-b border-[#2B2721]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Editorial Copy Column */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6 py-2">
            <p className="text-xs sm:text-sm tracking-wide text-[#D4B774] font-medium">
              دار العطور الملكية · البخور العماني الأصيل
            </p>

            <h1 className="font-editorial text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.2] text-[#FAF8F4] text-balance">
              LAZORD | لازورد
            </h1>

            <p className="text-base sm:text-lg leading-[1.85] text-[#DDD6C8] max-w-xl">
              {brandBio}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onExploreCatalog}
                className="inline-flex items-center gap-3 px-7 py-3.5 min-h-[44px] bg-[#B59449] hover:bg-[#C6A558] text-[#141311] font-semibold text-sm sm:text-base rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
              >
                <span>استكشف المجموعة</span>
                <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Showcase Image Column */}
          <div className="lg:col-span-6">
            <div className="relative h-full min-h-[280px] sm:min-h-[380px] lg:min-h-[440px] rounded-xl overflow-hidden border border-[#2D2923] bg-[#1E1C19]">
              {!imgError ? (
                <img
                  src="/src/assets/images/hero_lazord_atelier_1795258094371.jpg"
                  alt="زجاجة عطر لازورد الفاخرة مع مبخرة العود على الحجر الداكن"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full lg:h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#1F1C17] to-[#141311]">
                  <Sparkles className="w-10 h-10 text-[#B59449] mb-3" aria-hidden="true" />
                  <p className="font-editorial text-2xl text-[#FAF8F4]">LAZORD | لازورد</p>
                  <p className="text-sm text-[#B8B0A0] mt-2">عطور فاخرة وبخور أصيل</p>
                </div>
              )}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[#141311]/70 via-transparent to-transparent pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Full-Width Craftsmanship Pillars Strip */}
        <div className="mt-12 pt-8 border-t border-[#2A2620] grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          <div>
            <h2 className="text-base font-semibold text-[#D4B774]">خلاصات عطرية نادرة</h2>
            <p className="mt-1.5 text-sm text-[#CFC7B8] leading-relaxed">
              تركيبات مركّزة من دهن العود الكمبودي واللبان والزعفران بثبات يدوم طويلاً.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#D4B774]">بخور معتّق يدوياً</h2>
            <p className="mt-1.5 text-sm text-[#CFC7B8] leading-relaxed">
              رقائق عود ومعمول فاخر مشبع بأرقى الزيوت الشرقية للمناسبات والمجالس.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#D4B774]">توصيل وتتبع مباشر</h2>
            <p className="mt-1.5 text-sm text-[#CFC7B8] leading-relaxed">
              رقم تتبع فوري لكل طلب لمتابعة حالة الدفع والتجهيز والشحن لحظة بلحظة.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
