import { apiClient } from '@/lib/api/client';
import type {
  AppointmentListRequest,
  AppointmentResponse,
  CreateAppointmentRequest,
  NotifyAppointmentRequest,
  StartAppointmentRequest,
  TransitionAppointmentRequest,
  UpdateAppointmentRequest,
} from '@oficina/contracts';

export const appointmentsApi = {
  async create(request: CreateAppointmentRequest) {
    return (await apiClient.post<{ appointment: AppointmentResponse }>('/api/v1/appointments', request)).data;
  },
  async update(request: UpdateAppointmentRequest) {
    return (await apiClient.post<{ appointment: AppointmentResponse }>('/api/v1/appointments/update', request)).data;
  },
  async list(request: AppointmentListRequest) {
    return (await apiClient.post<{ items: AppointmentResponse[] }>('/api/v1/appointments/list', request)).data;
  },
  async transition(request: TransitionAppointmentRequest) {
    return (await apiClient.post<{ appointment: AppointmentResponse }>('/api/v1/appointments/transition', request)).data;
  },
  async notify(request: NotifyAppointmentRequest) {
    return (await apiClient.post<{ appointment: AppointmentResponse }>('/api/v1/appointments/notify', request)).data;
  },
  async start(request: StartAppointmentRequest) {
    return (await apiClient.post<{ appointment: AppointmentResponse; serviceOrder: { id: string } }>('/api/v1/appointments/start', request)).data;
  },
};
