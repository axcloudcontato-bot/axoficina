import type { PaginationData, PageableRequest } from './response/pagination.response';
import type { ServiceOrderStatus } from './response/service-order.response';

export type ServiceOrderStatusNotificationStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
export interface ServiceOrderStatusNotificationResponse {
  id: string;
  fromStatus?: ServiceOrderStatus;
  toStatus: ServiceOrderStatus;
  status: ServiceOrderStatusNotificationStatus;
  message: string;
  recipient: string;
  failureReason?: string;
  attempts: number;
  occurredAt: string;
  sentAt?: string;
}
export interface ListServiceOrderStatusNotificationsRequest extends PageableRequest { serviceOrderId: string }
export type ServiceOrderStatusNotificationsResponse = PaginationData<ServiceOrderStatusNotificationResponse>;
export interface RetryServiceOrderStatusNotificationRequest { id: string; confirmResend: true }
