import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCustomerOrderWhatsAppUrl,
  buildOwnerStatusWhatsAppUrl,
  calculateCartTotals,
  computeStoreAnalytics,
  formatOmr,
  generateNextOrderNumber,
  generateUniqueTrackingNumber,
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

test('computeStoreAnalytics excludes rejected orders from revenue and counts pending orders', () => {
  const analytics = computeStoreAnalytics(
    [
      { finalTotal: 45.5, status: 'تم تأكيد الدفع' },
      { finalTotal: 22.0, status: 'قيد المراجعة' },
      { finalTotal: 99.0, status: 'مرفوض' },
    ],
    142
  );
  assert.equal(analytics.totalOrders, 3);
  assert.equal(analytics.pendingOrders, 1);
  assert.equal(analytics.totalSalesRevenue, 67.5);
  assert.equal(analytics.totalStoreVisits, 142);
});

test('formatOmr formats 3 decimal places with ر.ع', () => {
  assert.equal(formatOmr(24.5), '24.500 ر.ع');
});

test('WhatsApp URL builders encode order and status details cleanly', () => {
  const customerUrl = buildCustomerOrderWhatsAppUrl('96879115527', {
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
        category: 'perfume',
        sizeLabel: '100 مل',
        unitPriceOmr: 35,
        quantity: 1,
        lineTotalOmr: 35,
      },
    ],
  });
  assert.ok(customerUrl.startsWith('https://wa.me/96879115527?text='));
  const decodedCustomer = decodeURIComponent(customerUrl);
  assert.ok(decodedCustomer.includes('LAZORD | لازورد'));
  assert.ok(decodedCustomer.includes('LZD-1003'));
  assert.ok(decodedCustomer.includes('TRK-LZD-44210'));
  assert.ok(decodedCustomer.includes('91234567'));
  assert.ok(decodedCustomer.includes('عود لازورد الملكي'));
  assert.ok(decodedCustomer.includes('إيصال'));

  const ownerUrl = buildOwnerStatusWhatsAppUrl('98765432', {
    customerName: 'سارة البلوشي',
    orderNumber: 'LZD-1002',
    trackingNumber: 'TRK-LZD-73194',
    status: 'تم الشحن',
    finalTotal: 34.0,
  });
  assert.ok(ownerUrl.startsWith('https://wa.me/96898765432?text='));
  assert.ok(decodeURIComponent(ownerUrl).includes('تم الشحن'));
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
