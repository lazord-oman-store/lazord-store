import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBrandDirectWhatsAppUrl,
  buildCustomerOrderWhatsAppUrl,
  buildOwnerStatusWhatsAppUrl,
  calculateCartTotals,
  computeStoreAnalytics,
  formatOmr,
  generateNextOrderNumber,
  generateUniqueTrackingNumber,
  sanitizeWhatsAppDigits,
  validateCheckoutInput,
} from './storeLogic';
import type { Product, PromoCode } from '../types/store';

const samplePerfume: Product = {
  id: 'prod-1',
  nameAr: 'عطر عود السلاطين',
  category: 'perfume',
  notesAr: 'عود كمبودي، زعفران، عنبر',
  sizeLabel: '100 مل',
  priceOmr: 32,
  imageUrl: '/src/assets/images/perfume_royal_oud_1795258094810.jpg',
  createdAt: '2026-11-01T10:00:00.000Z',
};

const sampleBukhoor: Product = {
  id: 'prod-2',
  nameAr: 'بخور لازورد الملكي',
  category: 'bukhoor',
  notesAr: 'دقة عود طبيعي، مسك أبيض',
  sizeLabel: '50 جم',
  priceOmr: 18.5,
  imageUrl: '/src/assets/images/bukhoor_royal_charcoal_1795258094434.jpg',
  createdAt: '2026-11-01T10:00:00.000Z',
};

test('generateNextOrderNumber strictly increments and avoids duplicates', () => {
  assert.equal(generateNextOrderNumber([]), 'LZD-1001');
  assert.equal(generateNextOrderNumber(['LZD-1001', 'LZD-1002']), 'LZD-1003');
  assert.equal(generateNextOrderNumber(['LZD-1005', 'LZD-1002', 'INVALID']), 'LZD-1006');
});

test('generateUniqueTrackingNumber produces TRK-LZD-XXXXX without collisions', () => {
  let seq = 0;
  const mockRand = () => {
    seq += 1;
    // First attempt collides with existing TRK-LZD-10000, second succeeds
    return seq === 1 ? 0 : 0.5;
  };
  const existing = new Set(['TRK-LZD-10000']);
  const generated = generateUniqueTrackingNumber(existing, mockRand);
  assert.equal(generated, 'TRK-LZD-55000');
  assert.notEqual(generated, 'TRK-LZD-10000');
  assert.match(generated, /^TRK-LZD-\d{5}$/);
});

test('calculateCartTotals handles percentage and fixed OMR promo codes accurately', () => {
  const items = [
    { product: samplePerfume, quantity: 1 },
    { product: sampleBukhoor, quantity: 2 },
  ];
  // 32 + 37 = 69 OMR
  const noPromo = calculateCartTotals(items, null);
  assert.equal(noPromo.originalSubtotal, 69);
  assert.equal(noPromo.discountAmount, 0);
  assert.equal(noPromo.finalTotal, 69);

  const pctPromo: PromoCode = {
    id: 'p1',
    code: 'LAZORD15',
    discountType: 'percentage',
    value: 15,
    active: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  };
  const withPct = calculateCartTotals(items, pctPromo);
  assert.equal(withPct.originalSubtotal, 69);
  assert.equal(withPct.discountAmount, 10.35);
  assert.equal(withPct.finalTotal, 58.65);

  const fixedOverSubtotal: PromoCode = {
    id: 'p2',
    code: 'VIP100',
    discountType: 'fixed',
    value: 100,
    active: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  };
  const clamped = calculateCartTotals(items, fixedOverSubtotal);
  assert.equal(clamped.discountAmount, 69);
  assert.equal(clamped.finalTotal, 0);

  const inactivePromo: PromoCode = { ...pctPromo, active: false };
  const inactiveResult = calculateCartTotals(items, inactivePromo);
  assert.equal(inactiveResult.discountAmount, 0);
  assert.equal(inactiveResult.appliedCode, null);
});

test('computeStoreAnalytics starts at zero and counts only approved orders in revenue and order count', () => {
  const zeroBaseline = computeStoreAnalytics([], 0);
  assert.deepEqual(zeroBaseline, {
    totalSalesRevenue: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalStoreVisits: 0,
  });

  const pendingOnly = computeStoreAnalytics(
    [{ finalTotal: 34.0, status: 'قيد المراجعة' }],
    5
  );
  assert.deepEqual(pendingOnly, {
    totalSalesRevenue: 0,
    totalOrders: 0,
    pendingOrders: 1,
    totalStoreVisits: 5,
  });

  const mixed = computeStoreAnalytics(
    [
      { finalTotal: 45.5, status: 'تم تأكيد الدفع' },
      { finalTotal: 18.0, status: 'جاري التجهيز' },
      { finalTotal: 22.0, status: 'قيد المراجعة' },
      { finalTotal: 99.0, status: 'مرفوض' },
    ],
    14
  );
  assert.equal(mixed.totalOrders, 2);
  assert.equal(mixed.pendingOrders, 1);
  assert.equal(mixed.totalSalesRevenue, 63.5);
  assert.equal(mixed.totalStoreVisits, 14);
});

test('formatOmr formats 3 decimal places with ر.ع', () => {
  assert.equal(formatOmr(24.5), '24.500 ر.ع');
});

