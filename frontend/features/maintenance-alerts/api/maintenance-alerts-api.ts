import { apiClient } from '@/lib/api/client';
import type {
  DismissMaintenanceAlertRequest,
  MaintenanceAlertContactResponse,
  RecordMaintenanceAlertContactRequest,
  MaintenanceAlertListItemResponse,
  MaintenanceAlertListRequest,
  MaintenanceAlertResponse,
  PaginationData,
  ReopenMaintenanceAlertRequest,
  ResolveMaintenanceAlertRequest,
  SnoozeMaintenanceAlertRequest,
} from '@oficina/contracts';

export const maintenanceAlertsApi = {
  async list(request: MaintenanceAlertListRequest): Promise<PaginationData<MaintenanceAlertListItemResponse>> {
    const response = await apiClient.post<PaginationData<MaintenanceAlertListItemResponse>>('/api/v1/maintenance-alerts/list', request);
    return response.data;
  },

  async resolve(request: ResolveMaintenanceAlertRequest): Promise<{ alert: MaintenanceAlertResponse }> {
    const response = await apiClient.post<{ alert: MaintenanceAlertResponse }>('/api/v1/maintenance-alerts/resolve', request);
    return response.data;
  },

  async snooze(request: SnoozeMaintenanceAlertRequest): Promise<{ alert: MaintenanceAlertResponse }> {
    const response = await apiClient.post<{ alert: MaintenanceAlertResponse }>('/api/v1/maintenance-alerts/snooze', request);
    return response.data;
  },

  async dismiss(request: DismissMaintenanceAlertRequest): Promise<{ alert: MaintenanceAlertResponse }> {
    const response = await apiClient.post<{ alert: MaintenanceAlertResponse }>('/api/v1/maintenance-alerts/dismiss', request);
    return response.data;
  },

  async reopen(request: ReopenMaintenanceAlertRequest): Promise<{ alert: MaintenanceAlertResponse }> {
    const response = await apiClient.post<{ alert: MaintenanceAlertResponse }>('/api/v1/maintenance-alerts/reopen', request);
    return response.data;
  },

  async recordContact(request: RecordMaintenanceAlertContactRequest): Promise<{ alert: MaintenanceAlertResponse }> {
    const response = await apiClient.post<{ alert: MaintenanceAlertResponse }>('/api/v1/maintenance-alerts/contact', request);
    return response.data;
  },

  async contacts(id: string): Promise<{ contacts: MaintenanceAlertContactResponse[] }> {
    const response = await apiClient.post<{ contacts: MaintenanceAlertContactResponse[] }>('/api/v1/maintenance-alerts/contacts', { id });
    return response.data;
  },
};
