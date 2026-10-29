import { apiClient } from '@/lib/api/client';
import type {
  CreateVehicleRequest,
  DeleteVehicleRequest,
  ImportVehiclesRequest,
  ImportVehiclesResponse,
  PaginationData,
  TransferVehicleRequest,
  VehicleOverviewResponse,
  UpdateVehicleRequest,
  VehicleArchiveImpactResponse,
  VehicleListItemResponse,
  VehicleListRequest,
  VehicleResponse,
} from '@oficina/contracts';

export const vehiclesApi = {
  async create(request: CreateVehicleRequest): Promise<{ vehicle: VehicleResponse }> {
    const response = await apiClient.post<{ vehicle: VehicleResponse }>('/api/v1/vehicles', request);
    return response.data;
  },

  async update(request: UpdateVehicleRequest): Promise<{ vehicle: VehicleResponse }> {
    const response = await apiClient.post<{ vehicle: VehicleResponse }>('/api/v1/vehicles/update', request);
    return response.data;
  },

  async delete(request: DeleteVehicleRequest): Promise<{ vehicle: VehicleResponse }> {
    const response = await apiClient.post<{ vehicle: VehicleResponse }>('/api/v1/vehicles/delete', request);
    return response.data;
  },

  async restore(id: string): Promise<{ vehicle: VehicleResponse }> {
    const response = await apiClient.post<{ vehicle: VehicleResponse }>('/api/v1/vehicles/restore', { id });
    return response.data;
  },

  async archiveImpact(id: string): Promise<VehicleArchiveImpactResponse> {
    const response = await apiClient.post<VehicleArchiveImpactResponse>('/api/v1/vehicles/archive-impact', { id });
    return response.data;
  },

  async overview(id: string): Promise<VehicleOverviewResponse> {
    const response = await apiClient.post<VehicleOverviewResponse>('/api/v1/vehicles/overview', { id });
    return response.data;
  },

  async transfer(request: TransferVehicleRequest): Promise<{ vehicle: VehicleResponse }> {
    const response = await apiClient.post<{ vehicle: VehicleResponse }>('/api/v1/vehicles/transfer', request);
    return response.data;
  },

  async importRows(request: ImportVehiclesRequest): Promise<ImportVehiclesResponse> {
    const response = await apiClient.post<ImportVehiclesResponse>('/api/v1/vehicles/import', request);
    return response.data;
  },

  async get(id: string): Promise<{ vehicle: VehicleResponse }> {
    const response = await apiClient.get<{ vehicle: VehicleResponse }>('/api/v1/vehicle', { params: { id } });
    return response.data;
  },

  async list(request: VehicleListRequest): Promise<PaginationData<VehicleListItemResponse>> {
    const response = await apiClient.post<PaginationData<VehicleListItemResponse>>('/api/v1/vehicles/list', request);
    return response.data;
  },
};
