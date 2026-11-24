import test from 'node:test';
import assert from 'node:assert/strict';
import {
  inferImageMimeFromFilename,
  isHeicBytes,
  isHeicOrHeifFile,
  isSupportedImageFile,
  needsUniversalConversion,
  normalizeSafeImageSrc,
} from './imageUpload';

test('inferImageMimeFromFilename recognizes all common image extensions case-insensitively', () => {
  assert.equal(inferImageMimeFromFilename('bottle.png'), 'image/png');
  assert.equal(inferImageMimeFromFilename('bottle.JPG'), 'image/jpeg');
  assert.equal(inferImageMimeFromFilename('bottle.jpeg'), 'image/jpeg');
  assert.equal(inferImageMimeFromFilename('bottle.webp'), 'image/webp');
  assert.equal(inferImageMimeFromFilename('anim.gif'), 'image/gif');
  assert.equal(inferImageMimeFromFilename('mark.svg'), 'image/svg+xml');
  assert.equal(inferImageMimeFromFilename('photo.AVIF'), 'image/avif');
  assert.equal(inferImageMimeFromFilename('scan.bmp'), 'image/bmp');
  assert.equal(inferImageMimeFromFilename('iphone.heic'), 'image/heic');
  assert.equal(inferImageMimeFromFilename('iphone.heif'), 'image/heif');
  assert.equal(inferImageMimeFromFilename('print.tiff'), 'image/tiff');
  assert.equal(inferImageMimeFromFilename('favicon.ico'), 'image/x-icon');
  assert.equal(inferImageMimeFromFilename('notes.txt'), null);
});

test('isSupportedImageFile and HEIC magic byte checks recognize HEIC/HEIF even without extension', () => {
  const heicHeader = Uint8Array.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70, // ftyp
    0x68, 0x65, 0x69, 0x63, // heic
    0x00, 0x00, 0x00, 0x00,
  ]);
  const mif1Header = Uint8Array.from([
    0x00, 0x00, 0x00, 0x18,
    0x66, 0x74, 0x79, 0x70, // ftyp
    0x6d, 0x69, 0x66, 0x31, // mif1
  ]);
  const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);

  assert.equal(isHeicBytes(heicHeader), true);
  assert.equal(isHeicBytes(mif1Header), true);
  assert.equal(isHeicBytes(pngHeader), false);

  assert.equal(isHeicOrHeifFile({ type: 'image/heic', name: 'IMG_01.bin' }), true);
  assert.equal(isHeicOrHeifFile({ type: '', name: 'IMG_01.HEIF' }), true);
  assert.equal(isHeicOrHeifFile({ type: '', name: 'IMG_01' }, heicHeader), true);
  assert.equal(isSupportedImageFile({ type: '', name: 'IMG_01' }, heicHeader), true);

  assert.equal(isSupportedImageFile({ type: 'image/gif', name: 'sample.gif' }), true);
  assert.equal(isSupportedImageFile({ type: 'image/avif', name: 'photo.avif' }), true);
  assert.equal(isSupportedImageFile({ type: 'image/svg+xml', name: 'logo.svg' }), true);
  assert.equal(isSupportedImageFile({ type: '', name: 'IMG_1024.HEIC' }), true);
  assert.equal(isSupportedImageFile({ type: 'application/octet-stream', name: 'art.bmp' }), true);
  assert.equal(isSupportedImageFile({ type: 'application/pdf', name: 'doc.pdf' }), false);
  assert.equal(isSupportedImageFile({ type: 'text/plain', name: 'readme.txt' }), false);

  assert.equal(needsUniversalConversion('image/heic'), true);
  assert.equal(needsUniversalConversion('image/bmp'), true);
  assert.equal(needsUniversalConversion('image/tiff'), true);
  assert.equal(needsUniversalConversion('image/webp'), false);
});

test('normalizeSafeImageSrc accepts valid image URLs/data URLs and rejects truncated or unsafe strings', () => {
  assert.equal(normalizeSafeImageSrc('/api/uploads/abc-123.webp'), '/api/uploads/abc-123.webp');
  assert.equal(normalizeSafeImageSrc('/src/assets/images/perfume.jpg'), '/src/assets/images/perfume.jpg');
  assert.equal(normalizeSafeImageSrc('https://cdn.example.com/perfume.png'), 'https://cdn.example.com/perfume.png');
  assert.equal(
    normalizeSafeImageSrc('  data:image/webp;base64,UklG\nRklGRg==  '),
    'data:image/webp;base64,UklGRklGRg=='
  );
  assert.equal(
    normalizeSafeImageSrc('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"></svg>'
  );

  // Reject truncated, empty, malformed, or unsafe URLs
  assert.equal(normalizeSafeImageSrc(''), null);
  assert.equal(normalizeSafeImageSrc('   '), null);
  assert.equal(normalizeSafeImageSrc(null), null);
  assert.equal(normalizeSafeImageSrc('data:image/png;base64,'), null);
  assert.equal(normalizeSafeImageSrc('data:image/png;base64,===='), null);
  assert.equal(normalizeSafeImageSrc('data:image/png;base64,a'), null);
  assert.equal(normalizeSafeImageSrc('javascript:alert(1)'), null);
  assert.equal(normalizeSafeImageSrc('data:text/html;base64,PGh0bWw+'), null);
  assert.equal(normalizeSafeImageSrc('data:image/svg+xml,<svg><script>alert(1)</script></svg>'), null);
});
