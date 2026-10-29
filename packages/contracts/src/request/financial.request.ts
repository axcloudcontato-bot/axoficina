import type { FinancialEntryStatus, FinancialEntryType } from '../response/financial.response';

export interface CreateFinancialCategoryRequest {
  name: string;
  type: FinancialEntryType;
  color?: string;
}

export interface DeleteFinancialCategoryRequest { id: string; }
export interface UpdateFinancialCategoryRequest extends CreateFinancialCategoryRequest { id: string; }
export interface SaveFinancialCashBaselineRequest { amountCents: number; asOf: string; }

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
  recurrenceMonths?: number;
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
export interface AddFinancialPaymentRequest { id: string; amountCents: number; paidAt: string; method?: string; }
export interface ReverseFinancialPaymentRequest { id: string; reason: string; }
export interface UploadFinancialAttachmentRequest { entryId: string; name: string; mimeType: string; dataBase64: string; }
export interface FinancialAttachmentRequest { entryId: string; attachmentId: string; }
export interface ReconcileFinancialMovementRequest { source: 'MANUAL' | 'PAYMENT' | 'SERVICE_ORDER'; sourceId: string; bankReference: string; }
export interface UpdateFinancialEntryRequest extends CreateFinancialEntryRequest { id: string; }
export interface DeleteFinancialEntryRequest { id: string; reason?: string; }

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
