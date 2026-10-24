export interface CreateCustomerMessageRequest {
  serviceOrderId: string;
  channel: 'EMAIL' | 'WHATSAPP';
  question: string;
  options: string[];
  includeQuote: boolean;
}

export interface CustomerMessageResponse {
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
  companyName: string;
  question: string;
  options: string[];
  message: string;
  expiresAt: string;
  answeredAt?: string;
  selectedOption?: number;
}

export interface CreatedCustomerMessageResponse {
  responseUrl: string;
  whatsappUrl?: string;
  sent: boolean;
  deliveryMode?: 'LINK' | 'WA_AKG';
}
