// What the workshop's administrator sees about the account itself: the plan, who changed what, and their own data.

export interface WorkshopSubscriptionResponse {
  plan: string;
  status: 'unconfigured' | 'trial' | 'active' | 'past_due' | 'canceled';
  amountCents: number;
  cycle: 'monthly' | 'yearly';
  dueAt: string | null;
  customerSince: string;
}

export interface AuditLogRequest {
  offset: number;
  limit: number;
  // "financial." keeps only that area's actions.
  actionPrefix?: string;
  userId?: string;
  from?: string;
  to?: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  userId: string | null;
  userName: string | null;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface AuditLogResponse {
  items: AuditLogItem[];
  total: number;
  offset: number;
  limit: number;
}

export const DATA_EXPORT_DATASETS = ['customers', 'vehicles', 'service-orders', 'financial'] as const;
export type DataExportDataset = (typeof DATA_EXPORT_DATASETS)[number];
