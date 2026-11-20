import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { CustomersModule } from '../customers/customers.module';
import { WhatsAppChatController } from './whatsapp-chat.controller';
import { WhatsAppChatManager } from './whatsapp-chat.manager';

@Module({ imports: [SettingsModule, CustomersModule], controllers: [WhatsAppChatController], providers: [WhatsAppChatManager] })
export class WhatsAppChatModule {}
