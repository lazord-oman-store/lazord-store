import { useState } from 'react';
import { ArrowDownLeft } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

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
          {/* Editorial Copy Column with Prominent Official Logo */}
          <div className="lg:col-span-6 flex flex-col justify-center items-start space-y-6 py-2">
            <h1 className="sr-only">LAZORD | لازورد — عطور فاخرة وبخور أصيل</h1>

            <p className="text-xs sm:text-sm tracking-wide text-[#D4B774] font-medium">
              دار العطور الملكية · البخور العماني الأصيل
            </p>

            <BrandLogo
              variant="dark"
              data-testid="hero-brand-logo"
              className="w-52 h-52 sm:w-64 sm:h-64"
              imgClassName="scale-[1.08]"
            />

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
            <div className="relative aspect-[16/10] sm:aspect-video lg:aspect-auto lg:h-full lg:min-h-[440px] rounded-xl overflow-hidden border border-[#2D2923] bg-[#1E1C19]">
              {!imgError ? (
                <img
                  src="/src/assets/images/hero_lazord_branded_v3_1795392542858.jpg"
                  alt="زجاجة عطر لازورد الفاخرة مع مبخرة العود على الحجر الداكن"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#1F1C17] to-[#141311]">
                  <BrandLogo variant="dark" className="w-44 h-44" imgClassName="scale-[1.08]" />
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
              نوتات و زيوت عطيه مختاره بعنايه شديده لتنال على إعجابكم لتجعل من العطر ذات فوحان عالٍ وثبات يدوم طويلاً
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#D4B774]">بخور معتّق يدوياً</h2>
            <p className="mt-1.5 text-sm text-[#CFC7B8] leading-relaxed">
              بخور فاخر مشبع بأرقى الزيوت الشرقية للمناسبات والمجالس.
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
