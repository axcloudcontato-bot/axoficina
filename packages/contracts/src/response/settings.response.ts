export interface CompanySettingsResponse {
  name: string;
  legalName?: string;
  document: string;
  stateRegistration?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressDistrict?: string;
  addressCity?: string;
  addressState?: string;
  addressPostalCode?: string;
  logoDataUrl?: string;
  documentFooter?: string;
}

export interface EmailSettingsResponse {
  host?: string;
  port: number;
  secure: boolean;
  username?: string;
  passwordConfigured: boolean;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  enabled: boolean;
}

export interface TenantSettingsResponse {
  company: CompanySettingsResponse;
  email: EmailSettingsResponse;
}

// Photo evidence a workshop requires before an order moves on.
export interface PhotoPolicy {
  entry: boolean;
  exit: boolean;
  items: boolean;
}
export const DEFAULT_PHOTO_POLICY: PhotoPolicy = { entry: true, exit: true, items: true };

// Opening hours of the workshop; workDays uses 0 = Sunday ... 6 = Saturday.
export interface AgendaHours {
  openHour: number;
  closeHour: number;
  workDays: number[];
  // Vehicles the workshop serves at the same time; null = not limited.
  bays?: number | null;
  // WhatsApp reminder sent the day before each appointment.
  remindersEnabled?: boolean;
}
export const DEFAULT_AGENDA_HOURS: AgendaHours = { openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5, 6], bays: null, remindersEnabled: false };
