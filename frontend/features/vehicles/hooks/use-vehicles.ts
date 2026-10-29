'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateVehicleRequest, DeleteVehicleRequest, ImportVehiclesRequest, TransferVehicleRequest, UpdateVehicleRequest, VehicleListRequest } from '@oficina/contracts';
import { vehiclesApi } from '../api/vehicles-api';

const VEHICLES_LIST_KEY = 'vehicles-list';

// `enabled` (default true) — permite adiar a busca até um critério mínimo
// ser atingido (ex: VehicleSearchCombobox só busca com 2+ caracteres digitados),
// mesmo padrão de useFipeModels.
export function useVehiclesList(request: VehicleListRequest, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [VEHICLES_LIST_KEY, request],
    queryFn: () => vehiclesApi.list(request),
    placeholderData: (previousData) => previousData,
    enabled: options?.enabled ?? true,
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateVehicleRequest) => vehiclesApi.create(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VEHICLES_LIST_KEY] });
    },
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateVehicleRequest) => vehiclesApi.update(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VEHICLES_LIST_KEY] });
      queryClient.invalidateQueries({ queryKey: ['vehicle'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-overview'] });
    },
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: DeleteVehicleRequest) => vehiclesApi.delete(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VEHICLES_LIST_KEY] });
    },
  });
}

export function useRestoreVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => vehiclesApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VEHICLES_LIST_KEY] });
    },
  });
}

// What archiving would leave hanging; only asked while the confirmation is open.
export function useVehicleArchiveImpact(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['vehicle-archive-impact', id],
    queryFn: () => vehiclesApi.archiveImpact(id as string),
    enabled: enabled && Boolean(id),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useVehicle(id: string) {
  return useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => vehiclesApi.get(id),
    enabled: Boolean(id),
  });
}

export function useVehicleOverview(id: string) {
  return useQuery({
    queryKey: ['vehicle-overview', id],
    queryFn: () => vehiclesApi.overview(id),
    enabled: Boolean(id),
  });
}

export function useTransferVehicle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: TransferVehicleRequest) => vehiclesApi.transfer(request),
    onSuccess: () => {
      // The owner changed on the car, its appointments and its care: everything built from them is stale.
      queryClient.invalidateQueries({ queryKey: [VEHICLES_LIST_KEY] });
      queryClient.invalidateQueries({ queryKey: ['vehicle'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-overview'] });
      queryClient.invalidateQueries({ queryKey: ['customer-overview'] });
    },
  });
}

export function useImportVehicles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: ImportVehiclesRequest) => vehiclesApi.importRows(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VEHICLES_LIST_KEY] });
    },
  });
}
