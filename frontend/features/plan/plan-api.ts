import type { EntitlementsResponse } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const planApi = {
  async current(): Promise<EntitlementsResponse> {
    return (await apiClient.get<EntitlementsResponse>('/api/v1/plan')).data;
  },
};
