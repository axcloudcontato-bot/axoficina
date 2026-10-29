'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_PHOTO_POLICY, type PhotoPolicy, type UpdateCompanySettingsRequest, type UpdateEmailSettingsRequest, type UpdatePhotoPolicyRequest } from '@oficina/contracts';
import { settingsApi } from '../api/settings-api';

export const SETTINGS_KEY = ['tenant-settings'] as const;
export const BRANDING_KEY = ['tenant-branding'] as const;

export function useSettings(enabled = true) {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: settingsApi.get, enabled });
}

export function useBranding() {
  return useQuery({ queryKey: BRANDING_KEY, queryFn: settingsApi.branding, staleTime: 5 * 60_000 });
}

export function useUpdateCompanySettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateCompanySettingsRequest) => settingsApi.updateCompany(request),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: SETTINGS_KEY });
      client.invalidateQueries({ queryKey: BRANDING_KEY });
    },
  });
}

export function useUpdateEmailSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdateEmailSettingsRequest) => settingsApi.updateEmail(request),
    onSuccess: () => client.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}

export function useTestEmailSettings() {
  return useMutation({ mutationFn: settingsApi.testEmail });
}

// Which photo evidence this workshop requires; strict until the settings arrive.
export function usePhotoPolicy(): PhotoPolicy {
  return useBranding().data?.photoPolicy ?? DEFAULT_PHOTO_POLICY;
}

export function useUpdatePhotoPolicy() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: UpdatePhotoPolicyRequest) => settingsApi.updatePhotoPolicy(request),
    onSuccess: () => client.invalidateQueries({ queryKey: BRANDING_KEY }),
  });
}
