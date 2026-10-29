export interface StatOrder { id: string; customerId: string; status: string; closedAt: Date | null; discountCents: number }
export interface StatItem { serviceOrderId: string; quantity: unknown; unitPriceCents: number }

export interface CustomerHistory {
  orderCount: number;
  deliveredCount: number;
  lastVisitAt?: Date;
  totalSpentCents: number;
}

// An order is worth its items minus the discount, never below zero.
export function orderNetCents(items: StatItem[], discountCents: number): number {
  const gross = items.reduce((sum, item) => sum + Math.round(Number(item.quantity) * item.unitPriceCents), 0);
  return Math.max(0, gross - discountCents);
}

// What a customer has been through: cancelled orders do not count; the spend and the last visit come from delivered ones.
export function summarizeHistory(orders: StatOrder[], items: StatItem[]): CustomerHistory {
  const byOrder = new Map<string, StatItem[]>();
  for (const item of items) byOrder.set(item.serviceOrderId, [...(byOrder.get(item.serviceOrderId) ?? []), item]);
  const live = orders.filter((order) => order.status !== 'CANCELLED');
  const delivered = live.filter((order) => order.status === 'DELIVERED');
  const visits = delivered.map((order) => order.closedAt).filter((date): date is Date => date !== null);
  return {
    orderCount: live.length,
    deliveredCount: delivered.length,
    lastVisitAt: visits.length ? new Date(Math.max(...visits.map((date) => date.getTime()))) : undefined,
    totalSpentCents: delivered.reduce((sum, order) => sum + orderNetCents(byOrder.get(order.id) ?? [], order.discountCents), 0),
  };
}
