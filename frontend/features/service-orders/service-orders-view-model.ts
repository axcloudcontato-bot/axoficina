import type { ServiceOrderListItemResponse, ServiceOrderStatus } from '@oficina/contracts';

export type ServiceOrderAttentionFilter = 'ALL' | 'ACTIVE' | 'OVERDUE' | 'UNASSIGNED' | 'PAYMENT_PENDING';

const CLOSED_STATUSES: ServiceOrderStatus[] = ['DELIVERED', 'CANCELLED'];

export function isClosedServiceOrder(item: ServiceOrderListItemResponse): boolean {
  return CLOSED_STATUSES.includes(item.status);
}

export function isOverdueServiceOrder(item: ServiceOrderListItemResponse, now = new Date()): boolean {
  return !isClosedServiceOrder(item)
    && Boolean(item.expectedDeliveryAt)
    && new Date(item.expectedDeliveryAt!).getTime() < now.getTime();
}

export function getServiceOrderMetrics(items: ServiceOrderListItemResponse[], now = new Date()) {
  return {
    active: items.filter((item) => !isClosedServiceOrder(item)).length,
    overdue: items.filter((item) => isOverdueServiceOrder(item, now)).length,
    waitingParts: items.filter((item) => item.status === 'WAITING_PARTS').length,
    ready: items.filter((item) => item.status === 'COMPLETED').length,
  };
}

export function filterServiceOrders(
  items: ServiceOrderListItemResponse[],
  options: {
    search: string;
    status: ServiceOrderStatus | 'ALL';
    attention: ServiceOrderAttentionFilter;
    now?: Date;
  },
): ServiceOrderListItemResponse[] {
  const normalizedSearch = options.search.trim().toLocaleLowerCase('pt-BR');
  const now = options.now ?? new Date();

  return items
    .filter((item) => options.status === 'ALL' || item.status === options.status)
    .filter((item) => {
      if (options.attention === 'OVERDUE') return isOverdueServiceOrder(item, now);
      if (options.attention === 'ACTIVE') return !isClosedServiceOrder(item);
      if (options.attention === 'UNASSIGNED') return !isClosedServiceOrder(item) && !item.technicianId;
      if (options.attention === 'PAYMENT_PENDING') return item.outstandingAmountCents > 0;
      return true;
    })
    .filter((item) => {
      if (!normalizedSearch) return true;
      return [
        item.orderNumber.toString(),
        item.vehicleBrand,
        item.vehicleModel,
        item.vehiclePlate,
        item.customerName,
        item.technicianName,
      ].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR').includes(normalizedSearch);
    })
    .sort((left, right) => {
      const overdueDifference = Number(isOverdueServiceOrder(right, now)) - Number(isOverdueServiceOrder(left, now));
      if (overdueDifference !== 0) return overdueDifference;
      return new Date(right.openedAt).getTime() - new Date(left.openedAt).getTime();
    });
}
