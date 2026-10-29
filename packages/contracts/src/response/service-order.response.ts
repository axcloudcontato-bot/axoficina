import type { PaginationData } from './pagination.response';
import type { ServiceOrderItemResponse } from './service-order-item.response';
import type { PaymentMethod, PaymentStatus, ServiceOrderReceiptResponse } from './service-order-receipt.response';
import type { ServiceOrderInstallmentResponse } from './service-order-installment.response';

// Ordem dos estados reflete a máquina de estados da spec — ver
// SERVICE_ORDER_TRANSITIONS no backend (service-order-state-machine.ts) e a
// cópia usada só pra UX no frontend (state-machine.ts).
export const SERVICE_ORDER_STATUSES = [
  'OPEN',
  'AWAITING_APPROVAL',
  'IN_PROGRESS',
  'WAITING_PARTS',
  'COMPLETED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

export interface ServiceOrderStatusHistoryItemResponse {
  id: string;
  fromStatus: ServiceOrderStatus | null;
  toStatus: ServiceOrderStatus;
  changedBy: string;
  changedAt: string;
}

export interface ServiceOrderResponse {
  quoteRevision?: string;
  id: string;
  tenantId: string;
  orderNumber: number;
  customerId: string;
  // Denormalizado pelo Manager, mesmo padrão de VehicleResponse.customerName.
  customerName: string;
  customerPhone: string;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  status: ServiceOrderStatus;
  checklist?: Record<string, unknown>;
  diagnosis?: string;
  entryMileage?: number;
  customerComplaint?: string;
  receptionNotes?: string;
  recommendedService?: string;
  expectedDeliveryAt?: string;
  paymentMethod?: PaymentMethod;
  paymentInstallments?: number;
  paymentAnticipated?: boolean;
  paymentFirstDueAt?: string;
  technicianId?: string;
  technicianName?: string;
  openedAt: string;
  // Since when the order sits in its current status (lists only).
  statusSince?: string;
  closedAt?: string;
  createdAt: string;
  // Só populado por getById — ver spec: list não precisa do histórico
  // completo, só a linha atual.
  statusHistory?: ServiceOrderStatusHistoryItemResponse[];
  // Feature 8 (Itens e Preço da OS): soma de todos os itens não removidos,
  // sempre presente (list e getById). `items` só populado por getById,
  // mesmo padrão de `statusHistory`.
  // Net total: items minus the order discount.
  totalAmountCents: number;
  discountCents: number;
  warrantyDays?: number;
  exitMileage?: number;
  items?: ServiceOrderItemResponse[];
  receipts?: ServiceOrderReceiptResponse[];
  installments?: ServiceOrderInstallmentResponse[];
  receivedAmountCents: number;
  outstandingAmountCents: number;
  paymentStatus: PaymentStatus;
}

export type ServiceOrderListItemResponse = ServiceOrderResponse;

export interface ServiceOrderListResponse extends PaginationData<ServiceOrderListItemResponse> {
  metrics?: { active: number; overdue: number; waitingParts: number; ready: number; delivered: number };
}
