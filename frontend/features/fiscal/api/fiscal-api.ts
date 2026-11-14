import type { CancelFiscalDocumentRequest, FiscalAttachmentResponse, FiscalDocumentKind, FiscalDocumentResponse, FiscalPreviewResponse, FiscalSettingsResponse, IssueFiscalDocumentRequest, RegisterFiscalDocumentRequest, UpdateFiscalSettingsRequest, UploadFiscalCertificateRequest } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const fiscalApi = {
  settings: async (): Promise<FiscalSettingsResponse> => (await apiClient.get('/api/v1/fiscal/settings')).data,
  updateSettings: async (request: UpdateFiscalSettingsRequest): Promise<FiscalSettingsResponse> => (await apiClient.post('/api/v1/fiscal/settings', request)).data,
  uploadCertificate: async (request: UploadFiscalCertificateRequest): Promise<FiscalSettingsResponse> => (await apiClient.post('/api/v1/fiscal/certificate', request)).data,
  list: async (serviceOrderId: string): Promise<FiscalDocumentResponse[]> => (await apiClient.post('/api/v1/fiscal/documents/list', { serviceOrderId })).data,
  preview: async (serviceOrderId: string, kind: FiscalDocumentKind): Promise<FiscalPreviewResponse> => (await apiClient.post('/api/v1/fiscal/documents/preview', { serviceOrderId, kind })).data,
  issue: async (request: IssueFiscalDocumentRequest): Promise<FiscalDocumentResponse> => (await apiClient.post('/api/v1/fiscal/documents/issue', request)).data,
  refresh: async (id: string): Promise<FiscalDocumentResponse> => (await apiClient.post('/api/v1/fiscal/documents/refresh', { id })).data,
  cancel: async (request: CancelFiscalDocumentRequest): Promise<FiscalDocumentResponse> => (await apiClient.post('/api/v1/fiscal/documents/cancel', request)).data,
  register: async (request: RegisterFiscalDocumentRequest): Promise<FiscalDocumentResponse> => (await apiClient.post('/api/v1/fiscal/documents/register', request)).data,
  remove: async (id: string): Promise<{ success: true }> => (await apiClient.post('/api/v1/fiscal/documents/delete', { id })).data,
  attachment: async (id: string): Promise<FiscalAttachmentResponse> => (await apiClient.post('/api/v1/fiscal/documents/attachment', { id })).data,
};
