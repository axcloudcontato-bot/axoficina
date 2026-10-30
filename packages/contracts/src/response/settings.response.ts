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
  lastTestAt?: string;
  lastSuccessAt?: string;
  lastTestError?: string;
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
  // Weekdays with their own hours ("6" = Saturday until noon); the others use openHour and closeHour.
  dayHours?: Record<string, DayHours>;
  // YYYY-MM-DD dates the workshop is closed: holidays, collective vacation.
  closedDates?: string[];
}

export interface DayHours {
  openHour: number;
  closeHour: number;
}

// What every new order and printed document starts with.
export interface OrderDefaults {
  defaultWarrantyDays: number | null;
  quoteValidityDays: number | null;
  documentTerms: string | null;
  // Empty = all methods.
  acceptedPaymentMethods: string[];
}
export const DEFAULT_ORDER_DEFAULTS: OrderDefaults = { defaultWarrantyDays: null, quoteValidityDays: null, documentTerms: null, acceptedPaymentMethods: [] };
export const DEFAULT_AGENDA_HOURS: AgendaHours = { openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5, 6], bays: null, remindersEnabled: false };
