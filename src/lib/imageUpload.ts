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

const NON_UNIVERSAL_IMAGE_MIMES = new Set([
  'image/heic',
  'image/heic-sequence',
  'image/heif',
  'image/heif-sequence',
  'image/bmp',
  'image/x-ms-bmp',
  'image/x-bmp',
  'image/tiff',
  'image/x-tiff',
  'image/avif',
  'image/jxl',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/ico',
]);

const HEIC_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'mif1',
  'msf1',
  'heis',
  'hevs',
  'avic',
]);

const MAX_UNCOMPRESSED_BYTES = 350 * 1024;
const MAX_PASSTHROUGH_DIM = 1600;
const MAX_GIF_PASSTHROUGH_BYTES = 450 * 1024;
const TARGET_MAX_DATA_URL_CHARS = 950 * 1024;
const MAX_BROWSER_READ_BYTES = 25 * 1024 * 1024;

export function inferImageMimeFromFilename(filename: string): string | null {
  const clean = filename.trim().toLowerCase();
  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx === -1) return null;
  const ext = clean.slice(dotIdx + 1);
  return EXTENSION_TO_MIME[ext] ?? null;
}

export function isHeicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const ftyp = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (ftyp !== 'ftyp') return false;
  const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
  return HEIC_BRANDS.has(brand);
}

export function isHeicOrHeifFile(
  file: Pick<File, 'type' | 'name'>,
  headerBytes?: Uint8Array
): boolean {
  const mime = (file.type || '').trim().toLowerCase();
  if (
    mime === 'image/heic' ||
    mime === 'image/heif' ||
    mime === 'image/heic-sequence' ||
    mime === 'image/heif-sequence'
  ) {
    return true;
  }
  const extMime = inferImageMimeFromFilename(file.name);
  if (extMime === 'image/heic' || extMime === 'image/heif') {
    return true;
  }
  if (headerBytes && isHeicBytes(headerBytes)) {
    return true;
  }
  return false;
}

export function needsUniversalConversion(mime: string): boolean {
  return NON_UNIVERSAL_IMAGE_MIMES.has(mime.trim().toLowerCase());
}

export function isSupportedImageFile(
  file: Pick<File, 'type' | 'name'>,
  headerBytes?: Uint8Array
): boolean {
  if (file.type && file.type.toLowerCase().startsWith('image/')) {
    return true;
  }
  if (inferImageMimeFromFilename(file.name) !== null) {
    return true;
  }
  if (headerBytes && isHeicBytes(headerBytes)) {
    return true;
  }
  return false;
}

/**
 * Validates and normalizes product/receipt image URLs & Data URLs before rendering.
 * Rejects empty, truncated, malformed, or unsafe URLs so browsers never display
 * broken image placeholders.
 */
export function normalizeSafeImageSrc(src: unknown): string | null {
  if (typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith('/api/uploads/') ||
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('/api/seed-receipt/')
  ) {
    if (/[\s"'<>]/.test(trimmed)) return null;
    return trimmed;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
      return null;
    } catch {
      return null;
    }
  }

  // Validate base64 data:image/*;base64,<payload> strictly
  const base64Match =
    /^(data:image\/[a-z0-9.+_-]+(?:;[a-z0-9=._-]+)*;base64,)([A-Za-z0-9+/=\s]+)$/i.exec(trimmed);
  if (base64Match) {
    const prefix = base64Match[1];
    const cleanPayload = base64Match[2].replace(/\s+/g, '');
    if (cleanPayload.length < 4) return null;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanPayload)) return null;
    const nonPad = cleanPayload.replace(/=/g, '');
    if (nonPad.length < 2) return null;
    return `${prefix}${cleanPayload}`;
  }

  // Support non-base64 SVG data URLs (e.g., URL-encoded inline SVGs) safely
  const rawSvgMatch = /^data:image\/svg\+xml(?:;charset=[^;,]+)?,(.+)$/is.exec(trimmed);
  if (rawSvgMatch) {
    const body = rawSvgMatch[1];
    let decoded = body;
    try {
      decoded = decodeURIComponent(body);
    } catch {
      // keep raw body check
    }
    if (
      /<svg\b/i.test(decoded) &&
      !/<script\b/i.test(decoded) &&
      !/\bon[a-z]+\s*=/i.test(decoded) &&
      !/(?:javascript|vbscript)\s*:/i.test(decoded) &&
      !/<(?:foreignObject|iframe|object|embed)\b/i.test(decoded)
    ) {
      return trimmed;
    }
    return null;
  }

  return null;
}

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function blobToDataUrl(blob: Blob, overrideMime?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة بيانات الصورة.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('ملف الصورة فارغ أو تالف.'));
        return;
      }
      if (overrideMime && !/^data:image\//i.test(result)) {
        const marker = ';base64,';
        const idx = result.indexOf(marker);
        if (idx !== -1) {
          resolve(`data:${overrideMime}${result.slice(idx)}`);
          return;
        }
      }
      resolve(result);
    };
    reader.readAsDataURL(blob);
  });
}

function loadImageElementFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      if ((img.naturalWidth || img.width) > 0 && (img.naturalHeight || img.height) > 0) {
        resolve(img);
      } else {
        reject(new Error('أبعاد الصورة غير صالحة.'));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('تعذر فك ترميز الصورة في المتصفح.'));
    };
    img.src = objectUrl;
  });
}

type DecodableImageSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

async function decodeBlobToDrawable(blob: Blob): Promise<DecodableImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      if (bitmap.width > 0 && bitmap.height > 0) {
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => bitmap.close(),
        };
      }
      bitmap.close();
    } catch {
      // Fall through to HTMLImageElement decoding
    }
  }

  const img = await loadImageElementFromBlob(blob);
  return {
    source: img,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    cleanup: () => {
      // Object URL already revoked
    },
  };
}

function drawCanvasAndEncode(
  drawable: DecodableImageSource,
  maxDim: number,
  quality: number,
  preserveTransparency: boolean
): string | null {
  const scale = Math.min(1, maxDim / Math.max(drawable.width || 1, drawable.height || 1));
  const width = Math.max(1, Math.round((drawable.width || 1) * scale));
  const height = Math.max(1, Math.round((drawable.height || 1) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(drawable.source, 0, 0, width, height);

  const webp = canvas.toDataURL('image/webp', quality);
  if (webp.startsWith('data:image/webp') && webp.length > 32) {
    return webp;
  }

  if (preserveTransparency) {
    const png = canvas.toDataURL('image/png');
    if (png.startsWith('data:image/png') && png.length <= TARGET_MAX_DATA_URL_CHARS) {
      return png;
    }
  }

  // Fallback to crisp JPEG on solid background when WebP encoder is unavailable
  const jpegCanvas = document.createElement('canvas');
  jpegCanvas.width = width;
  jpegCanvas.height = height;
  const jpegCtx = jpegCanvas.getContext('2d');
  if (jpegCtx) {
    jpegCtx.fillStyle = '#FFFFFF';
    jpegCtx.fillRect(0, 0, width, height);
    jpegCtx.imageSmoothingEnabled = true;
    jpegCtx.imageSmoothingQuality = 'high';
    jpegCtx.drawImage(drawable.source, 0, 0, width, height);
    return jpegCanvas.toDataURL('image/jpeg', quality);
  }

  return canvas.toDataURL('image/png');
}

function compressDrawableToUniversalDataUrl(
  drawable: DecodableImageSource,
  preserveTransparency: boolean
): string {
  const steps: { maxDim: number; quality: number }[] = [
    { maxDim: 1600, quality: 0.9 },
    { maxDim: 1400, quality: 0.84 },
    { maxDim: 1200, quality: 0.78 },
    { maxDim: 960, quality: 0.72 },
    { maxDim: 800, quality: 0.66 },
  ];

  let best: string | null = null;
  for (const step of steps) {
    const candidate = drawCanvasAndEncode(
      drawable,
      step.maxDim,
      step.quality,
      preserveTransparency
    );
    if (!candidate) continue;
    best = candidate;
    if (candidate.length <= TARGET_MAX_DATA_URL_CHARS) {
      return candidate;
    }
  }

  if (!best) {
    throw new Error('تعذر تحويل الصورة إلى صيغة عرض قياسية.');
  }
  return best;
}

async function convertHeicBlobToPngBlob(file: Blob): Promise<Blob> {
  const mod = await import('heic2any');
  const converter = (mod.default || mod) as (options: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }) => Promise<Blob | Blob[]>;
  const converted = await converter({
    blob: file,
    toType: 'image/png',
    quality: 0.95,
  });
  return Array.isArray(converted) ? converted[0] : converted;
}

/**
 * Reads any image/* file (PNG, JPG, JPEG, WebP, GIF, SVG, AVIF, BMP, HEIC/HEIF, TIFF, etc.),
 * converts HEIC/HEIF or non-universal/oversized images into crisp WebP/PNG/JPEG,
 * preserves transparency & compact animations, and prevents truncated/broken uploads.
 */
export async function readImageFileAsUploadDataUrl(file: File): Promise<string> {
  if (file.size <= 0) {
    throw new Error('ملف الصورة المختار فارغ.');
  }
  if (file.size > MAX_BROWSER_READ_BYTES) {
    throw new Error('حجم ملف الصورة كبير جداً. يرجى اختيار صورة أصغر من 25 ميجابايت.');
  }

  let headerBytes: Uint8Array | undefined;
  try {
    headerBytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  } catch {
    headerBytes = undefined;
  }

  if (!isSupportedImageFile(file, headerBytes)) {
    throw new Error('الملف المختار ليس صورة صالحة. يرجى اختيار أي ملف صورة.');
  }

  const isHeic = isHeicOrHeifFile(file, headerBytes);
  const effectiveMime = (
    (file.type && file.type.toLowerCase().startsWith('image/') ? file.type.toLowerCase() : null) ||
    inferImageMimeFromFilename(file.name) ||
    (isHeic ? 'image/heic' : 'image/png')
  ).toLowerCase();

  // 1. Handle SVG cleanly with validation and UTF-8 safe base64 encoding
  if (effectiveMime === 'image/svg+xml' || effectiveMime === 'image/svg') {
    const svgText = await file.text();
    if (
      !/<svg\b/i.test(svgText) ||
      /<script\b/i.test(svgText) ||
      /\bon[a-z]+\s*=/i.test(svgText) ||
      /(?:javascript|vbscript)\s*:/i.test(svgText) ||
      /<(?:foreignObject|iframe|object|embed)\b/i.test(svgText)
    ) {
      throw new Error('ملف SVG المختار غير صالح أو يحتوي على عناصر غير مدعومة.');
    }

    const svgDataUrl = `data:image/svg+xml;base64,${utf8ToBase64(svgText)}`;
    if (svgDataUrl.length <= TARGET_MAX_DATA_URL_CHARS) {
      return svgDataUrl;
    }

    // Oversized SVG -> rasterize via Canvas into crisp WebP
    const drawable = await decodeBlobToDrawable(new Blob([svgText], { type: 'image/svg+xml' }));
    try {
      return compressDrawableToUniversalDataUrl(drawable, true);
    } finally {
      drawable.cleanup();
    }
  }

  // 2. Decode source image (with automatic HEIC/HEIF conversion fallback when browser lacks native decode)
  let workingBlob: Blob = file;
  let drawable: DecodableImageSource;
  try {
    drawable = await decodeBlobToDrawable(workingBlob);
  } catch {
    if (!isHeic) {
      throw new Error('تعذر عرض أو معالجة ملف الصورة. قد يكون الملف تالفاً أو بصيغة غير مدعومة.');
    }
    try {
      workingBlob = await convertHeicBlobToPngBlob(file);
      drawable = await decodeBlobToDrawable(workingBlob);
    } catch {
      throw new Error('تعذر تحويل صورة HEIC/HEIF في المتصفح. يرجى تجربة حفظها بصيغة JPG أو PNG.');
    }
  }

  try {
    // 3. Keep compact animated GIFs untouched once verified decodable
    if (effectiveMime === 'image/gif' && file.size <= MAX_GIF_PASSTHROUGH_BYTES) {
      const gifDataUrl = await blobToDataUrl(file, 'image/gif');
      if (normalizeSafeImageSrc(gifDataUrl)) {
        return gifDataUrl;
      }
    }

    // 4. Keep compact, already-crisp universal formats untouched
    const isAlreadyUniversal =
      effectiveMime === 'image/png' ||
      effectiveMime === 'image/jpeg' ||
      effectiveMime === 'image/webp';

    if (
      isAlreadyUniversal &&
      !isHeic &&
      file.size <= MAX_UNCOMPRESSED_BYTES &&
      Math.max(drawable.width, drawable.height) <= MAX_PASSTHROUGH_DIM
    ) {
      const passthrough = await blobToDataUrl(file, effectiveMime);
      if (passthrough.length <= TARGET_MAX_DATA_URL_CHARS && normalizeSafeImageSrc(passthrough)) {
        return passthrough;
      }
    }

    // 5. Convert/optimize HEIC, BMP, TIFF, AVIF, JXL, and large PNG/JPG/WebP/GIF to crisp universal WebP/PNG/JPEG
    const preserveTransparency =
      isHeic ||
      effectiveMime === 'image/png' ||
      effectiveMime === 'image/webp' ||
      effectiveMime === 'image/gif' ||
      effectiveMime === 'image/avif' ||
      effectiveMime === 'image/tiff' ||
      effectiveMime === 'image/x-tiff' ||
      effectiveMime === 'image/x-icon' ||
      effectiveMime === 'image/vnd.microsoft.icon' ||
      effectiveMime === 'image/ico' ||
      effectiveMime === 'image/jxl';

    const converted = compressDrawableToUniversalDataUrl(drawable, preserveTransparency);
    const verified = normalizeSafeImageSrc(converted);
    if (!verified) {
      throw new Error('تعذر إنتاج بيانات صورة صالحة. يرجى تجربة صورة أخرى.');
    }
    return verified;
  } finally {
    drawable.cleanup();
  }
}
