import { apiClient } from '@/lib/api/client';

export type SupportPriority = 'LOW' | 'NORMAL' | 'HIGH';
export type SupportStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export interface SupportTicket {
  id: string; tenantId: string; createdById: string; subject: string; description: string;
  priority: SupportPriority; status: SupportStatus; response: string | null;
  respondedAt: string | null; createdAt: string; updatedAt: string;
  tenantName?: string; authorName?: string; authorEmail?: string | null;
}

export const supportApi = {
  async mine(offset: number) { return (await apiClient.get<{ items: SupportTicket[]; total: number }>('/api/v1/support/tickets', { params: { offset } })).data; },
  async create(input: { subject: string; description: string; priority: SupportPriority }) { return (await apiClient.post<SupportTicket>('/api/v1/support/tickets', input)).data; },
  async adminList(params: { status?: SupportStatus; offset: number }) { return (await apiClient.get<{ items: SupportTicket[]; total: number }>('/api/v1/admin/support/tickets', { params })).data; },
  async adminUpdate(id: string, input: { status: SupportStatus; response?: string }) { return (await apiClient.patch<SupportTicket>(`/api/v1/admin/support/tickets/${id}`, input)).data; },
};

export const PRIORITY_LABELS: Record<SupportPriority, string> = { LOW: 'Baixa', NORMAL: 'Normal', HIGH: 'Alta' };
export const STATUS_LABELS: Record<SupportStatus, string> = { OPEN: 'Aberto', IN_PROGRESS: 'Em atendimento', RESOLVED: 'Resolvido' };
