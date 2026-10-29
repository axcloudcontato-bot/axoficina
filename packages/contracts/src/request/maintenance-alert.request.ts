import type { PageableRequest } from '../response/pagination.response';
import type { MaintenanceAlertContactOutcome, MaintenanceAlertDismissReason, MaintenanceAlertFilter } from '../response/maintenance-alert.response';

export interface MaintenanceAlertListRequest extends PageableRequest {
  status?: MaintenanceAlertFilter;
  // Plate, brand, model, or the owner's name or document.
  search?: string;
  // Months since the last visit: from `minMonths` up to (not including) `maxMonths`.
  minMonths?: number;
  maxMonths?: number;
  // NEVER: nobody tried to reach the customer yet. CONTACTED: someone did.
  contact?: 'NEVER' | 'CONTACTED';
}

export interface ResolveMaintenanceAlertRequest {
  id: string;
}

// The alert goes away for `days` and comes back by itself if the car is still due.
export interface SnoozeMaintenanceAlertRequest {
  id: string;
  days: 30 | 60 | 90;
}

export interface DismissMaintenanceAlertRequest {
  id: string;
  reason: MaintenanceAlertDismissReason;
  // Free text for the team only; no personal data.
  note?: string;
}

export interface ReopenMaintenanceAlertRequest {
  id: string;
}

export interface RecordMaintenanceAlertContactRequest {
  id: string;
  outcome: MaintenanceAlertContactOutcome;
  // For the team only; no personal data.
  note?: string;
}

export interface MaintenanceAlertContactsRequest {
  id: string;
}
