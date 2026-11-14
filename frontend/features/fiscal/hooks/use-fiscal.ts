'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CancelFiscalDocumentRequest, FiscalDocumentKind, IssueFiscalDocumentRequest, RegisterFiscalDocumentRequest, UpdateFiscalSettingsRequest, UploadFiscalCertificateRequest } from '@oficina/contracts';
import { fiscalApi } from '../api/fiscal-api';

export const FISCAL_SETTINGS_KEY = ['fiscal-settings'] as const;
const documentsKey = (serviceOrderId: string) => ['fiscal-documents', serviceOrderId] as const;

export function useFiscalSettings(enabled = true) {
  return useQuery({ queryKey: FISCAL_SETTINGS_KEY, queryFn: fiscalApi.settings, enabled });
}

export function useUpdateFiscalSettings() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (request: UpdateFiscalSettingsRequest) => fiscalApi.updateSettings(request), onSuccess: (data) => client.setQueryData(FISCAL_SETTINGS_KEY, data) });
}

export function useUploadFiscalCertificate() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (request: UploadFiscalCertificateRequest) => fiscalApi.uploadCertificate(request), onSuccess: (data) => client.setQueryData(FISCAL_SETTINGS_KEY, data) });
}

// While a note is being processed by the tax authority, check again every few seconds.
export function useFiscalDocuments(serviceOrderId: string, enabled = true) {
  return useQuery({
    queryKey: documentsKey(serviceOrderId),
    queryFn: async () => {
      const documents = await fiscalApi.list(serviceOrderId);
      const processing = documents.filter((document) => document.status === 'PROCESSING' && document.origin === 'INTEGRATED');
      if (!processing.length) return documents;
      const refreshed = await Promise.all(processing.map((document) => fiscalApi.refresh(document.id).catch(() => document)));
      const byId = new Map(refreshed.map((document) => [document.id, document]));
      return documents.map((document) => byId.get(document.id) ?? document);
    },
    enabled,
    refetchInterval: (query) => (query.state.data?.some((document) => document.status === 'PROCESSING') ? 5_000 : false),
  });
}

export function useFiscalPreview(serviceOrderId: string, kind: FiscalDocumentKind | null) {
  return useQuery({ queryKey: ['fiscal-preview', serviceOrderId, kind], queryFn: () => fiscalApi.preview(serviceOrderId, kind!), enabled: Boolean(kind), staleTime: 0 });
}

function useDocumentMutation<T>(serviceOrderId: string, mutationFn: (request: T) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({ mutationFn, onSettled: () => client.invalidateQueries({ queryKey: documentsKey(serviceOrderId) }) });
}

export const useIssueFiscalDocument = (serviceOrderId: string) => useDocumentMutation(serviceOrderId, (request: IssueFiscalDocumentRequest) => fiscalApi.issue(request));
export const useRegisterFiscalDocument = (serviceOrderId: string) => useDocumentMutation(serviceOrderId, (request: RegisterFiscalDocumentRequest) => fiscalApi.register(request));
export const useCancelFiscalDocument = (serviceOrderId: string) => useDocumentMutation(serviceOrderId, (request: CancelFiscalDocumentRequest) => fiscalApi.cancel(request));
export const useDeleteFiscalDocument = (serviceOrderId: string) => useDocumentMutation(serviceOrderId, (id: string) => fiscalApi.remove(id));
