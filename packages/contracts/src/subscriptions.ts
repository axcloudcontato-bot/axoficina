export const SUBSCRIPTION_STATUSES = ['unconfigured', 'trial', 'active', 'past_due', 'canceled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const BILLING_CYCLES = ['monthly', 'yearly'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export interface SubscriptionResponse {
  id: string;
  name: string;
  document: string;
  email: string | null;
  plan: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionAmountCents: number;
  subscriptionCycle: BillingCycle;
  subscriptionDueAt: string | null;
  subscriptionNotes: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SubscriptionListRequest {
  offset?: number;
  limit?: number;
  search?: string;
  status?: SubscriptionStatus;
}

export interface SubscriptionListResponse {
  items: SubscriptionResponse[];
  total: number;
  summary: {
    total: number;
    active: number;
    trial: number;
    pastDue: number;
    mrrCents: number;
  };
}

export interface UpdateSubscriptionRequest {
  plan: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionAmountCents: number;
  subscriptionCycle: BillingCycle;
  subscriptionDueAt: string | null;
  subscriptionNotes: string | null;
  expectedUpdatedAt: string | null;
}
