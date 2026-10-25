import type { PageableRequest } from '../response/pagination.response';
import type { ServiceOrderStatus } from '../response/service-order.response';
import type { PaymentMethod } from '../response/service-order-receipt.response';

export interface CreateServiceOrderRequest {
  vehicleId: string;
  technicianId?: string;
  checklist?: Record<string, unknown>;
  diagnosis?: string;
  entryMileage?: number | null;
  customerComplaint?: string | null;
  receptionNotes?: string | null;
  recommendedService?: string | null;
  expectedDeliveryAt?: string | null;
  paymentMethod?: PaymentMethod | null;
  paymentInstallments?: number | null;
}

export interface UpdateServiceOrderRequest {
  id: string;
  technicianId?: string;
  checklist?: Record<string, unknown>;
  diagnosis?: string;
  entryMileage?: number | null;
  customerComplaint?: string | null;
  receptionNotes?: string | null;
  recommendedService?: string | null;
  expectedDeliveryAt?: string | null;
  paymentMethod?: PaymentMethod | null;
  paymentInstallments?: number | null;
}

export interface TransitionServiceOrderRequest {
  id: string;
  toStatus: ServiceOrderStatus;
  authorization?: 'CUSTOMER_MESSAGE' | 'MANUAL';
}

export interface DeleteServiceOrderRequest {
  id: string;
}

export interface ServiceOrderListRequest extends PageableRequest {
  // Calendar dates in America/Sao_Paulo, inclusive on both ends.
  startDate?: string;
  endDate?: string;
  dateField?: 'OPENED' | 'CLOSED';
  attention?: 'ACTIVE' | 'OVERDUE' | 'UNASSIGNED' | 'PAYMENT_PENDING';
  includeMetrics?: boolean;
  status?: ServiceOrderStatus;
  vehicleId?: string;
  technicianId?: string;
  // Feature 6 (Cadastro de Cliente Expandido) — aba Histórico do cliente.
  customerId?: string;
  // Casa número da OS, placa/marca/modelo do veículo e nome/documento do
  // cliente — usado pela busca global do cabeçalho.
  search?: string;
}
