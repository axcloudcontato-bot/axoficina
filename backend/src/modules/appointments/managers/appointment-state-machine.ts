import type { AppointmentStatus } from '@oficina/contracts';

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED', 'NO_SHOW', 'IN_SERVICE'],
  CONFIRMED: ['CANCELLED', 'NO_SHOW', 'IN_SERVICE'],
  // Closed by the service order it generated (delivered → COMPLETED, cancelled → CANCELLED).
  IN_SERVICE: [],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
