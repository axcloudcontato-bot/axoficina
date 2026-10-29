'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { MaintenanceAlertListItemResponse, MaintenanceAlertListRequest, PaginationData } from '@oficina/contracts';
import { maintenanceAlertsApi } from '../api/maintenance-alerts-api';

const MAINTENANCE_ALERTS_LIST_KEY = 'maintenance-alerts-list';

export function useMaintenanceAlertsList(request: MaintenanceAlertListRequest) {
  return useQuery({
    queryKey: [MAINTENANCE_ALERTS_LIST_KEY, request],
    queryFn: () => maintenanceAlertsApi.list(request),
    placeholderData: (previousData) => previousData,
  });
}

// Every action moves the alert to another list (resolved, postponed, dismissed, back to open). Optimistic
// update (FRONTEND.md): the row leaves the cached lists at once, without waiting for a full refetch, in
// whatever filter or page is cached; the other lists are marked stale and refresh when opened.
function leaveCachedLists(queryClient: QueryClient, id: string) {
  queryClient.setQueriesData<PaginationData<MaintenanceAlertListItemResponse>>({ queryKey: [MAINTENANCE_ALERTS_LIST_KEY] }, (old) => {
    if (!old) return old;
    const items = old.items.filter((item) => item.id !== id);
    if (items.length === old.items.length) return old;
    return { ...old, items, total: Math.max(0, old.total - 1) };
  });
  queryClient.invalidateQueries({ queryKey: [MAINTENANCE_ALERTS_LIST_KEY], refetchType: 'none' });
}

export function useResolveMaintenanceAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: Parameters<typeof maintenanceAlertsApi.resolve>[0]) => maintenanceAlertsApi.resolve(request),
    onSuccess: (_data, variables) => leaveCachedLists(queryClient, variables.id),
  });
}

export function useSnoozeMaintenanceAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: Parameters<typeof maintenanceAlertsApi.snooze>[0]) => maintenanceAlertsApi.snooze(request),
    onSuccess: (_data, variables) => leaveCachedLists(queryClient, variables.id),
  });
}

export function useDismissMaintenanceAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: Parameters<typeof maintenanceAlertsApi.dismiss>[0]) => maintenanceAlertsApi.dismiss(request),
    onSuccess: (_data, variables) => leaveCachedLists(queryClient, variables.id),
  });
}

export function useReopenMaintenanceAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: Parameters<typeof maintenanceAlertsApi.reopen>[0]) => maintenanceAlertsApi.reopen(request),
    onSuccess: (_data, variables) => leaveCachedLists(queryClient, variables.id),
  });
}

// An attempt to reach the customer does not move the alert to another list: the list is refetched to show the last contact.
export function useRecordMaintenanceAlertContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: Parameters<typeof maintenanceAlertsApi.recordContact>[0]) => maintenanceAlertsApi.recordContact(request),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [MAINTENANCE_ALERTS_LIST_KEY] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-alert-contacts', variables.id] });
    },
  });
}

export function useMaintenanceAlertContacts(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['maintenance-alert-contacts', id],
    queryFn: () => maintenanceAlertsApi.contacts(id as string),
    enabled: enabled && Boolean(id),
  });
}
