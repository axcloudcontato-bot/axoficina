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
