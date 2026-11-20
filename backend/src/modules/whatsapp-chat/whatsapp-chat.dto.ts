import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

// Only one-to-one chats: a phone address or WhatsApp's private id. Groups, lists and channels stay out of Ofix.
export const PRIVATE_CHAT_JID = /^\d{8,20}@(s\.whatsapp\.net|lid)$/;
export const CHAT_MEDIA_FILE = /^[A-Za-z0-9_-]+-[A-Za-z0-9_-]+\.[a-z0-9]{2,5}$/;

export class WhatsAppChatJidParams {
  @Matches(PRIVATE_CHAT_JID, { message: 'Conversa inválida.' }) jid!: string;
}

export class WhatsAppChatMediaParams {
  @Matches(CHAT_MEDIA_FILE, { message: 'Arquivo inválido.' }) file!: string;
}

export class SendWhatsAppChatMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString() @IsNotEmpty({ message: 'Escreva a mensagem.' }) @MaxLength(4096, { message: 'A mensagem pode ter até 4096 caracteres.' })
  text!: string;
}
