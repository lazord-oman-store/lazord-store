/**
 * Reads an uploaded image file as a data URL, gently resizing/compressing oversized
 * camera screenshots (> 350 KB) so uploads fit cleanly within serverless limits.
 */
export function readImageFileAsUploadDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة المختار.'));
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        reject(new Error('ملف الصورة غير صالح.'));
        return;
      }

      // Keep small images (e.g. PNG/WebP icons or pre-compressed receipts) untouched
      if (file.size <= 350 * 1024) {
        resolve(rawDataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 1400;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}
