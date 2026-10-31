import type { ModuleKey } from './plans';
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
  extraModules: ModuleKey[];
  subscriptionStatus: SubscriptionStatus;
  subscriptionAmountCents: number;
  subscriptionCycle: BillingCycle;
  subscriptionDueAt: string | null;
  subscriptionNotes: string | null;
  /** Set while the workshop is closed and waiting to be erased. */
  closedAt: string | null;
  purgeAfter: string | null;
  closedBy: 'owner' | 'saas_admin' | null;
  closureReason: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface SubscriptionListRequest {
  offset?: number;
  limit?: number;
  search?: string;
  status?: SubscriptionStatus;
  /** active (default) lists workshops in use; closed lists the ones waiting to be erased. */
  scope?: 'active' | 'closed';
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
  extraModules: ModuleKey[];
  subscriptionStatus: SubscriptionStatus;
  subscriptionAmountCents: number;
  subscriptionCycle: BillingCycle;
  subscriptionDueAt: string | null;
  subscriptionNotes: string | null;
  expectedUpdatedAt: string | null;
}
