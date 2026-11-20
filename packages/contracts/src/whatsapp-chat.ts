// Conversations of the workshop's own WhatsApp number, read through WA-AKG by the backend.
export type WhatsAppChatMessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'LOCATION' | 'CONTACT' | 'OTHER';

export interface WhatsAppChatCustomer { id: string; name: string }

export interface WhatsAppConversation {
  /** WhatsApp address of the contact, such as 5511999999999@s.whatsapp.net. */
  jid: string;
  /** Digits of the number, when the address carries it. */
  phone?: string;
  /** Name from the WhatsApp contact list or the customer's profile name. */
  name?: string;
  /** Customer registered in Ofix with this number. */
  customer?: WhatsAppChatCustomer;
  lastMessage?: { text?: string; type: WhatsAppChatMessageType; at: string; fromMe?: boolean };
}

export interface WhatsAppChatMessage {
  id: string;
  fromMe: boolean;
  type: WhatsAppChatMessageType;
  text?: string;
  at: string;
  status?: string;
  /** File name to open through GET whatsapp-chat/media/:file, when the message carries a photo or file. */
  media?: string;
}

export interface WhatsAppConversationsResponse { conversations: WhatsAppConversation[] }
export interface WhatsAppChatMessagesResponse { conversation: WhatsAppConversation; messages: WhatsAppChatMessage[] }
export interface SendWhatsAppChatMessageRequest { text: string }
