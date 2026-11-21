import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectOrderIdSet,
  detectNewPendingOrders,
  formatPendingAlertHeadline,
  shouldPlayOrderChime,
} from './adminAlertLogic';

test('detectNewPendingOrders returns empty on initial baseline load', () => {
  const initialOrders = [
    { id: 'ord-1', orderNumber: 'LZD-1001', status: 'قيد المراجعة' as const },
  ];
  assert.deepEqual(detectNewPendingOrders(null, initialOrders), []);
});

test('detectNewPendingOrders detects only newly arrived pending orders', () => {
  const known = collectOrderIdSet([
    { id: 'ord-1' },
    { id: 'ord-2' },
  ]);

  const updated = [
    { id: 'ord-4', orderNumber: 'LZD-1004', status: 'تم تأكيد الدفع' as const },
    { id: 'ord-3', orderNumber: 'LZD-1003', status: 'قيد المراجعة' as const },
    { id: 'ord-2', orderNumber: 'LZD-1002', status: 'قيد المراجعة' as const },
    { id: 'ord-1', orderNumber: 'LZD-1001', status: 'جاري التجهيز' as const },
  ];

  const detected = detectNewPendingOrders(known, updated);
  assert.equal(detected.length, 1);
  assert.equal(detected[0].id, 'ord-3');
  assert.equal(detected[0].orderNumber, 'LZD-1003');
});

test('shouldPlayOrderChime respects mute setting and new order count', () => {
  assert.equal(shouldPlayOrderChime({ soundMuted: false, newPendingCount: 1 }), true);
  assert.equal(shouldPlayOrderChime({ soundMuted: true, newPendingCount: 2 }), false);
  assert.equal(shouldPlayOrderChime({ soundMuted: false, newPendingCount: 0 }), false);
});

test('formatPendingAlertHeadline handles singular, dual, plural, and zero states', () => {
  assert.match(formatPendingAlertHeadline(0), /لا توجد طلبات/);
  assert.match(formatPendingAlertHeadline(1), /طلب واحد جديد/);
  assert.match(formatPendingAlertHeadline(2), /طلبان جديدان/);
  assert.match(formatPendingAlertHeadline(5), /5 طلبات جديدة/);
});
