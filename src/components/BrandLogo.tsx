export const LAZORD_BRAND_LOGO_URL =
  '/assets/aistudio/WhatsApp_Image_2026-11-22_at_9.40.16_PM_4f949f67.jpeg';

interface BrandLogoProps {
  /** 'light' renders obsidian ink blended onto light ivory surfaces (#FAF8F4); 'dark' renders champagne gold blended onto dark surfaces (#141311 / #1C1A17). */
  variant?: 'light' | 'dark';
  className?: string;
  imgClassName?: string;
  alt?: string;
}

export function BrandLogo({
  variant = 'light',
  className = 'w-20 h-20',
  imgClassName = 'scale-[1.06]',
  alt = 'الشعار الرسمي لدار LAZORD',
}: BrandLogoProps) {
  if (variant === 'dark') {
    return (
      <span className={`inline-block mix-blend-screen select-none ${className}`}>
        <span className="relative block w-full h-full isolate overflow-hidden">
          <img
            src={LAZORD_BRAND_LOGO_URL}
            alt={alt}
            className={`w-full h-full object-contain brightness-[1.06] contrast-[1.3] invert ${imgClassName}`}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[#DFC37E] mix-blend-multiply pointer-events-none"
          />
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-block overflow-hidden select-none ${className}`}>
      <img
        src={LAZORD_BRAND_LOGO_URL}
        alt={alt}
        className={`w-full h-full object-contain brightness-[1.06] contrast-[1.25] mix-blend-multiply ${imgClassName}`}
      />
    </span>
  );
}
