import type { AddFinancialPaymentRequest, CashFlowSummaryResponse, CreateFinancialCategoryRequest, CreateFinancialEntryRequest, CreateSupplierRequest, DeleteFinancialEntryRequest, FinancialCategoryResponse, FinancialEntryResponse, ListFinancialEntriesRequest, ReconcileFinancialMovementRequest, ReverseFinancialPaymentRequest, SaveFinancialCashBaselineRequest, SettleFinancialEntryRequest, SupplierResponse, UpdateFinancialCategoryRequest, UpdateFinancialEntryRequest, UpdateSupplierRequest, UploadFinancialAttachmentRequest } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const financialApi = {
  categories: async (): Promise<{ categories: FinancialCategoryResponse[] }> => (await apiClient.get('/api/v1/financial/categories')).data,
  createCategory: async (request: CreateFinancialCategoryRequest): Promise<{ category: FinancialCategoryResponse }> => (await apiClient.post('/api/v1/financial/categories', request)).data,
  updateCategory: async (request: UpdateFinancialCategoryRequest): Promise<{ category: FinancialCategoryResponse }> => (await apiClient.post('/api/v1/financial/categories/update', request)).data,
  deleteCategory: async (id: string): Promise<{ success: true }> => (await apiClient.post('/api/v1/financial/categories/delete', { id })).data,
  createEntry: async (request: CreateFinancialEntryRequest): Promise<{ entry: FinancialEntryResponse }> => (await apiClient.post('/api/v1/financial/entries', request)).data,
  updateEntry: async (request: UpdateFinancialEntryRequest): Promise<{ entry: FinancialEntryResponse }> => (await apiClient.post('/api/v1/financial/entries/update', request)).data,
  settleEntry: async (request: SettleFinancialEntryRequest): Promise<{ entry: FinancialEntryResponse }> => (await apiClient.post('/api/v1/financial/entries/settle', request)).data,
  addPayment: async (request: AddFinancialPaymentRequest): Promise<{ entry: FinancialEntryResponse }> => (await apiClient.post('/api/v1/financial/entries/payment', request)).data,
  reversePayment: async (request: ReverseFinancialPaymentRequest): Promise<{ success: true }> => (await apiClient.post('/api/v1/financial/entries/payment/reverse', request)).data,
  reconcile: async (request: ReconcileFinancialMovementRequest): Promise<{ reconciledAt: string }> => (await apiClient.post('/api/v1/financial/reconcile', request)).data,
  uploadAttachment: async (request: UploadFinancialAttachmentRequest): Promise<{ id: string; name: string }> => (await apiClient.post('/api/v1/financial/attachments', request)).data,
  attachments: async (entryId: string): Promise<{ attachments: Array<{ id: string; name: string; mimeType: string; createdAt: string }> }> => (await apiClient.post('/api/v1/financial/attachments/list', { entryId })).data,
  downloadAttachment: async (entryId: string, attachmentId: string): Promise<{ name: string; mimeType: string; dataBase64: string }> => (await apiClient.post('/api/v1/financial/attachments/download', { entryId, attachmentId })).data,
  deleteEntry: async (request: DeleteFinancialEntryRequest): Promise<{ success: true }> => (await apiClient.post('/api/v1/financial/entries/delete', request)).data,
  cashFlow: async (request: ListFinancialEntriesRequest): Promise<CashFlowSummaryResponse> => (await apiClient.post('/api/v1/financial/cash-flow', request)).data,
  saveCashBaseline: async (request: SaveFinancialCashBaselineRequest): Promise<{ amountCents: number; asOf: string }> => (await apiClient.post('/api/v1/financial/cash-baseline', request)).data,
  suppliers: async (): Promise<{ suppliers: SupplierResponse[] }> => (await apiClient.get('/api/v1/financial/suppliers')).data,
  createSupplier: async (request: CreateSupplierRequest): Promise<{ supplier: SupplierResponse }> => (await apiClient.post('/api/v1/financial/suppliers', request)).data,
  updateSupplier: async (request: UpdateSupplierRequest): Promise<{ supplier: SupplierResponse }> => (await apiClient.post('/api/v1/financial/suppliers/update', request)).data,
  deleteSupplier: async (id: string): Promise<{ success: true }> => (await apiClient.post('/api/v1/financial/suppliers/delete', { id })).data,
};
