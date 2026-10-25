import type { ListServiceOrderStatusNotificationsRequest, RetryServiceOrderStatusNotificationRequest, ServiceOrderStatusNotificationsResponse } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const statusNotificationsApi = {
  async list(request: ListServiceOrderStatusNotificationsRequest) {
    return (await apiClient.post<ServiceOrderStatusNotificationsResponse>('/api/v1/service-orders/status-notifications/list', request)).data;
  },
  async retry(request: RetryServiceOrderStatusNotificationRequest) {
    return (await apiClient.post<{ queued: boolean }>('/api/v1/service-orders/status-notifications/retry', request)).data;
  },
};
