'use client';

import { useQuery } from '@tanstack/react-query';
import { customerMessagesApi } from '../api/customer-messages-api';

export function useCustomerMessages(serviceOrderId: string, enabled = true) {
  return useQuery({ queryKey: ['customer-messages', serviceOrderId], queryFn: () => customerMessagesApi.list(serviceOrderId), enabled, refetchInterval: 10_000 });
}