test('sanitizeWhatsAppDigits normalizes leading zeros, +, spaces, Arabic digits, and Oman 968 prefix', () => {
  assert.equal(sanitizeWhatsAppDigits('98765432'), '96898765432');
  assert.equal(sanitizeWhatsAppDigits('098765432'), '96898765432');
  assert.equal(sanitizeWhatsAppDigits('+968 9876-5432'), '96898765432');
  assert.equal(sanitizeWhatsAppDigits('00968 9876 5432'), '96898765432');
  assert.equal(sanitizeWhatsAppDigits('968098765432'), '96898765432');
  assert.equal(sanitizeWhatsAppDigits('٩٨٧٦٥٤٣٢'), '96898765432');
  assert.equal(sanitizeWhatsAppDigits('00971 50 123 4567'), '971501234567');
  assert.equal(sanitizeWhatsAppDigits('   '), '');
});

test('WhatsApp URL builders use official wa.me format and handle malformed or empty inputs safely', () => {
  const blankDirectUrl = buildBrandDirectWhatsAppUrl('   ');
  assert.ok(blankDirectUrl.startsWith('https://wa.me/96879115527?text='));
  assert.ok(decodeURIComponent(blankDirectUrl).includes('LAZORD | لازورد'));

  const intlDirectUrl = buildBrandDirectWhatsAppUrl('+968 7911 5527');
  assert.ok(intlDirectUrl.startsWith('https://wa.me/96879115527?text='));
  assert.ok(!intlDirectUrl.includes('api.whatsapp.com'));

  const baseOrder = {
    orderNumber: 'LZD-1003',
    trackingNumber: 'TRK-LZD-44210',
    customerName: 'أحمد الحارثي',
    customerPhone: '91234567',
    finalTotal: 29.75,
    city: 'محافظة مسقط',
    address: 'القرم، شارع 14',
    promoCodeUsed: 'LAZORD15',
    discountAmount: 5.25,
    items: [
      {
        productId: 'prod-1',
        nameAr: 'عود لازورد الملكي',
        category: 'perfume' as const,
        sizeLabel: '100 مل',
        unitPriceOmr: 35,
        quantity: 1,
        lineTotalOmr: 35,
      },
    ],
  };

  const customerUrl = buildCustomerOrderWhatsAppUrl('96879115527', baseOrder);
  assert.ok(customerUrl.startsWith('https://wa.me/96879115527?text='));
  assert.ok(!customerUrl.includes('api.whatsapp.com'));
  const decodedCustomer = decodeURIComponent(customerUrl);
  assert.ok(decodedCustomer.includes('LAZORD | لازورد'));
  assert.ok(decodedCustomer.includes('LZD-1003'));
  assert.ok(decodedCustomer.includes('TRK-LZD-44210'));
  assert.ok(decodedCustomer.includes('91234567'));
  assert.ok(decodedCustomer.includes('عود لازورد الملكي'));
  assert.ok(decodedCustomer.includes('إيصال'));

  // Blank or invalid brand number falls back cleanly to 96879115527
  const fallbackCustomerUrl = buildCustomerOrderWhatsAppUrl('   ', baseOrder);
  assert.ok(fallbackCustomerUrl.startsWith('https://wa.me/96879115527?text='));

  const ownerUrl = buildOwnerStatusWhatsAppUrl('098765432', {
    customerName: 'سارة البلوشي',
    orderNumber: 'LZD-1002',
    trackingNumber: 'TRK-LZD-73194',
    status: 'تم الشحن',
    finalTotal: 34.0,
  });
  assert.ok(ownerUrl.startsWith('https://wa.me/96898765432?text='));
  assert.ok(!ownerUrl.includes('api.whatsapp.com'));
  assert.ok(decodeURIComponent(ownerUrl).includes('تم الشحن'));

  const ownerIntlUrl = buildOwnerStatusWhatsAppUrl('+968 9123-4567', {
    customerName: 'سارة البلوشي',
    orderNumber: 'LZD-1002',
    trackingNumber: 'TRK-LZD-73194',
    status: 'تم الشحن',
    finalTotal: 34.0,
  });
  assert.ok(ownerIntlUrl.startsWith('https://wa.me/96891234567?text='));

  // Invalid short customer phone returns empty string instead of broken wa.me/?text=
  assert.equal(
    buildOwnerStatusWhatsAppUrl('123', {
      customerName: 'سارة',
      orderNumber: 'LZD-1002',
      trackingNumber: 'TRK-LZD-73194',
      status: 'تم الشحن',
      finalTotal: 34.0,
    }),
    ''
  );
});

test('validateCheckoutInput requires receipt image, Oman governorate, and valid customer fields', () => {
  const missingReceipt = validateCheckoutInput({
    customerName: 'خالد المعمري',
    customerPhone: '91234567',
    city: 'محافظة مسقط',
    address: 'الخوير شارع 33',
    receiptImageUrl: '',
    itemCount: 1,
  });
  assert.ok(missingReceipt && missingReceipt.includes('إيصال'));

  const invalidGov = validateCheckoutInput({
    customerName: 'خالد المعمري',
    customerPhone: '91234567',
    city: 'دبي',
    address: 'شارع الشيخ زايد',
    receiptImageUrl: '/api/uploads/sample.png',
    itemCount: 1,
  });
  assert.ok(invalidGov && invalidGov.includes('المحافظة'));

  const valid = validateCheckoutInput({
    customerName: 'خالد المعمري',
    customerPhone: '91234567',
    city: 'محافظة مسقط',
    address: 'الخوير شارع 33',
    receiptImageUrl: '/api/uploads/sample.png',
    itemCount: 1,
  });
  assert.equal(valid, null);
});
