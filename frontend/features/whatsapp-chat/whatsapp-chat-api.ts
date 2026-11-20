import type { WhatsAppChatMessagesResponse, WhatsAppConversationsResponse } from '@oficina/contracts';
import axios from 'axios';
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
  // The contact's WhatsApp photo, or null when the contact has none or hides it.
  async photo(jid: string) {
    try { return (await apiClient.get<Blob>(`${base}/conversations/${encodeURIComponent(jid)}/photo`, { responseType: 'blob' })).data; }
    catch (error) { if (axios.isAxiosError(error) && error.response?.status === 404) return null; throw error; }
  },
  // Media needs the session token, so it comes as a blob and is shown through an object URL.
  async media(file: string) {
    return (await apiClient.get<Blob>(`${base}/media/${encodeURIComponent(file)}`, { responseType: 'blob' })).data;
  },
};
