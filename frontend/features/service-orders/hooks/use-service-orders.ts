'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateServiceOrderRequest,
  DeleteServiceOrderRequest,
  ServiceOrderListRequest,
  TransitionServiceOrderRequest,
  UpdateServiceOrderRequest,
  ConfirmServiceOrderReceiptRequest,
  DeleteServiceOrderReceiptRequest,
  ConfigureServiceOrderPaymentRequest,
  ConfirmServiceOrderInstallmentRequest,
  ServiceOrderPhotoCategory,
  ServiceOrderPhotoAngle,
  ServiceOrderPhotoResponse,
  TechnicianProductivityRequest,
} from '@oficina/contracts';
import { serviceOrdersApi } from '../api/service-orders-api';

const SERVICE_ORDERS_LIST_KEY = 'service-orders-list';
const SERVICE_ORDER_KEY = 'service-order';

// `enabled` (default true) — Feature 6 (Cadastro de Cliente Expandido)
// usa isso pra nunca chamar a API na aba Histórico em modo criação, onde
// ainda não existe um customerId válido pra filtrar.
export function useServiceOrdersList(request: ServiceOrderListRequest, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [SERVICE_ORDERS_LIST_KEY, request],
    queryFn: () => serviceOrdersApi.list(request),
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled ?? true,
  });
}

export function useServiceOrder(id: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: [SERVICE_ORDER_KEY, id],
    queryFn: () => serviceOrdersApi.get(id),
    enabled: Boolean(id),
    refetchInterval: options?.refetchInterval,
  });
}

export function useCreateServiceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateServiceOrderRequest) => serviceOrdersApi.create(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_ORDERS_LIST_KEY] });
    },
  });
}

export function useUpdateServiceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateServiceOrderRequest) => serviceOrdersApi.update(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_ORDERS_LIST_KEY] });
      queryClient.invalidateQueries({ queryKey: [SERVICE_ORDER_KEY, data.serviceOrder.id] });
    },
  });
}

export function useTransitionServiceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: TransitionServiceOrderRequest) => serviceOrdersApi.transition(request),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_ORDERS_LIST_KEY] });
      queryClient.invalidateQueries({ queryKey: [SERVICE_ORDER_KEY, data.serviceOrder.id] });
    },
  });
}

export function useDeleteServiceOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: DeleteServiceOrderRequest) => serviceOrdersApi.delete(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SERVICE_ORDERS_LIST_KEY] });
    },
  });
}

export function useConfirmServiceOrderReceipt() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: ConfirmServiceOrderReceiptRequest) => serviceOrdersApi.confirmReceipt(request),
    onSuccess: (_, request) => {
      client.invalidateQueries({ queryKey: [SERVICE_ORDER_KEY, request.serviceOrderId] });
      client.invalidateQueries({ queryKey: ['dashboard-business-summary'] });
    },
  });
}

export function useDeleteServiceOrderReceipt(serviceOrderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: DeleteServiceOrderReceiptRequest) => serviceOrdersApi.deleteReceipt(request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [SERVICE_ORDER_KEY, serviceOrderId] });
      client.invalidateQueries({ queryKey: ['dashboard-business-summary'] });
    },
  });
}

export function useConfigureServiceOrderPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: ConfigureServiceOrderPaymentRequest) => serviceOrdersApi.configurePayment(request),
    onSuccess: (_, request) => {
      client.invalidateQueries({ queryKey: [SERVICE_ORDER_KEY, request.serviceOrderId] });
      client.invalidateQueries({ queryKey: ['due-service-order-installments'] });
      client.invalidateQueries({ queryKey: ['dashboard-business-summary'] });
    },
  });
}

export function useConfirmServiceOrderInstallment(serviceOrderId?: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: ConfirmServiceOrderInstallmentRequest) => serviceOrdersApi.confirmInstallment(request),
    onSuccess: () => {
      if (serviceOrderId) client.invalidateQueries({ queryKey: [SERVICE_ORDER_KEY, serviceOrderId] });
      client.invalidateQueries({ queryKey: ['due-service-order-installments'] });
      client.invalidateQueries({ queryKey: ['dashboard-business-summary'] });
    },
  });
}

export function useDueServiceOrderInstallments(limit = 20) {
  return useQuery({
    queryKey: ['due-service-order-installments', limit],
    queryFn: () => serviceOrdersApi.dueInstallments(limit),
    enabled: limit > 0,
  });
}

export function useTechnicianProductivity(request: TechnicianProductivityRequest) {
  return useQuery({
    queryKey: ['technician-productivity', request],
    queryFn: () => serviceOrdersApi.technicianProductivity(request),
  });
}

const SERVICE_ORDER_PHOTOS_KEY = 'service-order-photos';

export function useServiceOrderPhotos(serviceOrderId: string) {
  return useQuery({ queryKey: [SERVICE_ORDER_PHOTOS_KEY, serviceOrderId], queryFn: () => serviceOrdersApi.listPhotos(serviceOrderId), enabled: Boolean(serviceOrderId) });
}

export function useServiceOrderPhotoBlob(id: string) {
  return useQuery({ queryKey: ['service-order-photo-content', id], queryFn: () => serviceOrdersApi.photoBlob(id), staleTime: 5 * 60_000 });
}

export function useUploadServiceOrderPhoto() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { serviceOrderId: string; category: ServiceOrderPhotoCategory; angle?: ServiceOrderPhotoAngle; serviceOrderItemId?: string; caption?: string; file: File }) => serviceOrdersApi.uploadPhoto(input),
    onSuccess: (data, input) => {
      const queryKey = [SERVICE_ORDER_PHOTOS_KEY, input.serviceOrderId];
      // The POST already confirms persistence. Show its result immediately;
      // a slow/offline gallery refresh must not keep the upload pending.
      client.setQueryData<{ photos: ServiceOrderPhotoResponse[] }>(queryKey, (current) => ({
        photos: [...(current?.photos.filter((photo) => photo.id !== data.photo.id) ?? []), data.photo]
          .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
      }));
      void client.invalidateQueries({ queryKey });
    },
  });
}

export function useDeleteServiceOrderPhoto(serviceOrderId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: serviceOrdersApi.deletePhoto,
    onSuccess: () => client.invalidateQueries({ queryKey: [SERVICE_ORDER_PHOTOS_KEY, serviceOrderId] }),
  });
}
