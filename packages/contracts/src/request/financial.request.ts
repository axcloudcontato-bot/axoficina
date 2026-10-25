import type { FinancialEntryStatus, FinancialEntryType } from '../response/financial.response';

export interface CreateFinancialCategoryRequest {
  name: string;
  type: FinancialEntryType;
  color?: string;
}

export interface DeleteFinancialCategoryRequest { id: string; }

export interface CreateFinancialEntryRequest {
  categoryId: string;
  supplierId?: string;
  customerId?: string;
  type: FinancialEntryType;
  description: string;
  amountCents: number;
  dueAt: string;
  status?: FinancialEntryStatus;
  paidAt?: string;
  notes?: string;
}

export interface ListFinancialEntriesRequest {
  startAt: string;
  endAt: string;
  dateField?: 'DUE' | 'PAID';
  type?: FinancialEntryType;
  status?: FinancialEntryStatus;
  categoryId?: string;
}

export interface SettleFinancialEntryRequest { id: string; paidAt?: string; }
export interface DeleteFinancialEntryRequest { id: string; }

export interface CreateSupplierRequest {
  name: string;
  document?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  paymentTerms?: string;
  notes?: string;
}

export interface UpdateSupplierRequest extends CreateSupplierRequest { id: string; }
export interface DeleteSupplierRequest { id: string; }
