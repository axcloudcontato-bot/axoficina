'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CareDashboardResponse, CarePreviewRequest, CarePreviewResponse, CareSettings, RecordCareServiceRequest } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export function useCustomerCare(planOffset: number, deliveryOffset: number, enabled: boolean) {
  return useQuery({ queryKey: ['customer-care', planOffset, deliveryOffset], queryFn: async () => (await apiClient.get<CareDashboardResponse>('/api/v1/customer-care', { params: { planOffset, deliveryOffset } })).data, enabled, refetchInterval: 30_000 });
}
export function useSaveCareSettings() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (input: CareSettings) => (await apiClient.post<CareSettings>('/api/v1/customer-care/settings', input)).data,
    onSuccess: async settings => { client.setQueriesData<CareDashboardResponse>({ queryKey: ['customer-care'] }, old => old ? { ...old, settings } : old); await client.invalidateQueries({ queryKey: ['customer-care'] }); } });
}
export function useRecordCareService() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (input: RecordCareServiceRequest) => apiClient.post('/api/v1/customer-care/services', input), onSuccess: () => client.invalidateQueries({ queryKey: ['customer-care'] }) });
}
export function useCarePreview() { return useMutation({ mutationFn: async (input: CarePreviewRequest) => (await apiClient.post<CarePreviewResponse>('/api/v1/customer-care/preview', input)).data }); }
export function useRetryCareDelivery() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => apiClient.post('/api/v1/customer-care/retry', { id }), onSuccess: () => client.invalidateQueries({ queryKey: ['customer-care'] }) });
}
