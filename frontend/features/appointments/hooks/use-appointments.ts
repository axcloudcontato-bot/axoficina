'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AppointmentListRequest,
  CreateAppointmentRequest,
  NotifyAppointmentRequest,
  StartAppointmentRequest,
  TransitionAppointmentRequest,
  UpdateAppointmentRequest,
} from '@oficina/contracts';
import { appointmentsApi } from '../api/appointments-api';

const KEY = 'appointments';

export function useAppointments(request: AppointmentListRequest) {
  return useQuery({ queryKey: [KEY, request], queryFn: () => appointmentsApi.list(request), placeholderData: (previous) => previous });
}

function useRefreshingMutation<T>(mutationFn: (request: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => client.invalidateQueries({ queryKey: [KEY] }) });
}

export function useCreateAppointment() {
  return useRefreshingMutation<CreateAppointmentRequest>(appointmentsApi.create);
}
export function useUpdateAppointment() {
  return useRefreshingMutation<UpdateAppointmentRequest>(appointmentsApi.update);
}
export function useTransitionAppointment() {
  return useRefreshingMutation<TransitionAppointmentRequest>(appointmentsApi.transition);
}
export function useStartAppointment() {
  return useRefreshingMutation<StartAppointmentRequest>(appointmentsApi.start);
}
export function useNotifyAppointment() {
  return useRefreshingMutation<NotifyAppointmentRequest>(appointmentsApi.notify);
}
