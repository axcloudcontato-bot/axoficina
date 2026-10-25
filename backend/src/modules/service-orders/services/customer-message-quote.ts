import type { CustomerMessageQuote, ServiceOrderResponse } from '@oficina/contracts';
import { createHash } from 'node:crypto';

export function quoteSnapshot(order: ServiceOrderResponse): CustomerMessageQuote {
  return {
    orderNumber: order.orderNumber, vehicle: `${order.vehicleBrand} ${order.vehicleModel}`, plate: order.vehiclePlate,
    totalAmountCents: order.totalAmountCents,
    items: (order.items ?? []).map(({ id, description, type, quantity, unitPriceCents, lineTotalCents }) => ({ id, description, type, quantity, unitPriceCents, lineTotalCents })),
  };
}

export function quotesMatch(snapshot: CustomerMessageQuote, current: CustomerMessageQuote) {
  return quoteRevision(snapshot.items) === quoteRevision(current.items);
}

export function quoteRevision(items: CustomerMessageQuote['items']) {
  const normalized = items.map(({ id, description, type, quantity, unitPriceCents, lineTotalCents }) => ({ id, description, type, quantity, unitPriceCents, lineTotalCents })).sort((a, b) => a.id.localeCompare(b.id));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}
