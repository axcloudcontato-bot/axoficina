'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CareDashboardResponse, CareDeliveriesRequest, CareDeliveriesResponse, CareForecastResponse, CarePlanContactsResponse, CarePlansRequest, CarePlansResponse, CareTestSendRequest, RecordCarePlanContactRequest, CarePreviewRequest, CarePreviewResponse, CareSettings, RecordCareServiceRequest, ResolveCareDeliveryRequest } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export function useCustomerCare(planOffset: number, deliveryOffset: number, enabled: boolean) {
  return useQuery({ queryKey: ['customer-care', planOffset, deliveryOffset], queryFn: async () => (await apiClient.get<CareDashboardResponse>('/api/v1/customer-care', { params: { planOffset, deliveryOffset } })).data, enabled, refetchInterval: 30_000 });
}
export function useCareForecast(enabled: boolean) {
  return useQuery({ queryKey: ['customer-care-forecast'], queryFn: async () => (await apiClient.get<CareForecastResponse>('/api/v1/customer-care/forecast')).data, enabled, staleTime: 60_000 });
}
export function useSaveCareSettings() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (input: CareSettings) => (await apiClient.post<CareSettings>('/api/v1/customer-care/settings', input)).data,
    onSuccess: async settings => { client.setQueriesData<CareDashboardResponse>({ queryKey: ['customer-care'] }, old => old ? { ...old, settings } : old); await client.invalidateQueries({ queryKey: ['customer-care'] }); } });
}
export function useRecordCareService() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (input: RecordCareServiceRequest) => apiClient.post('/api/v1/customer-care/services', input), onSuccess: () => { client.invalidateQueries({ queryKey: ['customer-care'] }); client.invalidateQueries({ queryKey: ['customer-care-plans'] }); client.invalidateQueries({ queryKey: ['vehicle-overview'] }); } });
}
export function useCarePreview() { return useMutation({ mutationFn: async (input: CarePreviewRequest) => (await apiClient.post<CarePreviewResponse>('/api/v1/customer-care/preview', input)).data }); }
export function useRetryCareDelivery() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (id: string) => apiClient.post('/api/v1/customer-care/retry', { id }), onSuccess: () => { client.invalidateQueries({ queryKey: ['customer-care'] }); client.invalidateQueries({ queryKey: ['customer-care-deliveries'] }); } });
}
export function useCarePlans(request: CarePlansRequest, enabled: boolean) {
  return useQuery({ queryKey: ['customer-care-plans', request], queryFn: async () => (await apiClient.get<CarePlansResponse>('/api/v1/customer-care/plans', { params: request })).data, enabled, placeholderData: previous => previous });
}
// A delivery whose result is unknown: the team says whether it arrived (it becomes sent) or not (it can be tried again).
export function useResolveCareDelivery() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (input: ResolveCareDeliveryRequest) => apiClient.post('/api/v1/customer-care/deliveries/resolve', input), onSuccess: () => { client.invalidateQueries({ queryKey: ['customer-care'] }); client.invalidateQueries({ queryKey: ['customer-care-deliveries'] }); } });
}
export function useCareDeliveries(request: CareDeliveriesRequest, enabled: boolean) {
  return useQuery({ queryKey: ['customer-care-deliveries', request], queryFn: async () => (await apiClient.get<CareDeliveriesResponse>('/api/v1/customer-care/deliveries', { params: request })).data, enabled, placeholderData: previous => previous, refetchInterval: 30_000 });
}
// The team reaching a customer by hand about a care plan; the queue is refetched to show the last attempt.
export function useRecordCarePlanContact() {
  const client = useQueryClient();
  return useMutation({ mutationFn: async (input: RecordCarePlanContactRequest) => apiClient.post('/api/v1/customer-care/plans/contact', input), onSuccess: (_data, input) => { client.invalidateQueries({ queryKey: ['customer-care-plans'] }); client.invalidateQueries({ queryKey: ['customer-care-plan-contacts', input.id] }); } });
}
export function useCarePlanContacts(id: string | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['customer-care-plan-contacts', id], queryFn: async () => (await apiClient.post<CarePlanContactsResponse>('/api/v1/customer-care/plans/contacts', { id })).data, enabled: enabled && Boolean(id) });
}
export function useCareTestSend() {
  return useMutation({ mutationFn: async (input: CareTestSendRequest) => (await apiClient.post<{ sent: boolean }>('/api/v1/customer-care/test-send', input)).data });
}
