import type { PlanStatusResponse } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const planApi = {
  async current(): Promise<PlanStatusResponse> {
    return (await apiClient.get<PlanStatusResponse>('/api/v1/plan')).data;
  },
};
