import { describe, expect, it } from 'vitest';
import type { ServiceOrderListItemResponse } from '@oficina/contracts';
import { prioritizeOperationalOrders } from '../dashboard-model';

const base: ServiceOrderListItemResponse = {
  id: 'base',
  tenantId: 'tenant',
  orderNumber: 1,
  customerId: 'customer',
  customerName: 'Cliente',
  customerPhone: '11999999999',
  vehicleId: 'vehicle',
  vehicleBrand: 'Fiat',
  vehicleModel: 'Uno',
  vehiclePlate: 'ABC1D23',
  status: 'OPEN',
  openedAt: '2026-07-20T12:00:00Z',
  createdAt: '2026-07-20T12:00:00Z',
  totalAmountCents: 0, discountCents: 0,
  receivedAmountCents: 0,
  outstandingAmountCents: 0,
  paymentStatus: 'AWAITING_PAYMENT',
};

describe('prioritizeOperationalOrders', () => {
  it('removes delivered and cancelled orders from operational priorities', () => {
    const result = prioritizeOperationalOrders([
      { ...base, id: 'delivered', status: 'DELIVERED' },
      { ...base, id: 'cancelled', status: 'CANCELLED' },
      { ...base, id: 'open', status: 'OPEN' },
    ]);

    expect(result.map((item) => item.id)).toEqual(['open']);
  });

  it('puts overdue promises before status-based priorities', () => {
    const result = prioritizeOperationalOrders([
      { ...base, id: 'parts', status: 'WAITING_PARTS' },
      { ...base, id: 'overdue', status: 'IN_PROGRESS', expectedDeliveryAt: '2026-07-26T12:00:00Z' },
    ], new Date('2026-07-27T12:00:00Z'));

    expect(result[0].id).toBe('overdue');
  });
});
