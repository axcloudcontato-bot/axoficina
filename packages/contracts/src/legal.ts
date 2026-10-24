// Alterar a versão exige revisão dos textos e novo aceite nos fluxos de adesão.
export const LEGAL_VERSION = '2026-10-24';
export const PRIVACY_REQUEST_TYPES = ['ACCESS', 'CORRECTION', 'PORTABILITY', 'RESTRICTION', 'DELETION', 'REFUND', 'CANCELLATION'] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];
export const PRIVACY_REQUEST_STATUSES = ['OPEN', 'IN_REVIEW', 'COMPLETED', 'RETAINED'] as const;
export type PrivacyRequestStatus = (typeof PRIVACY_REQUEST_STATUSES)[number];
export interface LegalAcknowledgement {
  acceptedTerms: boolean;
  legalVersion: string;
}
export interface CreatePrivacyRequest {
  type: PrivacyRequestType;
  // Ausente: dados do próprio usuário. Presente: solicitação da oficina pelo cliente.
  customerId?: string;
  details?: string;
}
export interface PrivacyRequestResponse {
  id: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  customerId?: string;
  details?: string;
  response?: string;
  createdAt: string;
  dueAt: string;
  resolvedAt?: string;
  retentionUntil?: string;
}
