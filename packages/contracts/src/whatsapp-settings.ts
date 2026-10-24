export interface UpdateWhatsAppSettingsRequest {
  baseUrl?: string;
  sessionId?: string;
  apiKey?: string;
  webhookSecret?: string;
  enabled: boolean;
}

export interface WhatsAppSettingsResponse {
  baseUrl?: string;
  sessionId?: string;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  enabled: boolean;
  webhookUrl: string;
}

export interface WhatsAppConnectionResponse {
  connected: boolean;
  status: string;
}

export interface WhatsAppWebhookTestResponse {
  reachable: boolean;
  webhookUrl: string;
}
