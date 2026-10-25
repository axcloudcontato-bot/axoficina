import { apiClient } from '@/lib/api/client';
import type {
  CreateServiceOrderRequest,
  DeleteServiceOrderRequest,
  ServiceOrderListRequest,
  ServiceOrderListResponse,
  ServiceOrderResponse,
  TransitionServiceOrderRequest,
  UpdateServiceOrderRequest,
  ConfirmServiceOrderReceiptRequest,
  DeleteServiceOrderReceiptRequest,
  ServiceOrderReceiptResponse,
  ConfigureServiceOrderPaymentRequest,
  ConfirmServiceOrderInstallmentRequest,
  DueServiceOrderInstallmentsResponse,
  ServiceOrderInstallmentResponse,
  ServiceOrderPhotoCategory,
  ServiceOrderPhotoAngle,
  ServiceOrderPhotoResponse,
  TechnicianProductivityRequest,
  TechnicianProductivityResponse,
} from '@oficina/contracts';

export const serviceOrdersApi = {
  async create(request: CreateServiceOrderRequest): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const response = await apiClient.post<{ serviceOrder: ServiceOrderResponse }>('/api/v1/service-orders', request);
    return response.data;
  },

  async update(request: UpdateServiceOrderRequest): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const response = await apiClient.post<{ serviceOrder: ServiceOrderResponse }>('/api/v1/service-orders/update', request);
    return response.data;
  },

  async transition(request: TransitionServiceOrderRequest): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const response = await apiClient.post<{ serviceOrder: ServiceOrderResponse }>('/api/v1/service-orders/transition', request);
    return response.data;
  },

  async delete(request: DeleteServiceOrderRequest): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const response = await apiClient.post<{ serviceOrder: ServiceOrderResponse }>('/api/v1/service-orders/delete', request);
    return response.data;
  },

  async get(id: string): Promise<{ serviceOrder: ServiceOrderResponse }> {
    const response = await apiClient.get<{ serviceOrder: ServiceOrderResponse }>('/api/v1/service-order', { params: { id } });
    return response.data;
  },

  async list(request: ServiceOrderListRequest): Promise<ServiceOrderListResponse> {
    const response = await apiClient.post<ServiceOrderListResponse>('/api/v1/service-orders/list', request);
    return response.data;
  },
  async confirmReceipt(request: ConfirmServiceOrderReceiptRequest): Promise<{ receipt: ServiceOrderReceiptResponse }> {
    return (await apiClient.post('/api/v1/service-orders/receipts', request)).data;
  },
  async deleteReceipt(request: DeleteServiceOrderReceiptRequest): Promise<{ success: true }> {
    return (await apiClient.post('/api/v1/service-orders/receipts/delete', request)).data;
  },
  async configurePayment(request: ConfigureServiceOrderPaymentRequest): Promise<{ serviceOrder: ServiceOrderResponse }> {
    return (await apiClient.post('/api/v1/service-orders/payment/configure', request)).data;
  },
  async confirmInstallment(request: ConfirmServiceOrderInstallmentRequest): Promise<{ installment: ServiceOrderInstallmentResponse }> {
    return (await apiClient.post('/api/v1/service-orders/installments/confirm', request)).data;
  },
  async dueInstallments(limit = 20): Promise<DueServiceOrderInstallmentsResponse> {
    return (await apiClient.post('/api/v1/service-orders/installments/due', { limit })).data;
  },
  async listPhotos(serviceOrderId: string): Promise<{ photos: ServiceOrderPhotoResponse[] }> {
    // `params` do axios não passa pelo interceptor de conversão pra
    // snake_case (só converte `data`, o body) — igual brand_id em
    // fipe-api.ts, mas aqui o DTO (ListServiceOrderPhotosDto) valida
    // `serviceOrderId` puro, sem @Expose({name}), então tem que ir
    // literal camelCase.
    return (await apiClient.get('/api/v1/service-orders/photos', { params: { serviceOrderId } })).data;
  },
  async uploadPhoto(input: { serviceOrderId: string; category: ServiceOrderPhotoCategory; angle?: ServiceOrderPhotoAngle; serviceOrderItemId?: string; caption?: string; file: File }): Promise<{ photo: ServiceOrderPhotoResponse }> {
    const form = new FormData();
    form.append('serviceOrderId', input.serviceOrderId);
    form.append('category', input.category);
    if (input.angle) form.append('angle', input.angle);
    if (input.serviceOrderItemId) form.append('serviceOrderItemId', input.serviceOrderItemId);
    if (input.caption) form.append('caption', input.caption);
    form.append('file', input.file);
    return (await apiClient.post('/api/v1/service-orders/photos', form, { timeout: 120_000 })).data;
  },
  async deletePhoto(id: string): Promise<{ success: true }> {
    return (await apiClient.post('/api/v1/service-orders/photos/delete', { id })).data;
  },
  async photoBlob(id: string): Promise<Blob> {
    return (await apiClient.get('/api/v1/service-orders/photos/content', { params: { id }, responseType: 'blob' })).data;
  },
  async technicianProductivity(request: TechnicianProductivityRequest): Promise<TechnicianProductivityResponse> {
    return (await apiClient.post('/api/v1/service-orders/technician-productivity', request)).data;
  },
};
