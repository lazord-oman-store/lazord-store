import { useId } from 'react';
import { getSeasonalThemeOption, normalizeSeasonalTheme, type SeasonalThemeId } from '../lib/seasonalTheme';

function RamadanLanternSvg({
  idSuffix,
  height = 116,
  chainHeight = 36,
}: {
  idSuffix: string;
  height?: number;
  chainHeight?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const glowId = `lantern-glow-${idSuffix}-${uid}`;
  const metalId = `lantern-metal-${idSuffix}-${uid}`;
  const totalHeight = height + chainHeight;

  return (
    <svg
      width={Math.round(height * 0.56)}
      height={totalHeight}
      viewBox={`0 0 72 ${130 + chainHeight}`}
      fill="none"
      aria-hidden="true"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={metalId} x1="0" y1="0" x2="72" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F6DF9C" />
          <stop offset="48%" stopColor="#C9A351" />
          <stop offset="100%" stopColor="#7C5C21" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="54%" r="52%">
          <stop offset="0%" stopColor="#FFF6D6" stopOpacity="0.96" />
          <stop offset="45%" stopColor="#F2C86B" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#B59449" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Delicate suspension chain */}
      <line x1="36" y1="0" x2="36" y2={chainHeight} stroke={`url(#${metalId})`} strokeWidth="1.4" strokeDasharray="3 2.5" />
      <circle cx="36" cy={chainHeight} r="3" stroke={`url(#${metalId})`} strokeWidth="1.4" fill="#141311" />

      <g transform={`translate(0, ${chainHeight})`}>
        {/* Warm ambient candle aura */}
        <circle cx="36" cy="56" r="34" fill={`url(#${glowId})`} />

        {/* Dome crown & spire */}
        <path
          d="M36 4 L39 13 C45 15 48 20 49 25 L23 25 C24 20 27 15 33 13 Z"
          fill={`url(#${metalId})`}
        />
        <rect x="19" y="25" width="34" height="3.5" rx="1.5" fill={`url(#${metalId})`} />

        {/* Lantern body glass & brass frame */}
        <path
          d="M22 28.5 L50 28.5 L55 54 L49 84 L23 84 L17 54 Z"
          fill="#22190D"
          fillOpacity="0.78"
          stroke={`url(#${metalId})`}
          strokeWidth="1.8"
        />

        {/* Inner glowing latticework */}
        <path
          d="M27 33 C33 38 39 38 45 33 L49 54 L44 78 L28 78 L23 54 Z"
          fill={`url(#${glowId})`}
        />
        <path
          d="M36 30 L36 82 M24 44 L48 44 M20 56 L52 56 M24 68 L48 68"
          stroke={`url(#${metalId})`}
          strokeOpacity="0.55"
          strokeWidth="1"
        />
        {/* Inner glowing 8-point star */}
        <path
          d="M36 46 L38.5 52.5 L45 55 L38.5 57.5 L36 64 L33.5 57.5 L27 55 L33.5 52.5 Z"
          fill="#FFF8DF"
          fillOpacity="0.95"
        />

        {/* Base & hanging finial */}
        <rect x="21" y="84" width="30" height="3.5" rx="1.5" fill={`url(#${metalId})`} />
        <path d="M25 87.5 L47 87.5 L41 96 L31 96 Z" fill={`url(#${metalId})`} />
        <line x1="36" y1="96" x2="36" y2="106" stroke={`url(#${metalId})`} strokeWidth="1.4" />
        <circle cx="36" cy="108" r="2.2" fill="#F2D488" />
      </g>
    </svg>
  );
}

function CrescentAndStarsSvg({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const gradId = `lazord-crescent-gold-${uid}`;

  return (
    <svg viewBox="0 0 88 88" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gradId} x1="12" y1="10" x2="74" y2="76" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FAEDC4" />
          <stop offset="55%" stopColor="#D4B774" />
          <stop offset="100%" stopColor="#9A782D" />
        </linearGradient>
      </defs>
      <path
        d="M52 14 C34 15 21 29 21 46 C21 63 34 77 52 78 C40 72 34 60 34 46 C34 32 40 20 52 14 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M61 24 L62.8 29 L68 30.8 L62.8 32.6 L61 37.6 L59.2 32.6 L54 30.8 L59.2 29 Z"
        fill="#FAEDC4"
      />
      <path
        d="M72 47 L73.2 50.2 L76.4 51.4 L73.2 52.6 L72 55.8 L70.8 52.6 L67.6 51.4 L70.8 50.2 Z"
        fill="#D4B774"
      />
    </svg>
  );
}

function IslamicGeometricRosetteSvg({
  className = '',
  primary = '#EAD7A4',
  secondary = '#B59449',
}: {
  className?: string;
  primary?: string;
  secondary?: string;
}) {
  return (
    <svg viewBox="0 0 140 140" fill="none" aria-hidden="true" className={className}>
      <circle cx="70" cy="70" r="58" stroke={secondary} strokeWidth="0.9" strokeOpacity="0.45" strokeDasharray="3 4" />
      <circle cx="70" cy="70" r="46" stroke={primary} strokeWidth="1" strokeOpacity="0.55" />
      <rect
        x="34"
        y="34"
        width="72"
        height="72"
        stroke={primary}
        strokeWidth="1.1"
        strokeOpacity="0.65"
      />
      <rect
        x="34"
        y="34"
        width="72"
        height="72"
        transform="rotate(45 70 70)"
        stroke={primary}
        strokeWidth="1.1"
        strokeOpacity="0.65"
      />
      <polygon
        points="70,18 82,42 108,32 98,58 122,70 98,82 108,108 82,98 70,122 58,98 32,108 42,82 18,70 42,58 32,32 58,42"
        stroke={secondary}
        strokeWidth="1"
        strokeOpacity="0.7"
        fill={primary}
        fillOpacity="0.06"
      />
      <circle cx="70" cy="70" r="10" stroke={primary} strokeWidth="1.2" strokeOpacity="0.8" />
      <circle cx="70" cy="70" r="3" fill={primary} fillOpacity="0.9" />
    </svg>
  );
}

export function OmanEmblemSvg({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const gradId = `oman-emblem-gold-${uid}`;

  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={gradId} x1="10" y1="8" x2="54" y2="56" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF0BA" />
          <stop offset="50%" stopColor="#D4B774" />
          <stop offset="100%" stopColor="#947126" />
        </linearGradient>
      </defs>
      {/* Crossed Royal Swords */}
      <path
        d="M12 50 L49 13 M49 13 L45 14 M49 13 L48 17"
        stroke={`url(#${gradId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 42 L22 48" stroke={`url(#${gradId})`} strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M52 50 L15 13 M15 13 L19 14 M15 13 L16 17"
        stroke={`url(#${gradId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M48 42 L42 48" stroke={`url(#${gradId})`} strokeWidth="2.4" strokeLinecap="round" />

      {/* Central Omani Khanjar (T-shaped hilt + curved scabbard) */}
      <path
        d="M25 14 C28 11.5 36 11.5 39 14 L38 19 L35.5 21 L35.5 27 L28.5 27 L28.5 21 L26 19 Z"
        fill={`url(#${gradId})`}
      />
      <path
        d="M26 27 L38 27 L37 36 C37 44 42 50 47 52 C38 54 27 49 26 37 Z"
        fill={`url(#${gradId})`}
        stroke="#141311"
        strokeWidth="0.9"
      />
      {/* Waist belt & decorative rings */}
      <rect x="24" y="29.5" width="16" height="3.2" rx="1.2" fill="#FFF2C4" stroke="#7B5B1B" strokeWidth="0.6" />
      <circle cx="27" cy="34" r="1.3" fill="#FFF2C4" />
      <circle cx="37" cy="34" r="1.3" fill="#FFF2C4" />
    </svg>
  );
}

function OmanFlagMiniSvg({ className = '' }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  const clipId = `oman-flag-clip-${uid}`;

  return (
    <svg viewBox="0 0 42 26" fill="none" aria-hidden="true" className={className}>
      <defs>
        <clipPath id={clipId}>
          <rect x="0.8" y="0.8" width="40.4" height="24.4" rx="2.6" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Horizontal stripes top-to-bottom: White -> Red -> Green */}
        <rect x="13" y="0.5" width="28.5" height="8.5" fill="#FAF8F4" />
        <rect x="13" y="9" width="28.5" height="8" fill="#C8102E" />
        <rect x="13" y="17" width="28.5" height="8.5" fill="#00843D" />
        {/* Vertical Red hoist */}
        <rect x="0.5" y="0.5" width="13" height="25" fill="#C8102E" />
        {/* Mini Emblem mark in hoist */}
        <path
          d="M5 7 L9.5 11.5 M9.5 7 L5 11.5 M7.25 5.5 V12.5"
          stroke="#FAF8F4"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </g>
      <rect x="0.5" y="0.5" width="41" height="25" rx="3" stroke="#D4B774" strokeWidth="0.9" />
    </svg>
  );
}

const OMAN_PENNANTS = [
  {
    d: 'M44 45 L58 51 L50 74 Z',
    x: 42,
    yTop: 44,
    h1: 11,
    yMid: 55,
    h2: 9,
    yBot: 64,
    h3: 11,
  },
  {
    d: 'M88 53 L103 55 L95 79 Z',
    x: 86,
    yTop: 52,
    h1: 10,
    yMid: 62,
    h2: 8.5,
    yBot: 70.5,
    h3: 10,
  },
  {
    d: 'M135 51 L150 49 L144 73 Z',
    x: 133,
    yTop: 48,
    h1: 9.5,
    yMid: 57.5,
    h2: 8,
    yBot: 65.5,
    h3: 9,
  },
  {
    d: 'M182 41 L197 37 L193 60 Z',
    x: 180,
    yTop: 36,
    h1: 9,
    yMid: 45,
    h2: 7.5,
    yBot: 52.5,
    h3: 9,
  },
] as const;

function OmanCornerBuntingSvg({ flip = false, className = '' }: { flip?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '');

  return (
    <svg
      viewBox="0 0 260 110"
      fill="none"
      aria-hidden="true"
      className={`${className || 'w-44 sm:w-64 h-auto'} ${flip ? '-scale-x-100' : ''}`}
    >
      <defs>
        {OMAN_PENNANTS.map((pennant, idx) => (
          <clipPath key={idx} id={`oman-pennant-${uid}-${idx}`}>
            <path d={pennant.d} />
          </clipPath>
        ))}
      </defs>

      {/* Draped silk ribbons top-to-bottom: White -> Red -> Green + gold trim */}
      <path
        d="M0 0 C55 46 138 42 248 4 L256 14 C144 58 58 64 0 22 Z"
        fill="#FAF8F4"
        fillOpacity="0.95"
      />
      <path
        d="M0 0 C55 46 138 42 248 4"
        stroke="#D4B774"
        strokeWidth="0.9"
        strokeOpacity="0.75"
      />
      <path
        d="M0 16 C58 58 144 52 252 10 L256 18 C144 66 56 72 0 32 Z"
        fill="#C8102E"
        fillOpacity="0.92"
      />
      <path
        d="M0 28 C56 68 144 62 254 16 L258 24 C144 74 56 80 0 42 Z"
        fill="#00843D"
        fillOpacity="0.92"
      />
      <path
        d="M0 41 C56 80 144 74 258 24"
        stroke="#D4B774"
        strokeWidth="1.5"
        strokeOpacity="0.95"
      />

      {/* Hanging Omani pennant flags top-to-bottom: White -> Red -> Green with gold trim */}
      <g>
        {OMAN_PENNANTS.map((pennant, idx) => (
          <g key={idx}>
            <g clipPath={`url(#oman-pennant-${uid}-${idx})`}>
              <rect x={pennant.x} y={pennant.yTop} width="20" height={pennant.h1} fill="#FAF8F4" />
              <rect x={pennant.x} y={pennant.yMid} width="20" height={pennant.h2} fill="#C8102E" />
              <rect x={pennant.x} y={pennant.yBot} width="20" height={pennant.h3} fill="#00843D" />
            </g>
            <path d={pennant.d} stroke="#D4B774" strokeWidth="0.85" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function GoldStarSparkSvg({ className = '', color = '#D4B774' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={color} aria-hidden="true" className={className}>
      <path d="M12 2 L14.1 9.9 L22 12 L14.1 14.1 L12 22 L9.9 14.1 L2 12 L9.9 9.9 Z" />
    </svg>
  );
}

export function SeasonalGreetingBanner({ theme }: { theme?: SeasonalThemeId }) {
  const activeTheme = normalizeSeasonalTheme(theme);
  if (activeTheme === 'default') return null;

  const option = getSeasonalThemeOption(activeTheme);
  if (!option.bannerTextAr) return null;

  if (activeTheme === 'ramadan') {
    return (
      <div
        role="region"
        aria-label="تهنئة شهر رمضان المبارك"
        data-testid="seasonal-greeting-banner"
        data-seasonal-theme="ramadan"
        className="relative overflow-hidden bg-gradient-to-l from-[#120F0A] via-[#1D170E] to-[#120F0A] text-[#FAF8F4] border-b border-[#B59449]/45"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,183,116,0.16),transparent_65%)]"
        />
        <div className="relative max-w-[1280px] mx-auto px-4 py-2 flex items-center justify-center gap-3 text-center">
          <CrescentAndStarsSvg className="w-5 h-5 shrink-0 lazord-star-twinkle" />
          <p className="text-xs sm:text-sm font-medium tracking-wide text-[#F3DFA6]">
            {option.bannerTextAr}
          </p>
          <CrescentAndStarsSvg className="w-5 h-5 shrink-0 -scale-x-100 lazord-star-twinkle" />
        </div>
      </div>
    );
  }

  if (activeTheme === 'eid_fitr' || activeTheme === 'eid_adha') {
    const isAdha = activeTheme === 'eid_adha';
    return (
      <div
        role="region"
        aria-label={isAdha ? 'تهنئة عيد الأضحى المبارك' : 'تهنئة عيد الفطر المبارك'}
        data-testid="seasonal-greeting-banner"
        data-seasonal-theme={activeTheme}
        className={`relative overflow-hidden text-[#FAF8F4] border-b ${
          isAdha
            ? 'bg-gradient-to-l from-[#14110D] via-[#211A11] to-[#14110D] border-[#D4AF5A]/50'
            : 'bg-gradient-to-l from-[#161411] via-[#221E17] to-[#161411] border-[#EAD7A4]/50'
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,215,164,0.18),transparent_68%)]"
        />
        <div className="relative max-w-[1280px] mx-auto px-4 py-2 flex items-center justify-center gap-3 text-center">
          <IslamicGeometricRosetteSvg
            className="w-5 h-5 shrink-0 lazord-gold-float"
            primary="#FAF3E3"
            secondary="#D4B774"
          />
          <p className="text-xs sm:text-sm font-medium tracking-wide text-[#FAF0D7]">
            {option.bannerTextAr}
          </p>
          <IslamicGeometricRosetteSvg
            className="w-5 h-5 shrink-0 lazord-gold-float"
            primary="#FAF3E3"
            secondary="#D4B774"
          />
        </div>
      </div>
    );
  }

  // Oman National Day
  return (
    <div
      role="region"
      aria-label="تهنئة اليوم الوطني العُماني"
      data-testid="seasonal-greeting-banner"
      data-seasonal-theme="oman_national_day"
      className="relative overflow-hidden bg-[#141311] text-[#FAF8F4] border-b border-[#B59449]/50"
    >
      {/* Sleek tri-color ribbon along the very top edge: White (top) -> Red (middle) -> Green (bottom) */}
      <div
        aria-hidden="true"
        className="pointer-events-none h-[6px] w-full flex flex-col"
      >
        <span className="flex-1 bg-[#FAF8F4]" />
        <span className="flex-1 bg-[#C8102E]" />
        <span className="flex-1 bg-[#00843D]" />
      </div>
      <div className="relative max-w-[1280px] mx-auto px-4 py-2 flex items-center justify-center gap-2.5 sm:gap-3.5 text-center">
        <OmanFlagMiniSvg className="w-6 h-4 shrink-0" />
        <OmanEmblemSvg className="w-5 h-5 shrink-0" />
        <p className="text-xs sm:text-sm font-medium tracking-wide text-[#F3DFA6]">
          {option.bannerTextAr}
        </p>
        <OmanEmblemSvg className="w-5 h-5 shrink-0 hidden sm:block" />
        <OmanFlagMiniSvg className="w-6 h-4 shrink-0 hidden sm:block" />
      </div>
    </div>
  );
}

export function SeasonalHeroDecorations({
  theme,
  compact = false,
}: {
  theme?: SeasonalThemeId;
  compact?: boolean;
}) {
  const activeTheme = normalizeSeasonalTheme(theme);
  if (activeTheme === 'default') return null;

  if (activeTheme === 'ramadan') {
    return (
      <div
        aria-hidden="true"
        data-testid={compact ? 'seasonal-compact-overlay' : 'seasonal-hero-overlay'}
        data-seasonal-theme="ramadan"
        className="pointer-events-none select-none absolute inset-0 overflow-hidden z-0"
      >
        {/* Warm candle-gold atmospheric top glow */}
        <div
          className={`absolute inset-x-0 top-0 ${
            compact ? 'h-full' : 'h-44'
          } bg-gradient-to-b from-[#D4B774]/14 via-[#B59449]/6 to-transparent`}
        />

        {compact ? (
          <>
            <div className="hidden sm:block absolute -top-2 right-4 lazord-lantern-sway opacity-80 scale-50 origin-top">
              <RamadanLanternSvg idSuffix="cr1" height={64} chainHeight={8} />
            </div>
            <div className="hidden md:block absolute -top-2 left-6 lazord-lantern-sway-alt opacity-75 scale-50 origin-top">
              <RamadanLanternSvg idSuffix="cl1" height={64} chainHeight={10} />
            </div>
            <CrescentAndStarsSvg className="hidden lg:block absolute top-2 left-[42%] w-9 h-9 opacity-65 lazord-star-twinkle" />
          </>
        ) : (
          <>
            {/* Hanging lanterns on top-right & top-left canopy */}
            <div className="hidden sm:flex absolute top-0 right-4 lg:right-10 items-start gap-6 lg:gap-10">
              <div className="lazord-lantern-sway opacity-90">
                <RamadanLanternSvg idSuffix="r1" height={86} chainHeight={20} />
              </div>
              <div className="hidden lg:block lazord-lantern-sway-alt opacity-80">
                <RamadanLanternSvg idSuffix="r2" height={68} chainHeight={44} />
              </div>
            </div>

            <div className="absolute top-0 left-3 sm:left-8 lg:left-10 flex items-start gap-6 lg:gap-10">
              <div className="hidden lg:block lazord-lantern-sway-alt opacity-80">
                <RamadanLanternSvg idSuffix="l2" height={72} chainHeight={38} />
              </div>
              <div className="lazord-lantern-sway opacity-90 scale-75 sm:scale-100 origin-top">
                <RamadanLanternSvg idSuffix="l1" height={88} chainHeight={14} />
              </div>
            </div>

            {/* Crescent & twinkling golden stars */}
            <CrescentAndStarsSvg className="hidden lg:block absolute top-8 left-1/2 -translate-x-1/2 w-16 h-16 opacity-65 lazord-star-twinkle" />
            <GoldStarSparkSvg
              color="#F3DFA6"
              className="absolute top-8 sm:top-12 right-[28%] w-4 h-4 lazord-star-twinkle"
            />
            <svg
              viewBox="0 0 24 24"
              className="hidden sm:block absolute top-20 left-[26%] w-3.5 h-3.5 text-[#D4B774] lazord-star-twinkle"
              style={{ animationDelay: '1.2s' }}
              fill="currentColor"
            >
              <path d="M12 2 L14.2 9.8 L22 12 L14.2 14.2 L12 22 L9.8 14.2 L2 12 L9.8 9.8 Z" />
            </svg>
          </>
        )}
      </div>
    );
  }

  if (activeTheme === 'eid_fitr' || activeTheme === 'eid_adha') {
    const isAdha = activeTheme === 'eid_adha';
    const primary = isAdha ? '#D4AF5A' : '#EAD7A4';
    const secondary = isAdha ? '#A67C2E' : '#FAF3E3';

    return (
      <div
        aria-hidden="true"
        data-testid={compact ? 'seasonal-compact-overlay' : 'seasonal-hero-overlay'}
        data-seasonal-theme={activeTheme}
        className="pointer-events-none select-none absolute inset-0 overflow-hidden z-0"
      >
        <div
          className={`absolute inset-x-0 top-0 ${compact ? 'h-full' : 'h-40'}`}
          style={{
            background: isAdha
              ? 'linear-gradient(to bottom, rgba(212,175,90,0.12), transparent)'
              : 'linear-gradient(to bottom, rgba(234,215,164,0.13), transparent)',
          }}
        />

        {compact ? (
          <>
            <IslamicGeometricRosetteSvg
              className="absolute -top-6 -right-6 w-20 h-20 opacity-35"
              primary={primary}
              secondary={secondary}
            />
            <IslamicGeometricRosetteSvg
              className="hidden sm:block absolute -top-6 -left-6 w-20 h-20 opacity-35"
              primary={primary}
              secondary={secondary}
            />
            <GoldStarSparkSvg
              color={primary}
              className="hidden lg:block absolute top-4 left-[44%] w-3.5 h-3.5 lazord-gold-float"
            />
          </>
        ) : (
          <>
            {/* Islamic geometric corner medallions */}
            <IslamicGeometricRosetteSvg
              className="absolute -top-12 -right-12 w-32 sm:w-52 h-32 sm:h-52 opacity-35 sm:opacity-40"
              primary={primary}
              secondary={secondary}
            />
            <IslamicGeometricRosetteSvg
              className="absolute -top-12 -left-12 w-32 sm:w-52 h-32 sm:h-52 opacity-35 sm:opacity-40"
              primary={primary}
              secondary={secondary}
            />

            {/* Pearl & Gold Crescent and celebratory sparkles */}
            <CrescentAndStarsSvg className="hidden sm:block absolute top-6 left-[18%] w-12 h-12 opacity-60 lazord-gold-float" />
            <svg
              viewBox="0 0 24 24"
              className="absolute top-8 sm:top-10 right-[22%] w-4 h-4 lazord-gold-float"
              style={{ color: primary }}
              fill="currentColor"
            >
              <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
            </svg>
            <svg
              viewBox="0 0 24 24"
              className="hidden md:block absolute top-24 left-[34%] w-3.5 h-3.5 lazord-star-twinkle"
              style={{ color: secondary, animationDelay: '0.9s' }}
              fill="currentColor"
            >
              <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
            </svg>
            <svg
              viewBox="0 0 24 24"
              className="hidden md:block absolute bottom-16 right-[14%] w-3.5 h-3.5 lazord-gold-float"
              style={{ color: primary, animationDelay: '1.6s' }}
              fill="currentColor"
            >
              <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" />
            </svg>
          </>
        )}
      </div>
    );
  }

  // Oman National Day Hero Canopy
  return (
    <div
      aria-hidden="true"
      data-testid={compact ? 'seasonal-compact-overlay' : 'seasonal-hero-overlay'}
      data-seasonal-theme="oman_national_day"
      className="pointer-events-none select-none absolute inset-0 overflow-hidden z-0"
    >
      {/* Subtle tri-color radiance top-to-bottom: White -> Red -> Green */}
      <div
        className={`absolute inset-x-0 top-0 ${compact ? 'h-full' : 'h-36'}`}
        style={{
          background:
            'linear-gradient(to bottom, rgba(250,248,244,0.10) 0%, rgba(200,16,46,0.08) 45%, rgba(0,132,61,0.10) 80%, transparent 100%)',
        }}
      />

      {compact ? (
        <>
          <div className="hidden sm:block absolute top-0 left-0 lazord-bunting-sway opacity-75">
            <OmanCornerBuntingSvg className="w-28 h-auto" />
          </div>
          <div className="hidden md:block absolute top-0 right-0 lazord-bunting-sway opacity-75">
            <OmanCornerBuntingSvg flip className="w-28 h-auto" />
          </div>
          <div className="hidden lg:block absolute top-3 left-[44%] opacity-75">
            <OmanEmblemSvg className="w-8 h-8" />
          </div>
        </>
      ) : (
        <>
          {/* Top corner Omani silk bunting ribbons */}
          <div className="absolute top-0 left-0 lazord-bunting-sway opacity-90 scale-75 sm:scale-100 origin-top-left">
            <OmanCornerBuntingSvg />
          </div>
          <div className="hidden sm:block absolute top-0 right-0 lazord-bunting-sway opacity-90">
            <OmanCornerBuntingSvg flip />
          </div>

          {/* Prominent sculptural Omani Khanjar & Swords Emblem */}
          <div className="hidden lg:block absolute top-5 left-1/2 -translate-x-1/2 opacity-80">
            <OmanEmblemSvg className="w-12 h-12 drop-shadow-[0_2px_10px_rgba(212,183,116,0.35)]" />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Full-page ambient seasonal frame distributed tastefully across top, middle sides,
 * and lower corners of both the Storefront and Admin Dashboard.
 * Strictly pointer-events-none so it never blocks any clicks, tables, forms, or buttons.
 */
export function SeasonalPageCanvas({
  theme,
  variant = 'storefront',
}: {
  theme?: SeasonalThemeId;
  variant?: 'storefront' | 'admin';
}) {
  const activeTheme = normalizeSeasonalTheme(theme);
  if (activeTheme === 'default') return null;

  const isAdmin = variant === 'admin';
  const sideOpacity = isAdmin ? 'opacity-55' : 'opacity-75';
  const cornerOpacity = isAdmin ? 'opacity-45' : 'opacity-65';

  if (activeTheme === 'ramadan') {
    return (
      <div
        aria-hidden="true"
        data-testid={`seasonal-page-canvas-${variant}`}
        data-seasonal-theme="ramadan"
        className="pointer-events-none select-none fixed inset-0 overflow-hidden z-[15]"
      >
        {/* Subtle warm golden edge aura top & bottom */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#B59449]/10 to-transparent" />

        {/* Mid-page side hanging lanterns & stars (desktop wide margins, outside main content) */}
        <div className={`hidden xl:flex flex-col items-center gap-4 absolute top-[34%] right-3 ${sideOpacity}`}>
          <div className="lazord-lantern-sway">
            <RamadanLanternSvg idSuffix={`side-r-${variant}`} height={78} chainHeight={28} />
          </div>
          <GoldStarSparkSvg color="#B59449" className="w-4 h-4 lazord-star-twinkle" />
        </div>

        <div className={`hidden xl:flex flex-col items-center gap-4 absolute top-[46%] left-3 ${sideOpacity}`}>
          <CrescentAndStarsSvg className="w-11 h-11 lazord-star-twinkle" />
          <div className="lazord-lantern-sway-alt">
            <RamadanLanternSvg idSuffix={`side-l-${variant}`} height={70} chainHeight={24} />
          </div>
        </div>

        {/* Lower corner ambient crescent & stars on sm+ viewports */}
        <div className={`hidden sm:flex absolute bottom-5 right-5 items-end gap-2 ${cornerOpacity}`}>
          <IslamicGeometricRosetteSvg
            className="w-16 h-16 sm:w-24 sm:h-24 opacity-60"
            primary="#B59449"
            secondary="#8E6F2D"
          />
        </div>
        <div className={`hidden sm:flex absolute bottom-4 left-4 items-center gap-2 ${cornerOpacity}`}>
          <CrescentAndStarsSvg className="w-12 h-12 lazord-star-twinkle" />
        </div>
      </div>
    );
  }

  if (activeTheme === 'eid_fitr' || activeTheme === 'eid_adha') {
    const isAdha = activeTheme === 'eid_adha';
    const primary = isAdha ? '#B58932' : '#C9A85C';
    const secondary = isAdha ? '#7C591A' : '#8E6F2D';

    return (
      <div
        aria-hidden="true"
        data-testid={`seasonal-page-canvas-${variant}`}
        data-seasonal-theme={activeTheme}
        className="pointer-events-none select-none fixed inset-0 overflow-hidden z-[15]"
      >
        <div
          className="absolute inset-x-0 bottom-0 h-24"
          style={{
            background: isAdha
              ? 'linear-gradient(to top, rgba(181,137,50,0.10), transparent)'
              : 'linear-gradient(to top, rgba(201,168,92,0.10), transparent)',
          }}
        />

        {/* Mid-page left & right rosettes & celebratory stars */}
        <div className={`hidden xl:flex flex-col items-center gap-5 absolute top-[36%] right-3 ${sideOpacity}`}>
          <IslamicGeometricRosetteSvg
            className="w-20 h-20 lazord-gold-float"
            primary={primary}
            secondary={secondary}
          />
          <GoldStarSparkSvg color={primary} className="w-4 h-4 lazord-star-twinkle" />
        </div>

        <div className={`hidden xl:flex flex-col items-center gap-5 absolute top-[48%] left-3 ${sideOpacity}`}>
          <GoldStarSparkSvg color={primary} className="w-4 h-4 lazord-star-twinkle" />
          <IslamicGeometricRosetteSvg
            className="w-20 h-20 lazord-gold-float"
            primary={primary}
            secondary={secondary}
          />
        </div>

        {/* Lower corner medallions */}
        <div className={`hidden sm:block absolute -bottom-10 -right-10 ${cornerOpacity}`}>
          <IslamicGeometricRosetteSvg
            className="w-24 h-24 sm:w-36 sm:h-36"
            primary={primary}
            secondary={secondary}
          />
        </div>
        <div className={`hidden sm:block absolute -bottom-10 -left-10 ${cornerOpacity}`}>
          <IslamicGeometricRosetteSvg
            className="w-32 h-32"
            primary={primary}
            secondary={secondary}
          />
        </div>
      </div>
    );
  }

  // Oman National Day full-page ambient frame
  return (
    <div
      aria-hidden="true"
      data-testid={`seasonal-page-canvas-${variant}`}
      data-seasonal-theme="oman_national_day"
      className="pointer-events-none select-none fixed inset-0 overflow-hidden z-[15]"
    >
      {/* Sleek subtle national bottom edge ribbon: White (top) -> Red (middle) -> Green (bottom) */}
      <div className="absolute inset-x-0 bottom-0 h-[6px] flex flex-col opacity-90">
        <span className="flex-1 bg-[#FAF8F4]" />
        <span className="flex-1 bg-[#C8102E]" />
        <span className="flex-1 bg-[#00843D]" />
      </div>

      {/* Mid-page desktop side flags & Khanjar crests */}
      <div className={`hidden xl:flex flex-col items-center gap-4 absolute top-[38%] right-3 ${sideOpacity}`}>
        <OmanFlagMiniSvg className="w-9 h-6 drop-shadow-sm" />
        <OmanEmblemSvg className="w-10 h-10" />
        <OmanFlagMiniSvg className="w-9 h-6 drop-shadow-sm" />
      </div>

      <div className={`hidden xl:flex flex-col items-center gap-4 absolute top-[48%] left-3 ${sideOpacity}`}>
        <OmanEmblemSvg className="w-10 h-10" />
        <OmanFlagMiniSvg className="w-9 h-6 drop-shadow-sm" />
        <OmanEmblemSvg className="w-8 h-8 opacity-75" />
      </div>

      {/* Subtle corner emblems along bottom */}
      <div className={`hidden sm:flex absolute bottom-5 right-5 items-center gap-2 ${cornerOpacity}`}>
        <OmanEmblemSvg className="w-7 h-7 sm:w-9 sm:h-9" />
      </div>
      <div className={`hidden sm:flex absolute bottom-5 left-5 items-center gap-2 ${cornerOpacity}`}>
        <OmanFlagMiniSvg className="w-8 h-5" />
      </div>
    </div>
  );
}

/**
 * Refined horizontal seasonal divider positioned between major storefront/dashboard bands
 * so seasonal elegance flows across the middle and lower sections of the page too.
 */
export function SeasonalSectionDivider({
  theme,
  className = '',
}: {
  theme?: SeasonalThemeId;
  className?: string;
}) {
  const activeTheme = normalizeSeasonalTheme(theme);
  if (activeTheme === 'default') return null;

  const option = getSeasonalThemeOption(activeTheme);

  return (
    <div
      aria-hidden="true"
      data-testid="seasonal-section-divider"
      data-seasonal-theme={activeTheme}
      className={`pointer-events-none select-none max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 ${className}`}
    >
      <div className="flex items-center justify-center gap-3 sm:gap-4">
        <span className="h-px flex-1 bg-gradient-to-l from-[#B59449]/60 via-[#D7CCB8] to-transparent" />
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-md bg-[#141311] border border-[#B59449]/45 shadow-xs">
          {activeTheme === 'ramadan' && (
            <CrescentAndStarsSvg className="w-4 h-4 lazord-star-twinkle" />
          )}
          {(activeTheme === 'eid_fitr' || activeTheme === 'eid_adha') && (
            <IslamicGeometricRosetteSvg className="w-4 h-4" primary="#FAF3E3" secondary="#D4B774" />
          )}
          {activeTheme === 'oman_national_day' && (
            <>
              <OmanFlagMiniSvg className="w-5 h-3.5" />
              <OmanEmblemSvg className="w-4 h-4" />
            </>
          )}
          <span className="text-[11px] sm:text-xs font-medium text-[#F3DFA6] whitespace-nowrap">
            {option.titleAr}
          </span>
        </div>
        <span className="h-px flex-1 bg-gradient-to-r from-[#B59449]/60 via-[#D7CCB8] to-transparent" />
      </div>
    </div>
  );
}
