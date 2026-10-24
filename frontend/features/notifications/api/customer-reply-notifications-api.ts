import type { CustomerReplyNotificationsResponse } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const customerReplyNotificationsApi = {
  async list(cursor?: string) {
    return (await apiClient.get<CustomerReplyNotificationsResponse>('/api/v1/customer-reply-notifications', { params: { cursor } })).data;
  },
  async markRead(id: string) {
    return (await apiClient.post<{ read: boolean }>(`/api/v1/customer-reply-notifications/${id}/read`)).data;
  },
};
