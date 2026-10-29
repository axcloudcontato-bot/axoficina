export type FinancialEntryType = 'INCOME' | 'EXPENSE';
export type FinancialEntryStatus = 'PENDING' | 'PAID';

export interface FinancialCategoryResponse {
  id: string;
  name: string;
  type: FinancialEntryType;
  group: string;
  color?: string;
  isSystem: boolean;
}

export interface FinancialEntryResponse {
  id: string;
  categoryId?: string;
  supplierId?: string;
  supplierName?: string;
  customerId?: string;
  customerName?: string;
  categoryName: string;
  type: FinancialEntryType;
  description: string;
  amountCents: number;
  originalAmountCents?: number;
  paidTotalCents?: number;
  reconciledAt?: string;
  bankReference?: string;
  parentEntryId?: string;
  dueAt: string;
  status: FinancialEntryStatus;
  paidAt?: string;
  notes?: string;
  source: 'MANUAL' | 'SERVICE_ORDER' | 'PAYMENT';
  serviceOrderId?: string;
  serviceOrderNumber?: number;
  vehiclePlate?: string;
  paymentMethod?: string;
}

export interface CashFlowSummaryResponse {
  openingBalanceCents?: number;
  realizedIncomeCents: number;
  realizedExpenseCents: number;
  projectedIncomeCents: number;
  projectedExpenseCents: number;
  realizedBalanceCents: number;
  projectedBalanceCents: number;
  entries: FinancialEntryResponse[];
  categories: FinancialCategoryResponse[];
}

export interface SupplierResponse {
  id: string;
  name: string;
  document?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  paymentTerms?: string;
  notes?: string;
  status: 'ACTIVE' | 'BLOCKED';
}
