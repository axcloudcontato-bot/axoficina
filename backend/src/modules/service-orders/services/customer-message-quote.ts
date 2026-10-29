import type { CustomerMessageQuote, ServiceOrderResponse } from '@oficina/contracts';
import { createHash } from 'node:crypto';

export function quoteSnapshot(order: ServiceOrderResponse): CustomerMessageQuote {
  return {
    orderNumber: order.orderNumber, vehicle: `${order.vehicleBrand} ${order.vehicleModel}`, plate: order.vehiclePlate,
    totalAmountCents: order.totalAmountCents,
    ...(order.discountCents > 0 ? { discountCents: order.discountCents } : {}),
    items: (order.items ?? []).map(({ id, description, type, quantity, unitPriceCents, lineTotalCents }) => ({ id, description, type, quantity, unitPriceCents, lineTotalCents })),
  };
}

export function quotesMatch(snapshot: CustomerMessageQuote, current: CustomerMessageQuote) {
  return quoteSnapshotRevision(snapshot) === quoteSnapshotRevision(current);
}

export function quoteSnapshotRevision(snapshot: Pick<CustomerMessageQuote, 'items' | 'discountCents'>) {
  return quoteRevision(snapshot.items, snapshot.discountCents);
}

// Orders without a discount keep the exact hash they had before discounts existed, so earlier approvals stay valid.
export function quoteRevision(items: CustomerMessageQuote['items'], discountCents = 0) {
  const normalized = items.map(({ id, description, type, quantity, unitPriceCents, lineTotalCents }) => ({ id, description, type, quantity, unitPriceCents, lineTotalCents })).sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(discountCents > 0 ? { items: normalized, discountCents } : normalized)).digest('hex');
}
