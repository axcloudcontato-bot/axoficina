'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCustomerRequest, CustomerListRequest, DeleteCustomerRequest, UpdateCustomerRequest } from '@oficina/contracts';
import { customersApi } from '../api/customers-api';

const CUSTOMERS_LIST_KEY = 'customers-list';

export function useCustomersList(request: CustomerListRequest, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [CUSTOMERS_LIST_KEY, request],
    queryFn: () => customersApi.list(request),
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled ?? true,
  });
}

export function useCustomer(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateCustomerRequest) => customersApi.create(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_LIST_KEY] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateCustomerRequest) => customersApi.update(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_LIST_KEY] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: DeleteCustomerRequest) => customersApi.delete(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_LIST_KEY] });
    },
  });
}

export function useRestoreCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => customersApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_LIST_KEY] });
    },
  });
}

// What archiving would leave hanging; only asked while the confirmation is open.
export function useCustomerArchiveImpact(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['customer-archive-impact', id],
    queryFn: () => customersApi.archiveImpact(id as string),
    enabled: enabled && Boolean(id),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useCustomerOverview(id: string) {
  return useQuery({
    queryKey: ['customer-overview', id],
    queryFn: () => customersApi.overview(id),
    enabled: Boolean(id),
  });
}
