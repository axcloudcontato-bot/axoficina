export const CUSTOMER_TYPES = ['PF', 'PJ'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_CONTACT_CHANNELS = ['PHONE', 'WHATSAPP', 'EMAIL', 'SMS'] as const;
export type CustomerContactChannel = (typeof CUSTOMER_CONTACT_CHANNELS)[number];

export const CUSTOMER_CONTACT_TIMES = ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'] as const;
export type CustomerContactTime = (typeof CUSTOMER_CONTACT_TIMES)[number];

export interface CustomerAddress {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface CustomerResponse {
  notifyServiceOrderUpdates?: boolean;
  id: string;
  tenantId: string;
  type: CustomerType;
  document: string;
  name: string;
  email?: string;
  phone: string;
  address?: CustomerAddress;
  notes?: string;
  // Feature 6 (Cadastro de Cliente Expandido) — todos opcionais.
  rg?: string;
  stateRegistration?: string;
  secondaryContactName?: string;
  secondaryContactPhone?: string;
  secondaryContactRelation?: string;
  preferredContactChannel?: CustomerContactChannel;
  preferredContactTime?: CustomerContactTime;
  createdAt: string;
}

export type CustomerListItemResponse = CustomerResponse;
