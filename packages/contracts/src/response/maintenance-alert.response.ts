// DISMISSED: someone decided this customer should not be chased, and said why.
export const MAINTENANCE_ALERT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;

export type MaintenanceAlertStatus = (typeof MAINTENANCE_ALERT_STATUSES)[number];

// What the list can show. SNOOZED is an open alert that is postponed and comes back by itself.
export const MAINTENANCE_ALERT_FILTERS = ['OPEN', 'SNOOZED', 'RESOLVED', 'DISMISSED'] as const;
export type MaintenanceAlertFilter = (typeof MAINTENANCE_ALERT_FILTERS)[number];

// What came of an attempt to reach the customer.
export const MAINTENANCE_ALERT_CONTACT_OUTCOMES = ['MESSAGE_SENT', 'NO_ANSWER', 'WILL_SCHEDULE', 'NOT_NOW'] as const;
export type MaintenanceAlertContactOutcome = (typeof MAINTENANCE_ALERT_CONTACT_OUTCOMES)[number];
export const MAINTENANCE_ALERT_CONTACT_OUTCOME_LABELS: Record<MaintenanceAlertContactOutcome, string> = {
  MESSAGE_SENT: 'Enviei mensagem',
  NO_ANSWER: 'Não atendeu',
  WILL_SCHEDULE: 'Vai agendar',
  NOT_NOW: 'Não quer agora',
};

export const MAINTENANCE_ALERT_SNOOZE_DAYS = [30, 60, 90] as const;

export const MAINTENANCE_ALERT_DISMISS_REASONS = ['SOLD', 'MOVED', 'NO_CONTACT', 'OTHER'] as const;
export type MaintenanceAlertDismissReason = (typeof MAINTENANCE_ALERT_DISMISS_REASONS)[number];
export const MAINTENANCE_ALERT_DISMISS_REASON_LABELS: Record<MaintenanceAlertDismissReason, string> = {
  SOLD: 'Vendeu o carro',
  MOVED: 'Mudou de cidade',
  NO_CONTACT: 'Não quer ser contatado',
  OTHER: 'Outro motivo',
};

// Campos denormalizados (vehicleBrand/Model/Plate, customerName) — mesmo
// padrão flat de ServiceOrderResponse, nunca objeto aninhado.
export interface MaintenanceAlertResponse {
  id: string;
  tenantId: string;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  customerId: string;
  customerName: string;
  referenceDate: string;
  monthsOverdue: number;
  status: MaintenanceAlertStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  // Name of who resolved or dismissed it; absent when the delivery of an order resolved it by itself.
  resolvedByName?: string;
  // Set while the alert is postponed.
  snoozedUntil?: string;
  dismissReason?: MaintenanceAlertDismissReason;
  dismissNote?: string;
  // To reach the customer without opening another screen.
  customerPhone?: string;
  // Whether the customer authorized the automatic care reminders; without it the team has to call.
  customerCareEnabled?: boolean;
  vehicleMileage?: number;
  // The cares of the car that are already overdue, by time or by mileage.
  overdueCare: Array<{ serviceName: string; reason: 'TIME' | 'KM' }>;
  contactCount: number;
  lastContact?: { outcome: MaintenanceAlertContactOutcome; at: string; byName?: string; note?: string };
}

export interface MaintenanceAlertContactResponse {
  id: string;
  outcome: MaintenanceAlertContactOutcome;
  at: string;
  byName?: string;
  note?: string;
}

export type MaintenanceAlertListItemResponse = MaintenanceAlertResponse;
