export interface TechnicianProductivityRequest {
  startAt: string;
  endAt: string;
}

export interface TechnicianProductivityOrdersRequest extends TechnicianProductivityRequest {
  technicianId: string;
  offset: number;
  limit: number;
}
