export const LAZORD_BRAND_LOGO_URL =
  '/assets/aistudio/WhatsApp_Image_2026-11-22_at_9.40.16_PM_4f949f67.jpeg';

export const LAZORD_LOGO_GOLD_TRANSPARENT_URL = '/assets/aistudio/lazord-logo-gold.png';
export const LAZORD_LOGO_INK_TRANSPARENT_URL = '/assets/aistudio/lazord-logo-ink.png';

interface BrandLogoProps {
  /** 'light' renders obsidian ink on light ivory surfaces (#FAF8F4); 'dark' renders champagne gold on dark surfaces (#141311 / #1C1A17). */
  variant?: 'light' | 'dark';
  className?: string;
  imgClassName?: string;
  alt?: string;
  'data-testid'?: string;
}

export function BrandLogo({
  variant = 'light',
  className = 'w-20 h-20',
  imgClassName = 'scale-[1.06]',
  alt = 'الشعار الرسمي لدار LAZORD',
  'data-testid': dataTestId,
}: BrandLogoProps) {
  const src =
    variant === 'dark' ? LAZORD_LOGO_GOLD_TRANSPARENT_URL : LAZORD_LOGO_INK_TRANSPARENT_URL;

  return (
    <span
      data-testid={dataTestId}
      className={`inline-flex items-center justify-center bg-transparent select-none ${className}`}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={`w-full h-full object-contain bg-transparent ${imgClassName}`}
      />
    </span>
  );
}
