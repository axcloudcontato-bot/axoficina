'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboard-api';

export function useDashboardBusinessSummary(enabled = true) {
  return useQuery({
    queryKey: ['dashboard-business-summary'],
    queryFn: dashboardApi.businessSummary,
    enabled,
  });
}

export function useDashboardToday(range: { startsAt: string; endsAt: string }) {
  return useQuery({ queryKey: ['dashboard-today', range], queryFn: () => dashboardApi.today(range) });
}
