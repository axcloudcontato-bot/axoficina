export interface UpdateWhatsAppSettingsRequest {
  baseUrl?: string;
  sessionId?: string;
  apiKey?: string;
  webhookSecret?: string;
  enabled: boolean;
}

export interface WhatsAppSettingsResponse {
  /** True when the platform supplies the server and the API key: the workshop only turns the sending on or off. */
  managed?: boolean;
  baseUrl?: string;
  sessionId?: string;
  apiKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  enabled: boolean;
  webhookUrl: string;
  connectionTestAt?: string;
  connectionSuccessAt?: string;
  connectionTestError?: string;
  webhookTestAt?: string;
  webhookSuccessAt?: string;
  webhookTestError?: string;
}

export interface WhatsAppConnectionResponse {
  connected: boolean;
  status: string;
}

export interface WhatsAppWebhookTestResponse {
  reachable: boolean;
  webhookUrl: string;
}
