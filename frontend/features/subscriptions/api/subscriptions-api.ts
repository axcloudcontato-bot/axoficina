import type { SubscriptionListRequest, SubscriptionListResponse, SubscriptionResponse, UpdateSubscriptionRequest } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const subscriptionsApi = {
  async access(): Promise<{ allowed: boolean }> {
    return (await apiClient.get('/api/v1/admin/access')).data;
  },
  async list(query: SubscriptionListRequest): Promise<SubscriptionListResponse> {
    return (await apiClient.get('/api/v1/admin/subscriptions', { params: query })).data;
  },
  async update(id: string, input: UpdateSubscriptionRequest): Promise<SubscriptionResponse> {
    return (await apiClient.patch(`/api/v1/admin/subscriptions/${id}`, input)).data;
  },
};
