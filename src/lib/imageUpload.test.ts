import test from 'node:test';
import assert from 'node:assert/strict';
import { inferImageMimeFromFilename, isSupportedImageFile } from './imageUpload';

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

test('isSupportedImageFile accepts any image/* MIME or known image extension and rejects non-images', () => {
  assert.equal(isSupportedImageFile({ type: 'image/gif', name: 'sample.gif' }), true);
  assert.equal(isSupportedImageFile({ type: 'image/avif', name: 'photo.avif' }), true);
  assert.equal(isSupportedImageFile({ type: 'image/svg+xml', name: 'logo.svg' }), true);
  assert.equal(isSupportedImageFile({ type: '', name: 'IMG_1024.HEIC' }), true);
  assert.equal(isSupportedImageFile({ type: 'application/octet-stream', name: 'art.bmp' }), true);
  assert.equal(isSupportedImageFile({ type: 'application/pdf', name: 'doc.pdf' }), false);
  assert.equal(isSupportedImageFile({ type: 'text/plain', name: 'readme.txt' }), false);
});
