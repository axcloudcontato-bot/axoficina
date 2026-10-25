'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubscriptionListRequest, UpdateSubscriptionRequest } from '@oficina/contracts';
import { useAuthStore } from '@/stores/auth-store';
import { subscriptionsApi } from '../api/subscriptions-api';

export function useSaasAdminAccess() {
  const userId = useAuthStore((state) => state.user?.id);
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({ queryKey: ['saas-admin-access', userId], queryFn: subscriptionsApi.access, enabled: Boolean(userId && token), staleTime: 60_000, retry: false });
}

export function useSubscriptions(query: SubscriptionListRequest, enabled: boolean) {
  const userId = useAuthStore((state) => state.user?.id);
  return useQuery({ queryKey: ['saas-subscriptions', userId, query], queryFn: () => subscriptionsApi.list(query), enabled, retry: false });
}

export function useUpdateSubscription() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSubscriptionRequest }) => subscriptionsApi.update(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['saas-subscriptions'] }),
  });
}
