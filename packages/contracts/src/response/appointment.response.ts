export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_SERVICE',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export interface AppointmentResponse {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  vehicleId: string;
  vehicleBrand: string;
  vehicleModel: string;
  vehiclePlate: string;
  technicianId?: string;
  technicianName?: string;
  serviceOrderId?: string;
  startsAt: string;
  endsAt: string;
  serviceDescription: string;
  notes?: string;
  status: AppointmentStatus;
  createdBy: string;
  createdAt: string;
  cancelledAt?: string;
  reminderSentAt?: string;
  confirmationSentAt?: string;
}

export interface AppointmentConflictResponse {
  id: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  vehiclePlate: string;
}
