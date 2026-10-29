export const CUSTOMER_TYPES = ['PF', 'PJ'] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const CUSTOMER_CONTACT_CHANNELS = ['PHONE', 'WHATSAPP', 'EMAIL', 'SMS'] as const;
export type CustomerContactChannel = (typeof CUSTOMER_CONTACT_CHANNELS)[number];

export const CUSTOMER_CONTACT_TIMES = ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'] as const;
export type CustomerContactTime = (typeof CUSTOMER_CONTACT_TIMES)[number];

// How the customer gave the consent to receive care messages.
export const CUSTOMER_CONSENT_SOURCES = ['COUNTER', 'PHONE', 'WHATSAPP', 'SITE', 'OTHER'] as const;
export type CustomerConsentSource = (typeof CUSTOMER_CONSENT_SOURCES)[number];
export const CUSTOMER_CONSENT_SOURCE_LABELS: Record<CustomerConsentSource, string> = {
  COUNTER: 'No balcão',
  PHONE: 'Por telefone',
  WHATSAPP: 'Por WhatsApp',
  SITE: 'Pelo site ou formulário',
  OTHER: 'Outro meio',
};

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
  birthDate?: string;
  careMessagesEnabled?: boolean;
  careConsentAt?: string;
  careConsentSource?: CustomerConsentSource;
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
  // Set only for archived customers.
  archivedAt?: string;
}

// What the list shows next to each customer. Money only for people who may see prices.
export interface CustomerListStats {
  plates: string[];
  orderCount: number;
  lastVisitAt?: string;
  totalSpentCents?: number;
}
export type CustomerListItemResponse = CustomerResponse & { stats?: CustomerListStats };

export interface CustomerOverviewResponse {
  vehicles: Array<{ id: string; brand: string; model: string; plate: string; year?: number; mileage?: number }>;
  // Orders that were not cancelled; "delivered" are the ones the customer paid for and took home.
  orderCount: number;
  deliveredCount: number;
  lastVisitAt?: string;
  openServiceOrders: Array<{ id: string; orderNumber: number; status: string; vehicleLabel: string }>;
  upcomingAppointments: Array<{ id: string; startsAt: string; status: string; serviceDescription: string }>;
  // Only for people who may see prices.
  money?: { totalSpentCents: number; averageTicketCents: number; pendingCents: number };
}

// What archiving a customer would leave hanging, so the person decides knowing it.
export interface CustomerArchiveImpactResponse {
  openServiceOrders: number;
  pendingCents: number;
}

export interface MergeCustomersResponse {
  customer: CustomerResponse;
  movedVehicles: number;
  movedServiceOrders: number;
}

export interface ImportCustomersProblem { line: number; name: string; reason: string }
export interface ImportCustomersResponse {
  created: number;
  // Rows that were not imported, with the reason (invalid data or already registered).
  problems: ImportCustomersProblem[];
}
