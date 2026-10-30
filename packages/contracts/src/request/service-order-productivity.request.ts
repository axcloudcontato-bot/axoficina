export interface TechnicianProductivityRequest {
  startAt: string;
  endAt: string;
}

export interface TechnicianProductivityOrdersRequest extends TechnicianProductivityRequest {
  technicianId: string;
  offset: number;
  limit: number;
}

// A manager fixes a timer: new start/end, or removes it. The reason is kept in the audit log.
export interface CorrectWorkSessionRequest {
  sessionId: string;
  startedAt?: string;
  endedAt?: string;
  remove?: boolean;
  reason: string;
}

// Repeats last month's targets for the technicians who have none yet in `toMonth`.
export interface CopyProductivityTargetsRequest {
  fromMonth: string;
  toMonth: string;
}

// The six months that end in `month` (YYYY-MM), for the trend chart.
export interface ProductivityTrendRequest {
  month: string;
}

// Links an order to the earlier one it came back under warranty for; originalOrderId null undoes it.
export interface MarkWarrantyReturnRequest {
  serviceOrderId: string;
  originalOrderId: string | null;
  reason?: string;
}

// Percentages as basis points: 1000 = 10%.
export interface SetCommissionRuleRequest {
  technicianId: string;
  laborPercentBp: number;
  bonusPercentBp: number;
}

export const IDLE_REASONS = ['WAITING_PARTS', 'CLEANING', 'ERRANDS', 'TRAINING', 'OTHER'] as const;
export type IdleReason = (typeof IDLE_REASONS)[number];

export interface StartIdleRequest {
  reason: IdleReason;
  note?: string;
}
