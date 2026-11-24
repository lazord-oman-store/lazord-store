const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  pjpeg: 'image/jpeg',
  pjp: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  ico: 'image/x-icon',
  jxl: 'image/jxl',
};

const MAX_UNCOMPRESSED_BYTES = 350 * 1024;
const TARGET_MAX_DATA_URL_CHARS = 950 * 1024;
const MAX_SERVERLESS_SAFE_BYTES = 4.2 * 1024 * 1024;

export function inferImageMimeFromFilename(filename: string): string | null {
  const clean = filename.trim().toLowerCase();
  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx === -1) return null;
  const ext = clean.slice(dotIdx + 1);
  return EXTENSION_TO_MIME[ext] ?? null;
}

export function isSupportedImageFile(file: Pick<File, 'type' | 'name'>): boolean {
  if (file.type && file.type.toLowerCase().startsWith('image/')) {
    return true;
  }
  return inferImageMimeFromFilename(file.name) !== null;
}

function normalizeImageDataUrlMime(rawDataUrl: string, file: Pick<File, 'type' | 'name'>): string {
  const mime =
    (file.type && file.type.toLowerCase().startsWith('image/') ? file.type.toLowerCase() : null) ||
    inferImageMimeFromFilename(file.name);

  if (!mime) return rawDataUrl;

  if (/^data:image\//i.test(rawDataUrl)) {
    return rawDataUrl;
  }

  const base64Marker = ';base64,';
  const idx = rawDataUrl.indexOf(base64Marker);
  if (idx !== -1) {
    return `data:${mime}${rawDataUrl.slice(idx)}`;
  }

  return rawDataUrl;
}

function encodeCanvasBestFormat(
  canvas: HTMLCanvasElement,
  preferLosslessAlpha: boolean,
  quality: number
): string {
  if (preferLosslessAlpha) {
    const webp = canvas.toDataURL('image/webp', quality);
    if (webp.startsWith('data:image/webp')) {
      return webp;
    }
  }
  const webp = canvas.toDataURL('image/webp', quality);
  const jpeg = canvas.toDataURL('image/jpeg', quality);
  if (webp.startsWith('data:image/webp') && webp.length < jpeg.length) {
    return webp;
  }
  return jpeg;
}

function compressImageViaCanvas(
  img: HTMLImageElement,
  maxDim: number,
  quality: number,
  preferLosslessAlpha: boolean
): string | null {
  const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
  const width = Math.max(1, Math.round((img.width || 1) * scale));
  const height = Math.max(1, Math.round((img.height || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, width, height);
  return encodeCanvasBestFormat(canvas, preferLosslessAlpha, quality);
}

/**
 * Reads any image/* file (PNG, JPG, JPEG, WebP, GIF, SVG, AVIF, BMP, HEIC, etc.)
 * as a data URL and automatically compresses/resizes oversized images via Canvas
 * so uploads stay fast and reliable under Vercel & Redis/KV limits.
 */
export function readImageFileAsUploadDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isSupportedImageFile(file)) {
      reject(new Error('الملف المختار ليس صورة صالحة. يرجى اختيار أي ملف صورة.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة المختار.'));
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        reject(new Error('ملف الصورة غير صالح.'));
        return;
      }

      const normalizedDataUrl = normalizeImageDataUrlMime(rawDataUrl, file);
      const effectiveMime =
        (file.type || inferImageMimeFromFilename(file.name) || '').toLowerCase();

      // Keep small images and compact SVGs untouched to preserve animations/vectors
      if (
        file.size <= MAX_UNCOMPRESSED_BYTES ||
        (effectiveMime === 'image/svg+xml' && normalizedDataUrl.length <= TARGET_MAX_DATA_URL_CHARS)
      ) {
        resolve(normalizedDataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const preferAlpha =
            effectiveMime === 'image/png' ||
            effectiveMime === 'image/webp' ||
            effectiveMime === 'image/gif' ||
            effectiveMime === 'image/svg+xml';

          let candidate = compressImageViaCanvas(img, 1400, 0.84, preferAlpha);
          if (candidate && candidate.length > TARGET_MAX_DATA_URL_CHARS) {
            const smaller = compressImageViaCanvas(img, 960, 0.72, preferAlpha);
            if (smaller && smaller.length < candidate.length) {
              candidate = smaller;
            }
          }

          if (candidate && candidate.length < normalizedDataUrl.length) {
            resolve(candidate);
            return;
          }

          if (file.size <= MAX_SERVERLESS_SAFE_BYTES) {
            resolve(normalizedDataUrl);
            return;
          }

          resolve(candidate || normalizedDataUrl);
        } catch {
          resolve(normalizedDataUrl);
        }
      };

      img.onerror = () => {
        // Formats like HEIC on non-Safari browsers cannot be decoded into <img>;
        // pass the normalized image data URL directly if within safe limits.
        if (file.size <= MAX_SERVERLESS_SAFE_BYTES) {
          resolve(normalizedDataUrl);
        } else {
          reject(
            new Error('حجم ملف الصورة كبير جداً ولا يمكن ضغطه في المتصفح. يرجى اختيار صورة أصغر من 4 ميجابايت.')
          );
        }
      };

      img.src = normalizedDataUrl;
    };

    reader.readAsDataURL(file);
  });
}
