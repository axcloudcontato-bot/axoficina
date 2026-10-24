'use client';

import { useEffect, useRef } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { hasPermission } from '@/features/auth/permissions';
import { extractErrorMessage } from '@/lib/api/client';
import { customerReplyNotificationsApi } from '../api/customer-reply-notifications-api';

export function useCustomerReplyNotifications(openNotifications: () => void) {
  const user = useAuthStore((state) => state.user);
  const enabled = hasPermission(user, 'service_orders.view') && hasPermission(user, 'service_orders.prices');
  const identity = `${user?.tenantId}:${user?.id}`;
  const queryKey = ['customer-reply-notifications', identity];
  const client = useQueryClient();
  const query = useInfiniteQuery({
    queryKey, queryFn: ({ pageParam }) => customerReplyNotificationsApi.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor,
    enabled, refetchInterval: 10_000,
  });
  const baseline = useRef<{ identity: string; latest: string } | null>(null);
  useEffect(() => {
    if (!enabled || !query.data) return;
    const first = query.data.pages[0];
    const latest = first.items[0] ? `${first.items[0].answeredAt}/${first.items[0].id}` : '';
    const action = { label: 'Ver notificações', onClick: openNotifications };
    if (baseline.current?.identity !== identity) {
      baseline.current = { identity, latest };
      if (first.unreadCount) toast.info(`Você tem ${first.unreadCount} ${first.unreadCount === 1 ? 'resposta de cliente não lida' : 'respostas de clientes não lidas'}.`, { action });
      return;
    }
    // Only newer responses on the first page trigger a toast. Loading older
    // history, marking read and refetching the same callback never repeat it.
    const newest = first.items.filter((item) => !item.readAt && `${item.answeredAt}/${item.id}` > baseline.current!.latest);
    if (latest > baseline.current.latest) baseline.current.latest = latest;
    if (!newest.length) return;
    void client.invalidateQueries({ queryKey: ['customer-messages'] });
    const reply = newest[0];
    toast.info(newest.length === 1 ? `${reply.customerName} respondeu à OS #${String(reply.orderNumber).padStart(5, '0')}` : `${newest.length} novas respostas de clientes`, {
      description: newest.length === 1 ? reply.selectedOption : 'Abra as notificações para conferir as escolhas.', action, duration: 8_000,
    });
  }, [enabled, identity, query.data, client, openNotifications]);
  const markRead = useMutation({
    mutationFn: customerReplyNotificationsApi.markRead,
    onSuccess: () => client.invalidateQueries({ queryKey }),
    onError: (error) => toast.error(extractErrorMessage(error, 'Não foi possível marcar a notificação como lida.')),
  });
  return {
    ...query, enabled, items: enabled ? query.data?.pages.flatMap((page) => page.items) ?? [] : [],
    unreadCount: enabled ? query.data?.pages[0].unreadCount ?? 0 : 0,
    markRead: markRead.mutate, markingRead: markRead.isPending,
  };
}
