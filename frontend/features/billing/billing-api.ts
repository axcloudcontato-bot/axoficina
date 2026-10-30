import type { BillingInvoiceResponse, BillingStatusResponse, CheckoutRequest, CheckoutResponse } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

export const billingApi = {
  async status(): Promise<BillingStatusResponse> {
    return (await apiClient.get<BillingStatusResponse>('/api/v1/billing')).data;
  },
  async invoices(): Promise<{ items: BillingInvoiceResponse[] }> {
    return (await apiClient.get<{ items: BillingInvoiceResponse[] }>('/api/v1/billing/invoices')).data;
  },
  async checkout(request: CheckoutRequest): Promise<CheckoutResponse> {
    return (await apiClient.post<CheckoutResponse>('/api/v1/billing/checkout', request)).data;
  },
  async portal(): Promise<{ url: string }> {
    return (await apiClient.post<{ url: string }>('/api/v1/billing/portal')).data;
  },
  async cancel(): Promise<void> {
    await apiClient.post('/api/v1/billing/cancel');
  },
};
