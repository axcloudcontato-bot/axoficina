import type { CompanySettingsResponse } from '../response/settings.response';

export type UpdateCompanySettingsRequest = CompanySettingsResponse;

export interface UpdateEmailSettingsRequest {
  host?: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  enabled: boolean;
}

export interface TestEmailSettingsRequest {
  recipient: string;
}

export interface SendEmailRequest {
  recipient: string;
  subject: string;
  text: string;
}

export interface UpdatePhotoPolicyRequest {
  entry: boolean;
  exit: boolean;
  items: boolean;
}

export interface UpdateAgendaHoursRequest {
  openHour: number;
  closeHour: number;
  workDays: number[];
  bays?: number | null;
  remindersEnabled?: boolean;
}

export interface UpdateLaborRateRequest {
  // Price of one technician hour in cents; null clears it.
  laborRateCents: number | null;
}
