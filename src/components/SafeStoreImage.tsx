import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { normalizeSafeImageSrc } from '../lib/imageUpload';

interface SafeStoreImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackLabel?: string;
  iconClassName?: string;
  referrerPolicy?: 'no-referrer' | 'strict-origin-when-cross-origin' | 'origin';
}

function ImageFallback({
  alt,
  className,
  fallbackLabel,
  iconClassName,
}: {
  alt: string;
  className: string;
  fallbackLabel?: string;
  iconClassName: string;
}) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={`flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-[#F2EDE3] to-[#E6DEC9] ${className}`}
    >
      <Sparkles className={`${iconClassName} text-[#8E6F2D] shrink-0`} aria-hidden="true" />
      {fallbackLabel && (
        <span className="mt-1.5 font-editorial text-sm sm:text-base text-[#181715] leading-snug line-clamp-2">
          {fallbackLabel}
        </span>
      )}
    </div>
  );
}

function SafeStoreImageInner({
  normalizedSrc,
  alt,
  className,
  fallbackClassName,
  fallbackLabel,
  iconClassName,
  referrerPolicy,
}: {
  normalizedSrc: string;
  alt: string;
  className: string;
  fallbackClassName: string;
  fallbackLabel?: string;
  iconClassName: string;
  referrerPolicy: 'no-referrer' | 'strict-origin-when-cross-origin' | 'origin';
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <ImageFallback
        alt={alt}
        className={fallbackClassName || className}
        fallbackLabel={fallbackLabel}
        iconClassName={iconClassName}
      />
    );
  }

  const effectiveSrc =
    retryCount > 0 && normalizedSrc.startsWith('/api/uploads/')
      ? `${normalizedSrc}${normalizedSrc.includes('?') ? '&' : '?'}retry=${retryCount}`
      : normalizedSrc;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      decoding="async"
      referrerPolicy={referrerPolicy}
      onError={() => {
        if (retryCount === 0 && normalizedSrc.startsWith('/api/uploads/')) {
          setRetryCount(1);
          return;
        }
        setHasError(true);
      }}
      className={className}
    />
  );
}

export function SafeStoreImage({
  src,
  alt,
  className = '',
  fallbackClassName = '',
  fallbackLabel,
  iconClassName = 'w-7 h-7',
  referrerPolicy = 'no-referrer',
}: SafeStoreImageProps) {
  const normalizedSrc = normalizeSafeImageSrc(src);

  if (!normalizedSrc) {
    return (
      <ImageFallback
        alt={alt}
        className={fallbackClassName || className}
        fallbackLabel={fallbackLabel}
        iconClassName={iconClassName}
      />
    );
  }

  return (
    <SafeStoreImageInner
      key={normalizedSrc}
      normalizedSrc={normalizedSrc}
      alt={alt}
      className={className}
      fallbackClassName={fallbackClassName}
      fallbackLabel={fallbackLabel}
      iconClassName={iconClassName}
      referrerPolicy={referrerPolicy}
    />
  );
}
