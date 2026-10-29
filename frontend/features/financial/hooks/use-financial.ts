'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateFinancialCategoryRequest, CreateFinancialEntryRequest, CreateSupplierRequest, ListFinancialEntriesRequest, UpdateSupplierRequest } from '@oficina/contracts';
import { financialApi } from '../api/financial-api';

const KEY = 'financial-core';
export function useFinancialCategories() { return useQuery({ queryKey: [KEY, 'categories'], queryFn: financialApi.categories }); }
export function useCashFlow(request: ListFinancialEntriesRequest, options?: { enabled?: boolean }) { return useQuery({ queryKey: [KEY, 'cash-flow', request], queryFn: () => financialApi.cashFlow(request), enabled: options?.enabled }); }
export function useCreateFinancialCategory() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (request: CreateFinancialCategoryRequest) => financialApi.createCategory(request), onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}
export function useDeleteFinancialCategory() {
  const client = useQueryClient();
  return useMutation({ mutationFn: financialApi.deleteCategory, onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}
export function useCreateFinancialEntry() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (request: CreateFinancialEntryRequest) => financialApi.createEntry(request), onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}
export function useSettleFinancialEntry() {
  const client = useQueryClient();
  return useMutation({ mutationFn: financialApi.settleEntry, onSuccess: () => { client.invalidateQueries({ queryKey: [KEY] }); client.invalidateQueries({ queryKey: ['dashboard-business-summary'] }); } });
}
export function useDeleteFinancialEntry() {
  const client = useQueryClient();
  return useMutation({ mutationFn: financialApi.deleteEntry, onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}
export function useSuppliers(enabled = true) { return useQuery({ queryKey: [KEY, 'suppliers'], queryFn: financialApi.suppliers, enabled }); }
export function useCreateSupplier() { const client = useQueryClient(); return useMutation({ mutationFn: (request: CreateSupplierRequest) => financialApi.createSupplier(request), onSuccess: () => client.invalidateQueries({ queryKey: [KEY, 'suppliers'] }) }); }
export function useUpdateSupplier() { const client = useQueryClient(); return useMutation({ mutationFn: (request: UpdateSupplierRequest) => financialApi.updateSupplier(request), onSuccess: () => client.invalidateQueries({ queryKey: [KEY, 'suppliers'] }) }); }
export function useDeleteSupplier() { const client = useQueryClient(); return useMutation({ mutationFn: financialApi.deleteSupplier, onSuccess: () => client.invalidateQueries({ queryKey: [KEY, 'suppliers'] }) }); }
