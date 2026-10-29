'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCatalogItemRequest, UpdateCatalogItemRequest } from '@oficina/contracts';
import { catalogApi } from '../api/catalog-api';

const KEY = 'catalog-items';

export function useCatalogItems(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: [KEY], queryFn: catalogApi.list, enabled: options?.enabled });
}
export function useCreateCatalogItem() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (request: CreateCatalogItemRequest) => catalogApi.create(request), onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}
export function useUpdateCatalogItem() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (request: UpdateCatalogItemRequest) => catalogApi.update(request), onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}
export function useDeleteCatalogItem() {
  const client = useQueryClient();
  return useMutation({ mutationFn: catalogApi.remove, onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}
export function useSeedCatalogDefaults() {
  const client = useQueryClient();
  return useMutation({ mutationFn: catalogApi.seedDefaults, onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}
