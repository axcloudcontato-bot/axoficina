import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { WhatsAppChatCustomer, WhatsAppChatMessage, WhatsAppChatMessageType, WhatsAppChatMessagesResponse, WhatsAppConversation, WhatsAppConversationsResponse } from '@oficina/contracts';
import { WaAkgService, type WaAkgConnection } from '../settings/services/wa-akg.service';
import { CustomerRepository } from '../customers/repositories/customer.repository';
import { CHAT_MEDIA_FILE, PRIVATE_CHAT_JID } from './whatsapp-chat.dto';

const MESSAGE_TYPES: WhatsAppChatMessageType[] = ['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'LOCATION', 'CONTACT'];
const textOf = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined);
const messageType = (value: unknown): WhatsAppChatMessageType => (MESSAGE_TYPES.includes(value as WhatsAppChatMessageType) ? value as WhatsAppChatMessageType : 'OTHER');
const isoDate = (value: unknown) => {
  const date = new Date(typeof value === 'string' || typeof value === 'number' ? value : Number.NaN);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};
// Brazilian numbers are saved with or without 55 and with any mask: compare the national digits.
const nationalDigits = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('55') && [12, 13].includes(digits.length) ? digits.slice(2) : digits;
};
const PHOTO_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHED_PHOTOS = 5_000;
const phoneOf = (jid: string) => (jid.endsWith('@s.whatsapp.net') ? jid.split('@')[0] : undefined);

/**
 * The workshop's WhatsApp conversations, read from WA-AKG with the platform key. The session always comes from the
 * tenant of the signed-in user (getConnection), never from the request, so a workshop cannot reach another one's number.
 */
@Injectable()
export class WhatsAppChatManager {
  private readonly logger = new Logger(WhatsAppChatManager.name);
  private readonly photos = new Map<string, { photo: { body: Buffer; contentType: string } | null; expires: number }>();
  private readonly photoUrls = new Map<string, string>();
  constructor(private readonly whatsapp: WaAkgService, private readonly customers: CustomerRepository) {}

  async conversations(tenantId: string): Promise<WhatsAppConversationsResponse> {
    const connection = await this.connection(tenantId);
    const [chats, customers] = await Promise.all([this.whatsapp.listChats(connection), this.customerIndex()]);
    const conversations = chats
      .filter((chat): chat is Record<string, unknown> & { jid: string } => typeof chat.jid === 'string' && PRIVATE_CHAT_JID.test(chat.jid))
      .map((chat) => {
        // The list already carries a photo address for contacts WA-AKG has seen; photo() uses it before asking WhatsApp.
        if (typeof chat.profilePic === 'string' && chat.profilePic && this.photoUrls.size < MAX_CACHED_PHOTOS) this.photoUrls.set(`${connection.sessionId}|${chat.jid}`, chat.profilePic);
        const last = chat.lastMessage && typeof chat.lastMessage === 'object' ? chat.lastMessage as Record<string, unknown> : null;
        return {
          ...this.conversation(chat.jid, customers, textOf(chat.name) ?? textOf(chat.notify)),
          ...(last ? { lastMessage: { text: textOf(last.content), type: messageType(last.type), at: isoDate(last.timestamp) } } : {}),
        };
      });
    return { conversations };
  }

  async messages(tenantId: string, jid: string): Promise<WhatsAppChatMessagesResponse> {
    const connection = await this.connection(tenantId);
    const [raw, customers] = await Promise.all([this.whatsapp.chatMessages(connection, jid), this.customerIndex()]);
    // Opening the conversation marks it read on the phone too. A failure here never hides the messages.
    this.whatsapp.markChatRead(connection, jid).catch(() => this.logger.warn('Conversa aberta; leitura não confirmada no WhatsApp.'));
    const name = raw.filter((message) => message.fromMe !== true).map((message) => textOf(message.pushName)).filter(Boolean).at(-1);
    return { conversation: this.conversation(jid, customers, name), messages: raw.map((message) => this.message(message, connection)) };
  }

  async send(tenantId: string, jid: string, text: string) {
    const connection = await this.connection(tenantId);
    await this.whatsapp.sendText(connection, jid, text);
    return { sent: true };
  }

  async media(tenantId: string, file: string) {
    return this.whatsapp.mediaFile(await this.connection(tenantId), file);
  }

  // Profile photos are kept for a few hours per session and contact: WhatsApp limits how often they can be asked for,
  // and the list asks for every visible contact. A contact without a photo is remembered too.
  async photo(tenantId: string, jid: string) {
    const connection = await this.connection(tenantId);
    const key = `${connection.sessionId}|${jid}`;
    const cached = this.photos.get(key);
    if (cached && cached.expires > Date.now()) return cached.photo;
    let photo: { body: Buffer; contentType: string } | null = null;
    try {
      const url = this.photoUrls.get(key) ?? await this.whatsapp.profilePictureUrl(connection, jid);
      photo = url ? await this.whatsapp.profilePhoto(url) : null;
      // A stored address may have expired: ask WhatsApp once for the current one.
      if (!photo && this.photoUrls.has(key)) {
        const fresh = await this.whatsapp.profilePictureUrl(connection, jid);
        photo = fresh ? await this.whatsapp.profilePhoto(fresh) : null;
      }
    } catch { photo = null; }
    this.photoUrls.delete(key);
    if (this.photos.size >= MAX_CACHED_PHOTOS) this.photos.delete(this.photos.keys().next().value!);
    this.photos.set(key, { photo, expires: Date.now() + PHOTO_TTL_MS });
    return photo;
  }

  private async connection(tenantId: string): Promise<WaAkgConnection> {
    const connection = await this.whatsapp.getConnection(tenantId);
    if (!connection) throw new BadRequestException('O WhatsApp da oficina não está ativo. Ative em Configurações → WhatsApp para usar o chat.');
    return connection;
  }

  private async customerIndex() {
    const index = new Map<string, WhatsAppChatCustomer>();
    for (const customer of await this.customers.allForMatching()) {
      const digits = nationalDigits(customer.phone ?? '');
      if (digits.length >= 10 && !index.has(digits)) index.set(digits, { id: customer.id, name: customer.name });
    }
    return index;
  }

  private conversation(jid: string, customers: Map<string, WhatsAppChatCustomer>, name?: string): WhatsAppConversation {
    const phone = phoneOf(jid);
    const customer = phone ? customers.get(nationalDigits(phone)) : undefined;
    return { jid, ...(phone ? { phone } : {}), ...(name ? { name } : {}), ...(customer ? { customer } : {}) };
  }

  private message(raw: Record<string, unknown>, connection: WaAkgConnection): WhatsAppChatMessage {
    const file = typeof raw.mediaUrl === 'string' ? raw.mediaUrl.split(/[?#]/)[0].split('/').pop() : undefined;
    const media = file && CHAT_MEDIA_FILE.test(file) && file.startsWith(`${connection.sessionId}-`) ? file : undefined;
    return {
      id: String(raw.keyId ?? raw.id ?? ''), fromMe: raw.fromMe === true, type: messageType(raw.type),
      text: textOf(raw.content), at: isoDate(raw.timestamp),
      ...(typeof raw.status === 'string' ? { status: raw.status } : {}),
      ...(media ? { media } : {}),
    };
  }
}
