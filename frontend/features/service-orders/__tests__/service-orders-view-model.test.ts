import { describe, expect, it } from 'vitest';
import type { ServiceOrderListItemResponse } from '@oficina/contracts';
import { filterServiceOrders, getServiceOrderMetrics, isOverdueServiceOrder } from '../service-orders-view-model';

const base: ServiceOrderListItemResponse = {
  id: 'order',
  tenantId: 'tenant',
  orderNumber: 42,
  customerId: 'customer',
  customerName: 'Sergio Oliveira',
  customerPhone: '11999999999',
  vehicleId: 'vehicle',
  vehicleBrand: 'Honda',
  vehicleModel: 'HR-V',
  vehiclePlate: 'MOB2024',
  status: 'OPEN',
  openedAt: '2026-07-20T12:00:00Z',
  createdAt: '2026-07-20T12:00:00Z',
  totalAmountCents: 100_00,
  discountCents: 0,
  receivedAmountCents: 0,
  outstandingAmountCents: 100_00,
  paymentStatus: 'AWAITING_PAYMENT',
};

describe('service orders view model', () => {
  const now = new Date('2026-07-27T12:00:00Z');

  it('does not classify closed orders as overdue', () => {
    expect(isOverdueServiceOrder({ ...base, expectedDeliveryAt: '2026-07-26T12:00:00Z' }, now)).toBe(true);
    expect(isOverdueServiceOrder({ ...base, status: 'DELIVERED', expectedDeliveryAt: '2026-07-26T12:00:00Z' }, now)).toBe(false);
  });

  it('calculates operational metrics without mixing the archive', () => {
    expect(getServiceOrderMetrics([
      base,
      { ...base, id: 'parts', status: 'WAITING_PARTS' },
      { ...base, id: 'ready', status: 'COMPLETED' },
      { ...base, id: 'delivered', status: 'DELIVERED' },
    ], now)).toEqual({ active: 3, overdue: 0, waitingParts: 1, ready: 1 });
  });

  it('filters by order number and operational attention', () => {
    const overdue = { ...base, id: 'overdue', orderNumber: 99, expectedDeliveryAt: '2026-07-26T12:00:00Z' };
    const result = filterServiceOrders([base, overdue], { search: '99', status: 'ALL', attention: 'OVERDUE', now });
    expect(result.map((item) => item.id)).toEqual(['overdue']);
  });
});
