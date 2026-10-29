import type { DashboardBusinessSummaryResponse, DashboardTodayResponse } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const dashboardApi = {
  async today(range: { startsAt: string; endsAt: string }): Promise<DashboardTodayResponse> {
    return (await apiClient.get<DashboardTodayResponse>('/api/v1/dashboard/today', { params: range })).data;
  },
  async businessSummary(): Promise<DashboardBusinessSummaryResponse> {
    return (await apiClient.get<DashboardBusinessSummaryResponse>('/api/v1/dashboard/business-summary')).data;
  },
};
