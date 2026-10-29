import type { PageableRequest } from '../response/pagination.response';
import type { CustomerAddress, CustomerConsentSource, CustomerContactChannel, CustomerContactTime, CustomerType } from '../response/customer.response';

export interface CreateCustomerRequest {
  birthDate?: string;
  careMessagesEnabled?: boolean;
  // How the customer authorized the care messages; kept with the date when consent is recorded.
  careConsentSource?: CustomerConsentSource;
  notifyServiceOrderUpdates?: boolean;
  type: CustomerType;
  document?: string;
  name: string;
  phone: string;
  email?: string;
  address?: CustomerAddress;
  notes?: string;
  rg?: string;
  stateRegistration?: string;
  secondaryContactName?: string;
  secondaryContactPhone?: string;
  secondaryContactRelation?: string;
  preferredContactChannel?: CustomerContactChannel;
  preferredContactTime?: CustomerContactTime;
}

export interface UpdateCustomerRequest {
  birthDate?: string | null;
  careMessagesEnabled?: boolean;
  careConsentSource?: CustomerConsentSource;
  notifyServiceOrderUpdates?: boolean;
  id: string;
  // Changing the type revalidates the document; a company loses birth date and RG, a person loses state registration.
  type?: CustomerType;
  document?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  address?: CustomerAddress | null;
  notes?: string | null;
  rg?: string | null;
  stateRegistration?: string | null;
  secondaryContactName?: string | null;
  secondaryContactPhone?: string | null;
  secondaryContactRelation?: string | null;
  preferredContactChannel?: CustomerContactChannel | null;
  preferredContactTime?: CustomerContactTime | null;
}

export interface DeleteCustomerRequest {
  id: string;
}

export interface CustomerListRequest extends PageableRequest {
  search?: string;
  // The archived customers instead of the active ones.
  archived?: boolean;
  // DEBT: has installments still to receive. INACTIVE: no delivered order in the last 6 months (or ever).
  filter?: 'DEBT' | 'INACTIVE';
}

export interface CustomerOverviewRequest {
  id: string;
}

export interface RestoreCustomerRequest {
  id: string;
}

export interface CustomerArchiveImpactRequest {
  id: string;
}

// Joins a duplicate registration into the one to keep: vehicles, orders, appointments and messages move over.
export interface MergeCustomersRequest {
  keepId: string;
  mergeId: string;
}

export interface ImportCustomerRow {
  // Line in the spreadsheet, so a problem can point at it.
  line: number;
  type?: CustomerType;
  name: string;
  phone: string;
  document?: string;
  email?: string;
}
export interface ImportCustomersRequest { rows: ImportCustomerRow[] }
