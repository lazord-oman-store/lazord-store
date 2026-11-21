import type { Order } from '../types/store';

export function detectNewPendingOrders(
  knownOrderIds: ReadonlySet<string> | null,
  currentOrders: readonly Pick<Order, 'id' | 'orderNumber' | 'status'>[]
): Pick<Order, 'id' | 'orderNumber' | 'status'>[] {
  if (!knownOrderIds) {
    return [];
  }
  return currentOrders.filter(
    (order) => order.status === 'قيد المراجعة' && !knownOrderIds.has(order.id)
  );
}

export function collectOrderIdSet(
  orders: readonly Pick<Order, 'id'>[]
): Set<string> {
  return new Set(orders.map((o) => o.id));
}

export function shouldPlayOrderChime(params: {
  soundMuted: boolean;
  newPendingCount: number;
}): boolean {
  return !params.soundMuted && params.newPendingCount > 0;
}

export function formatPendingAlertHeadline(pendingCount: number): string {
  if (pendingCount <= 0) {
    return 'لا توجد طلبات جديدة بانتظار المراجعة حالياً.';
  }
  if (pendingCount === 1) {
    return 'تنبيه: يوجد طلب واحد جديد بانتظار مراجعة الإيصال والتأكيد.';
  }
  if (pendingCount === 2) {
    return 'تنبيه: يوجد طلبان جديدان بانتظار مراجعة الإيصال والتأكيد.';
  }
  return `تنبيه: يوجد ${pendingCount} طلبات جديدة بانتظار مراجعة الإيصال والتأكيد.`;
}
