import type { OrderDefaults, UpdateOrderDefaultsRequest, UpdateMaintenanceAlertMonthsRequest, UpdateLaborRateRequest, AgendaHours, UpdateAgendaHoursRequest, PhotoPolicy, UpdatePhotoPolicyRequest, CompanySettingsResponse, EmailSettingsResponse, SendEmailRequest, TestEmailSettingsRequest, TenantSettingsResponse, UpdateCompanySettingsRequest, UpdateEmailSettingsRequest } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';
import type { UpdateWhatsAppSettingsRequest, WhatsAppConnectionResponse, WhatsAppSettingsResponse, WhatsAppWebhookTestResponse } from '@oficina/contracts';

export const settingsApi = {
  async get(): Promise<TenantSettingsResponse> {
    return (await apiClient.get<TenantSettingsResponse>('/api/v1/settings')).data;
  },
  async branding(): Promise<{ company: CompanySettingsResponse; whatsappEnabled?: boolean; photoPolicy?: PhotoPolicy; agendaHours?: AgendaHours; laborRateCents?: number | null; maintenanceAlertMonths?: number; orderDefaults?: OrderDefaults }> {
    return (await apiClient.get<{ company: CompanySettingsResponse; whatsappEnabled?: boolean; photoPolicy?: PhotoPolicy; agendaHours?: AgendaHours; laborRateCents?: number | null; maintenanceAlertMonths?: number; orderDefaults?: OrderDefaults }>('/api/v1/settings/branding')).data;
  },
  async updateMaintenanceAlertMonths(request: UpdateMaintenanceAlertMonthsRequest): Promise<{ maintenanceAlertMonths: number }> {
    return (await apiClient.post('/api/v1/settings/maintenance-alert-months', request)).data;
  },
  async updateOrderDefaults(request: UpdateOrderDefaultsRequest): Promise<{ orderDefaults: OrderDefaults }> {
    return (await apiClient.post('/api/v1/settings/order-defaults', request)).data;
  },
  async updateLaborRate(request: UpdateLaborRateRequest): Promise<{ laborRateCents: number | null }> {
    return (await apiClient.post('/api/v1/settings/labor-rate', request)).data;
  },
  async updateAgendaHours(request: UpdateAgendaHoursRequest): Promise<{ agendaHours: AgendaHours }> {
    return (await apiClient.post('/api/v1/settings/agenda-hours', request)).data;
  },
  async updatePhotoPolicy(request: UpdatePhotoPolicyRequest): Promise<{ photoPolicy: PhotoPolicy }> {
    return (await apiClient.post('/api/v1/settings/photo-policy', request)).data;
  },
  async whatsapp(): Promise<WhatsAppSettingsResponse> { return (await apiClient.get('/api/v1/settings/whatsapp')).data; },
  async updateWhatsApp(input: UpdateWhatsAppSettingsRequest): Promise<WhatsAppSettingsResponse> { return (await apiClient.post('/api/v1/settings/whatsapp', input)).data; },
  async testWhatsApp(): Promise<WhatsAppConnectionResponse> { return (await apiClient.post('/api/v1/settings/whatsapp/test')).data; },
  async testWhatsAppWebhook(): Promise<WhatsAppWebhookTestResponse> { return (await apiClient.post('/api/v1/settings/whatsapp/webhook/test')).data; },
  async reminderHealth(): Promise<{ failed: number; lastSentAt: string | null; lastFailureAt: string | null; lastError: string | null; items: Array<{ id: string; startsAt: string; attempts: number; error: string | null }> }> {
    return (await apiClient.get('/api/v1/appointments/reminder-health')).data;
  },
  async retryReminder(id: string): Promise<{ sent: true }> {
    return (await apiClient.post('/api/v1/appointments/reminder-retry', { id })).data;
  },
  async updateCompany(request: UpdateCompanySettingsRequest): Promise<{ company: CompanySettingsResponse }> {
    return (await apiClient.post('/api/v1/settings/company', request)).data;
  },
  async updateEmail(request: UpdateEmailSettingsRequest): Promise<{ email: EmailSettingsResponse }> {
    return (await apiClient.post('/api/v1/settings/email', request)).data;
  },
  async testEmail(request: TestEmailSettingsRequest): Promise<{ sent: boolean }> {
    return (await apiClient.post('/api/v1/settings/email/test', request)).data;
  },
  async sendEmail(request: SendEmailRequest): Promise<{ sent: boolean }> {
    return (await apiClient.post('/api/v1/settings/email/send', request)).data;
  },
};
