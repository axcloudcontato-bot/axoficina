'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCatalogItemRequest, UpdateCatalogItemRequest } from '@oficina/contracts';
import { catalogApi } from '../api/catalog-api';

const KEY = 'catalog-items';
const PACKAGES_KEY = 'catalog-packages';
const REPORT_KEY = 'catalog-report';

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
export function useAdjustStock() {
  const client = useQueryClient();
  return useMutation({ mutationFn: catalogApi.adjustStock, onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}
export function useImportCatalog() {
  const client = useQueryClient();
  return useMutation({ mutationFn: catalogApi.importRows, onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}
export function useCatalogPackages(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: [PACKAGES_KEY], queryFn: catalogApi.packages, enabled: options?.enabled });
}
export function useSaveCatalogPackage() {
  const client = useQueryClient();
  return useMutation({ mutationFn: catalogApi.savePackage, onSuccess: () => client.invalidateQueries({ queryKey: [PACKAGES_KEY] }) });
}
export function useDeleteCatalogPackage() {
  const client = useQueryClient();
  return useMutation({ mutationFn: catalogApi.removePackage, onSuccess: () => client.invalidateQueries({ queryKey: [PACKAGES_KEY] }) });
}
export function useCatalogReport(days: number) {
  return useQuery({ queryKey: [REPORT_KEY, days], queryFn: () => catalogApi.report(days) });
}
