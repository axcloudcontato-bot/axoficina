import type { AdminCloseRequest, AdminPurgeRequest, CloseAccountRequest, CloseAccountResponse } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const accountClosureApi = {
  // The workshop's own administrator.
  async closeOwn(request: CloseAccountRequest): Promise<CloseAccountResponse> {
    return (await apiClient.post<CloseAccountResponse>('/api/v1/account/close', request)).data;
  },
  // The SaaS manager.
  async adminClose(id: string, request: AdminCloseRequest): Promise<CloseAccountResponse> {
    return (await apiClient.post<CloseAccountResponse>(`/api/v1/admin/subscriptions/${id}/close`, request)).data;
  },
  async adminRestore(id: string): Promise<void> {
    await apiClient.post(`/api/v1/admin/subscriptions/${id}/restore`);
  },
  async adminPurge(id: string, request: AdminPurgeRequest): Promise<void> {
    await apiClient.post(`/api/v1/admin/subscriptions/${id}/purge`, request);
  },
};
