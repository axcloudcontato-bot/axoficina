import type { AppointmentStatus } from '../response/appointment.response';

export interface CreateAppointmentRequest {
  customerId: string;
  vehicleId: string;
  technicianId?: string;
  startsAt: string;
  endsAt: string;
  serviceDescription: string;
  notes?: string;
  confirmConflict?: boolean;
}

export interface UpdateAppointmentRequest extends CreateAppointmentRequest {
  id: string;
}

export interface AppointmentListRequest {
  startsAt: string;
  endsAt: string;
  technicianId?: string;
  status?: AppointmentStatus;
}

export interface TransitionAppointmentRequest {
  id: string;
  toStatus: AppointmentStatus;
  // Required (min. 5 characters) when cancelling; optional for a no-show.
  reason?: string;
}

export interface StartAppointmentRequest {
  id: string;
}

export interface NotifyAppointmentRequest {
  id: string;
}
