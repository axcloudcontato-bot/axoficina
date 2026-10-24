import { BadRequestException, ConflictException, GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import type { CustomerMessage } from '@oficina/database';
import type { CreateCustomerMessageRequest, CreatedCustomerMessageResponse, CustomerMessageResponse, PublicCustomerMessageResponse } from '@oficina/contracts';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { CustomerRepository } from '../../customers/repositories/customer.repository';
import { TenantMailerService } from '../../settings/services/tenant-mailer.service';
import { ServiceOrderManager } from './service-order.manager';
import { CustomerMessageRepository } from '../repositories/customer-message.repository';
import { customerMessageContent, customerMessageEmail } from '../services/customer-message-content';
import { WaAkgService } from '../../settings/services/wa-akg.service';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class CustomerMessageManager {
  constructor(
    private readonly messages: CustomerMessageRepository,
    private readonly orders: ServiceOrderManager,
    private readonly customers: CustomerRepository,
    private readonly mailer: TenantMailerService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
    private readonly whatsapp: WaAkgService,
  ) {}

  async create(user: AuthenticatedUser, input: CreateCustomerMessageRequest): Promise<CreatedCustomerMessageResponse> {
    const { serviceOrder: order } = await this.orders.getById(input.serviceOrderId);
    if (order.status === 'CANCELLED') throw new BadRequestException('Não é possível solicitar respostas para uma OS cancelada.');
    if (input.includeQuote && !order.items?.length) throw new BadRequestException('Adicione itens ao orçamento antes de compartilhar.');
    const customer = await this.customers.byId(order.customerId);
    if (!customer) throw new NotFoundException('Cliente não encontrado.');
    const phone = customer.phone.replace(/\D/g, '');
    const normalizedPhone = phone.length === 10 || phone.length === 11 ? `55${phone}` : /^55\d{10,11}$/.test(phone) ? phone : null;
    if (input.channel === 'WHATSAPP' && !normalizedPhone) throw new BadRequestException('O cliente não possui um telefone válido para WhatsApp.');
    if (input.channel === 'EMAIL' && !customer.email?.trim()) throw new BadRequestException('O cliente não possui um e-mail cadastrado.');
    const connection = input.channel === 'WHATSAPP' ? await this.whatsapp.getConnection(user.tenantId) : null;

    const frontendUrl = new URL(this.config.get<string>('FRONTEND_URL', 'http://localhost:3000'));
    if (!['http:', 'https:'].includes(frontendUrl.protocol)) throw new BadRequestException('Configure uma URL pública válida para o sistema.');
    const token = randomBytes(32).toString('hex');
    const responseUrl = new URL(`/responder/${token}`, frontendUrl).toString();
    const message = customerMessageContent(order, input.includeQuote);
    const text = `${message}\n\n${input.question}\n${input.options.map((option) => `• ${option}`).join('\n')}\n\nResponda pelos botões neste link (válido por 7 dias):\n${responseUrl}`;
    const record = await this.messages.create({
      tenantId: user.tenantId, serviceOrderId: order.id, customerId: order.customerId,
      channel: input.channel, question: input.question, options: input.options, message,
      tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deliveryMode: connection ? 'WA_AKG' : 'LINK',
      whatsappSessionId: connection?.sessionId,
      whatsappRecipient: connection ? `${normalizedPhone}@s.whatsapp.net` : undefined,
    });
    if (input.channel === 'EMAIL') {
      try {
        await this.mailer.send(user.tenantId, {
          to: customer.email!.trim(), subject: `Resposta solicitada — OS #${String(order.orderNumber).padStart(5, '0')}`,
          text, html: customerMessageEmail(message, input.question, input.options, responseUrl),
        });
      } catch (error) {
        await this.messages.remove(record.id);
        throw error;
      }
    }
    if (connection) {
      const result = await this.whatsapp.sendButtons(connection, { recipient: `${normalizedPhone}@s.whatsapp.net`, message, question: input.question, options: input.options, token });
      await this.messages.markSent(record.id, result.providerMessageId);
    }
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'customer_message.created', entity: 'customer_message', entityId: record.id, metadata: { serviceOrderId: order.id } });
    return { responseUrl, sent: input.channel === 'EMAIL' || Boolean(connection), deliveryMode: connection ? 'WA_AKG' : 'LINK', ...(input.channel === 'WHATSAPP' && !connection ? { whatsappUrl: `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}` } : {}) };
  }

  async list(serviceOrderId: string): Promise<{ messages: CustomerMessageResponse[] }> {
    await this.orders.getById(serviceOrderId);
    const messages = await this.messages.list(serviceOrderId);
    return { messages: messages.map((message) => ({
      id: message.id, channel: message.channel as CustomerMessageResponse['channel'], question: message.question,
      deliveryMode: message.deliveryMode as CustomerMessageResponse['deliveryMode'], sentAt: message.sentAt?.toISOString(),
      options: message.options, message: message.message, createdAt: message.createdAt.toISOString(), ...this.responseFields(message),
    })) };
  }

  async getPublic(token: string): Promise<PublicCustomerMessageResponse> {
    const { message, companyName } = await this.requireToken(token);
    if (message.deliveryMode === 'WA_AKG') throw new NotFoundException('Responda pelos botões na conversa do WhatsApp.');
    return { companyName, question: message.question, options: message.options, message: message.message, ...this.responseFields(message) };
  }

  async answer(token: string, selectedOption: number): Promise<PublicCustomerMessageResponse> {
    const { message } = await this.requireToken(token);
    if (message.deliveryMode === 'WA_AKG') throw new NotFoundException('Responda pelos botões na conversa do WhatsApp.');
    return this.answerToken(token, selectedOption);
  }

  private async answerToken(token: string, selectedOption: number): Promise<PublicCustomerMessageResponse> {
    const { message } = await this.requireToken(token);
    if (!Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption >= message.options.length) throw new BadRequestException('Escolha uma das opções disponíveis.');
    if (message.answeredAt) {
      if (message.selectedOption === selectedOption) return this.getTokenResponse(token);
      throw new ConflictException('Uma resposta já foi registrada para esta pergunta.');
    }
    const result = await this.messages.answer(message.id, message.tenantId, hashToken(token), selectedOption);
    if (result.count !== 1) {
      const current = await this.requireToken(token);
      if (current.message.selectedOption === selectedOption) return this.getTokenResponse(token);
      throw new ConflictException('Uma resposta já foi registrada para esta pergunta.');
    }
    await this.audit.record({ tenantId: message.tenantId, action: 'customer_message.answered', entity: 'customer_message', entityId: message.id, metadata: { serviceOrderId: message.serviceOrderId } });
    return this.getTokenResponse(token);
  }

  async answerFromWhatsApp(tenantId: string, sessionId: string, sender: string, content: string) {
    const match = /^axm:([a-f0-9]{64}):([0-2])$/.exec(content);
    if (!match) return { received: true, recorded: false };
    const [, token, option] = match;
    const record = await this.messages.byTokenHash(hashToken(token));
    const message = record?.message;
    // Only the original recipient, session and tenant may answer this dispatch.
    if (!message || message.tenantId !== tenantId || message.channel !== 'WHATSAPP' || message.deliveryMode !== 'WA_AKG' || message.whatsappSessionId !== sessionId || message.whatsappRecipient !== sender) {
      return { received: true, recorded: false };
    }
    try {
      await this.answerToken(token, Number(option));
      return { received: true, recorded: true };
    } catch (error) {
      // Duplicate/late events are acknowledged without changing the first answer.
      if (error instanceof ConflictException || error instanceof GoneException || error instanceof NotFoundException || error instanceof BadRequestException) return { received: true, recorded: false };
      throw error;
    }
  }

  private async requireToken(token: string) {
    const record = await this.messages.byTokenHash(hashToken(token));
    if (!record) throw new NotFoundException('Link de resposta inválido ou indisponível.');
    if (record.message.expiresAt.getTime() <= Date.now()) throw new GoneException('Este link expirou. Solicite uma nova mensagem à oficina.');
    return record;
  }

  private responseFields(message: CustomerMessage) {
    return { expiresAt: message.expiresAt.toISOString(), answeredAt: message.answeredAt?.toISOString(), selectedOption: message.selectedOption ?? undefined };
  }

  private async getTokenResponse(token: string): Promise<PublicCustomerMessageResponse> {
    const { message, companyName } = await this.requireToken(token);
    return { companyName, question: message.question, options: message.options, message: message.message, ...this.responseFields(message) };
  }
}
