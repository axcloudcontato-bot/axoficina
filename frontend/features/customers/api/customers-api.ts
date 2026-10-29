import { apiClient } from '@/lib/api/client';
import type {
  CreateCustomerRequest,
  CustomerArchiveImpactResponse,
  CustomerListItemResponse,
  CustomerListRequest,
  CustomerOverviewResponse,
  CustomerResponse,
  ImportCustomersRequest,
  ImportCustomersResponse,
  MergeCustomersRequest,
  MergeCustomersResponse,
  DeleteCustomerRequest,
  PaginationData,
  UpdateCustomerRequest,
} from '@oficina/contracts';

export const customersApi = {
  async create(request: CreateCustomerRequest): Promise<{ customer: CustomerResponse }> {
    const response = await apiClient.post<{ customer: CustomerResponse }>('/api/v1/customers', request);
    return response.data;
  },

  async update(request: UpdateCustomerRequest): Promise<{ customer: CustomerResponse }> {
    const response = await apiClient.post<{ customer: CustomerResponse }>('/api/v1/customers/update', request);
    return response.data;
  },

  async delete(request: DeleteCustomerRequest): Promise<{ customer: CustomerResponse }> {
    const response = await apiClient.post<{ customer: CustomerResponse }>('/api/v1/customers/delete', request);
    return response.data;
  },

  async restore(id: string): Promise<{ customer: CustomerResponse }> {
    const response = await apiClient.post<{ customer: CustomerResponse }>('/api/v1/customers/restore', { id });
    return response.data;
  },

  async archiveImpact(id: string): Promise<CustomerArchiveImpactResponse> {
    const response = await apiClient.post<CustomerArchiveImpactResponse>('/api/v1/customers/archive-impact', { id });
    return response.data;
  },

  async overview(id: string): Promise<CustomerOverviewResponse> {
    const response = await apiClient.post<CustomerOverviewResponse>('/api/v1/customers/overview', { id });
    return response.data;
  },

  async merge(request: MergeCustomersRequest): Promise<MergeCustomersResponse> {
    const response = await apiClient.post<MergeCustomersResponse>('/api/v1/customers/merge', request);
    return response.data;
  },

  async importRows(request: ImportCustomersRequest): Promise<ImportCustomersResponse> {
    const response = await apiClient.post<ImportCustomersResponse>('/api/v1/customers/import', request);
    return response.data;
  },

  async get(id: string): Promise<{ customer: CustomerResponse }> {
    const response = await apiClient.get<{ customer: CustomerResponse }>('/api/v1/customer', { params: { id } });
    return response.data;
  },

  async list(request: CustomerListRequest): Promise<PaginationData<CustomerListItemResponse>> {
    const response = await apiClient.post<PaginationData<CustomerListItemResponse>>('/api/v1/customers/list', request);
    return response.data;
  },
};
