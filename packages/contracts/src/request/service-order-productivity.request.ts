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
