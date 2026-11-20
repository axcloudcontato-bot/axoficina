import type { WhatsAppChatMessagesResponse, WhatsAppConversationsResponse } from '@oficina/contracts';
import { apiClient } from '@/lib/api/client';

const base = '/api/v1/whatsapp-chat';

export const whatsappChatApi = {
  async conversations() {
    return (await apiClient.get<WhatsAppConversationsResponse>(`${base}/conversations`)).data;
  },
  async messages(jid: string) {
    return (await apiClient.get<WhatsAppChatMessagesResponse>(`${base}/conversations/${encodeURIComponent(jid)}/messages`)).data;
  },
  async send(jid: string, text: string) {
    return (await apiClient.post<{ sent: boolean }>(`${base}/conversations/${encodeURIComponent(jid)}/messages`, { text })).data;
  },
  // Media needs the session token, so it comes as a blob and is shown through an object URL.
  async media(file: string) {
    return (await apiClient.get<Blob>(`${base}/media/${encodeURIComponent(file)}`, { responseType: 'blob' })).data;
  },
};
