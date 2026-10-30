import type { BillingCycle } from './subscriptions';
import type { PlanCode } from './plans';

export const INVOICE_STATUSES = ['pending', 'paid', 'overdue', 'canceled', 'refunded'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface BillingInvoiceResponse {
  id: string;
  amountCents: number;
  dueDate: string;
  status: InvoiceStatus;
  paidAt: string | null;
  invoiceUrl: string | null;
}

export interface BillingStatusResponse {
  /** false until the payment provider is set up on the server: plans are then changed through support. */
  enabled: boolean;
  hasSubscription: boolean;
  /** Already paid at least once, so the payment page (card, receipts) can be opened. */
  hasCustomer: boolean;
  /** A lower plan chosen, taking effect with the next payment. */
  pendingPlan: PlanCode | null;
}

export interface CheckoutRequest { plan: PlanCode; cycle: BillingCycle }

export interface CheckoutResponse {
  /** The payment page to continue on; null when the change only adjusts the next charges. */
  checkoutUrl: string | null;
  /** The plan is already in force (an upgrade of a paid subscription). */
  appliedNow: boolean;
}
