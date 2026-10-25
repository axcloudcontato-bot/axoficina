export const CUSTOMER_MESSAGE_PURPOSES = ['QUOTE', 'SCHEDULE', 'PICKUP', 'CUSTOM', 'RATING'] as const;
export type CustomerMessagePurpose = typeof CUSTOMER_MESSAGE_PURPOSES[number];

export const QUOTE_APPROVAL_QUESTION = 'Você aprova este orçamento para realizarmos o serviço?';
export const QUOTE_APPROVAL_OPTIONS = ['Aprovar orçamento', 'Não aprovar', 'Falar com a oficina'];

export const SERVICE_RATING_QUESTION = 'Como você avalia o serviço realizado pela nossa oficina?';
export const SERVICE_RATING_OPTIONS = ['⭐ 1 — Ruim', '⭐⭐ 2 — Regular', '⭐⭐⭐ 3 — Bom', '⭐⭐⭐⭐ 4 — Muito bom', '⭐⭐⭐⭐⭐ 5 — Ótimo'];

export interface CustomerMessageQuote {
  orderNumber: number;
  vehicle: string;
  plate: string;
  totalAmountCents: number;
  items: { id: string; description: string; type: string; quantity: number; unitPriceCents: number; lineTotalCents: number }[];
}

export type PublicCustomerMessageQuote = Omit<CustomerMessageQuote, 'items'> & { items: Omit<CustomerMessageQuote['items'][number], 'id'>[] };

export interface CreateCustomerMessageRequest {
  purpose?: CustomerMessagePurpose;
  expectedQuoteRevision?: string;
  serviceOrderId: string;
  channel: 'EMAIL' | 'WHATSAPP';
  question: string;
  options: string[];
  includeQuote: boolean;
}

export interface CustomerMessageResponse {
  purpose?: CustomerMessagePurpose;
  quote?: CustomerMessageQuote;
  quoteIsCurrent?: boolean;
  id: string;
  channel: 'EMAIL' | 'WHATSAPP';
  deliveryMode?: 'LINK' | 'WA_AKG';
  sentAt?: string;
  question: string;
  options: string[];
  message: string;
  createdAt: string;
  expiresAt: string;
  answeredAt?: string;
  selectedOption?: number;
}

export interface PublicCustomerMessageResponse {
  purpose?: CustomerMessagePurpose;
  quote?: PublicCustomerMessageQuote;
  quoteIsCurrent?: boolean;
  canAnswer?: boolean;
  unavailableReason?: string;
  companyName: string;
  question: string;
  options: string[];
  message: string;
  expiresAt: string;
  answeredAt?: string;
  selectedOption?: number;
}

export interface CreatedCustomerMessageResponse {
  messageId?: string;
  workflowWarning?: string;
  responseUrl: string;
  whatsappUrl?: string;
  sent: boolean;
  deliveryMode?: 'LINK' | 'WA_AKG';
}
