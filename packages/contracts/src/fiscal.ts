// Notas fiscais da OS: emitidas pelo Ofix (integração) ou registradas depois de emitidas fora dele.

export const FISCAL_DOCUMENT_KINDS = ['NFSE', 'NFE', 'NFCE'] as const;
export type FiscalDocumentKind = (typeof FISCAL_DOCUMENT_KINDS)[number];

export const FISCAL_DOCUMENT_KIND_LABELS: Record<FiscalDocumentKind, string> = {
  NFSE: 'NFS-e',
  NFE: 'NF-e',
  NFCE: 'NFC-e',
};

export const FISCAL_DOCUMENT_KIND_DESCRIPTIONS: Record<FiscalDocumentKind, string> = {
  NFSE: 'Nota de serviço (mão de obra), emitida na prefeitura.',
  NFE: 'Nota de produto (peças), para empresas ou quem pede nota completa.',
  NFCE: 'Cupom fiscal eletrônico de peças para o consumidor final.',
};

// Which order items each document carries: services go on the NFS-e, parts and products on the NF-e/NFC-e.
export const FISCAL_KIND_ITEM_TYPES: Record<FiscalDocumentKind, readonly string[]> = {
  NFSE: ['LABOR'],
  NFE: ['PART', 'PRODUCT'],
  NFCE: ['PART', 'PRODUCT'],
};

export const FISCAL_ENVIRONMENTS = ['HOMOLOGACAO', 'PRODUCAO'] as const;
export type FiscalEnvironment = (typeof FISCAL_ENVIRONMENTS)[number];

export const FISCAL_TAX_REGIMES = ['SIMPLES_NACIONAL', 'MEI', 'SIMPLES_EXCESSO', 'NORMAL'] as const;
export type FiscalTaxRegime = (typeof FISCAL_TAX_REGIMES)[number];

export const FISCAL_TAX_REGIME_LABELS: Record<FiscalTaxRegime, string> = {
  SIMPLES_NACIONAL: 'Simples Nacional',
  MEI: 'MEI',
  SIMPLES_EXCESSO: 'Simples Nacional com excesso de sublimite',
  NORMAL: 'Lucro presumido ou real',
};

export const FISCAL_DOCUMENT_STATUSES = ['PROCESSING', 'AUTHORIZED', 'ERROR', 'CANCELLED'] as const;
export type FiscalDocumentStatus = (typeof FISCAL_DOCUMENT_STATUSES)[number];

export const FISCAL_DOCUMENT_STATUS_LABELS: Record<FiscalDocumentStatus, string> = {
  PROCESSING: 'Em processamento',
  AUTHORIZED: 'Emitida',
  ERROR: 'Rejeitada',
  CANCELLED: 'Cancelada',
};

export type FiscalDocumentOrigin = 'INTEGRATED' | 'MANUAL';

// Sensible defaults for a mechanic shop on the Simples Nacional; the accountant confirms them.
export const FISCAL_DEFAULTS = {
  serviceListItem: '14.01',
  defaultNcm: '87089990',
  defaultCfop: '5102',
  csosn: '102',
  pisCofinsCst: '49',
} as const;

// SEFAZ and most city systems require a justification of 15 to 255 characters to cancel.
export const FISCAL_CANCEL_REASON_MIN = 15;
export const FISCAL_CANCEL_REASON_MAX = 255;

export interface FiscalCertificateInfo {
  uploaded: boolean;
  validUntil?: string;
  uploadedAt?: string;
}

export interface FiscalReadiness {
  // Empty list means the document can be issued from the Ofix.
  NFSE: string[];
  NFE: string[];
  NFCE: string[];
}

export interface FiscalSettingsResponse {
  // False when the Ofix server has no emission provider configured: only manual registration works.
  providerAvailable: boolean;
  environment: FiscalEnvironment;
  taxRegime: FiscalTaxRegime;
  document: string;
  legalName?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  cityIbgeCode?: string;
  cnae?: string;
  nfseEnabled: boolean;
  nfeEnabled: boolean;
  nfceEnabled: boolean;
  serviceListItem: string;
  municipalTaxCode?: string;
  issRatePercent?: number;
  issWithheld: boolean;
  defaultNcm: string;
  defaultCfop: string;
  csosn: string;
  pisCofinsCst: string;
  nfceCscId?: string;
  hasNfceCsc: boolean;
  certificate: FiscalCertificateInfo;
  companyRegistered: boolean;
  lastSyncError?: string;
  lastSyncAt?: string;
  readiness: FiscalReadiness;
}

export interface UpdateFiscalSettingsRequest {
  environment: FiscalEnvironment;
  taxRegime: FiscalTaxRegime;
  municipalRegistration?: string | null;
  cityIbgeCode?: string | null;
  cnae?: string | null;
  nfseEnabled: boolean;
  nfeEnabled: boolean;
  nfceEnabled: boolean;
  serviceListItem: string;
  municipalTaxCode?: string | null;
  issRatePercent?: number | null;
  issWithheld: boolean;
  defaultNcm: string;
  defaultCfop: string;
  csosn: string;
  pisCofinsCst: string;
  nfceCscId?: string | null;
  // Only sent when changed; omitted keeps the stored value.
  nfceCsc?: string;
}

export interface UploadFiscalCertificateRequest {
  fileName: string;
  dataBase64: string;
  password: string;
}

export interface FiscalDocumentResponse {
  id: string;
  serviceOrderId: string;
  kind: FiscalDocumentKind;
  origin: FiscalDocumentOrigin;
  environment?: FiscalEnvironment;
  status: FiscalDocumentStatus;
  number?: string;
  series?: string;
  verificationCode?: string;
  accessKey?: string;
  issuedAt?: string;
  amountCents: number;
  pdfUrl?: string;
  xmlUrl?: string;
  hasAttachment: boolean;
  attachmentName?: string;
  errorMessage?: string;
  cancelledAt?: string;
  cancelReason?: string;
  notes?: string;
  createdAt: string;
}

export interface FiscalPreviewItem {
  id: string;
  type: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  discountCents: number;
  ncm?: string;
}

export interface FiscalPreviewResponse {
  kind: FiscalDocumentKind;
  amountCents: number;
  discountCents: number;
  items: FiscalPreviewItem[];
  // Configuration still missing to issue this kind from the Ofix (only manual registration works meanwhile).
  blockers: string[];
  // Blocking problems of this order (empty means it can be issued) and non-blocking warnings.
  problems: string[];
  warnings: string[];
  environment: FiscalEnvironment;
}

export interface FiscalPreviewRequest { serviceOrderId: string; kind: FiscalDocumentKind; }
export interface IssueFiscalDocumentRequest { serviceOrderId: string; kind: FiscalDocumentKind; }
export interface ListFiscalDocumentsRequest { serviceOrderId: string; }
export interface FiscalDocumentIdRequest { id: string; }
export interface CancelFiscalDocumentRequest { id: string; reason: string; }

export interface RegisterFiscalDocumentRequest {
  serviceOrderId: string;
  kind: FiscalDocumentKind;
  number: string;
  series?: string;
  issuedAt: string;
  amountCents: number;
  verificationCode?: string;
  accessKey?: string;
  notes?: string;
  attachment?: { name: string; mimeType: string; dataBase64: string };
}

export interface FiscalAttachmentResponse { name: string; mimeType: string; dataBase64: string; }
