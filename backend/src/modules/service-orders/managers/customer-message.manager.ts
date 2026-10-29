import { BadRequestException, ConflictException, GoneException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'crypto';
import type { CustomerMessage } from '@oficina/database';
import { QUOTE_APPROVAL_OPTIONS, QUOTE_APPROVAL_QUESTION, type CustomerMessageQuote, type CreateCustomerMessageRequest, type CreatedCustomerMessageResponse, type CustomerMessageResponse, type PublicCustomerMessageResponse } from '@oficina/contracts';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { CustomerRepository } from '../../customers/repositories/customer.repository';
import { TenantMailerService } from '../../settings/services/tenant-mailer.service';
import { ServiceOrderManager } from './service-order.manager';
import { CustomerMessageRepository } from '../repositories/customer-message.repository';
import { customerMessageContent, customerMessageEmail } from '../services/customer-message-content';
import { WaAkgService } from '../../settings/services/wa-akg.service';
import { quoteSnapshot, quoteSnapshotRevision, quotesMatch } from '../services/customer-message-quote';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class CustomerMessageManager {
  private readonly logger = new Logger(CustomerMessageManager.name);
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
    if (input.purpose === 'RATING') throw new BadRequestException('A avaliação é enviada automaticamente após a entrega da OS.');
    if (input.purpose === 'QUOTE') input = { ...input, question: QUOTE_APPROVAL_QUESTION, options: [...QUOTE_APPROVAL_OPTIONS], includeQuote: true };
    const { serviceOrder: order } = await this.orders.getById(input.serviceOrderId);
    if (order.status === 'CANCELLED') throw new BadRequestException('Não é possível solicitar respostas para uma OS cancelada.');
    if (input.includeQuote && !order.items?.length) throw new BadRequestException('Adicione itens ao orçamento antes de compartilhar.');
    if (input.purpose === 'QUOTE' && input.expectedQuoteRevision && quoteSnapshotRevision(quoteSnapshot(order)) !== input.expectedQuoteRevision) throw new ConflictException('O orçamento mudou desde a prévia. Atualize a OS e confira os valores antes de enviar.');
    if (input.purpose === 'QUOTE' && order.status === 'DELIVERED') throw new BadRequestException('Esta OS já foi entregue. Consulte o histórico da aprovação.');
    if (input.purpose === 'PICKUP' && order.status !== 'COMPLETED') throw new BadRequestException('Marque o veículo como pronto para entrega antes de enviar o aviso de retirada.');
    if (input.purpose === 'QUOTE' && order.status === 'OPEN') await this.orders.assertReadyForApproval(order.id);
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
    const message = customerMessageContent(order, input.includeQuote, input.channel === 'WHATSAPP' ? input.purpose ?? 'CUSTOM' : undefined);
    const text = `${message}\n\n${input.question}\n${input.options.map((option) => `• ${option}`).join('\n')}\n\n${input.channel === 'WHATSAPP' ? '🔗 ' : ''}Responda pelos botões neste link (válido por 7 dias):\n${responseUrl}`;
    const record = await this.messages.create({
      tenantId: user.tenantId, serviceOrderId: order.id, customerId: order.customerId,
      purpose: input.purpose ?? 'CUSTOM',
      ...(input.includeQuote ? { quoteSnapshot: JSON.parse(JSON.stringify(quoteSnapshot(order))) } : {}),
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
      // Once SMTP accepted the message, a database failure must not delete
      // the response link that the customer may already have received.
      await this.messages.markSent(record.id);
    }
    if (connection) {
      const result = await this.whatsapp.sendButtons(connection, { recipient: `${normalizedPhone}@s.whatsapp.net`, message, question: input.question, options: input.options, token });
      await this.messages.markSent(record.id, result.providerMessageId);
    }
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'customer_message.created', entity: 'customer_message', entityId: record.id, metadata: { serviceOrderId: order.id } });
    const sent = input.channel === 'EMAIL' || Boolean(connection);
    const workflowWarning = input.purpose === 'QUOTE' && sent ? await this.awaitApproval(user, order.id, order.status) : undefined;
    return { messageId: record.id, workflowWarning, responseUrl, sent, deliveryMode: connection ? 'WA_AKG' : 'LINK', ...(input.channel === 'WHATSAPP' && !connection ? { whatsappUrl: `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}` } : {}) };
  }

  async confirmDispatch(user: AuthenticatedUser, id: string) {
    const message = await this.messages.byId(id);
    if (!message) throw new NotFoundException('Mensagem não encontrada.');
    const { serviceOrder: order } = await this.orders.getById(message.serviceOrderId);
    if (message.channel !== 'WHATSAPP' || message.deliveryMode !== 'LINK') throw new BadRequestException('A confirmação manual é apenas para envios pelo aplicativo WhatsApp.');
    if (message.expiresAt.getTime() <= Date.now() || ['DELIVERED', 'CANCELLED'].includes(order.status)) throw new BadRequestException('Esta solicitação não está mais disponível para envio.');
    if (message.purpose === 'QUOTE') {
      const latest = await this.messages.latestQuote(order.id);
      if (latest?.id !== message.id || !message.quoteSnapshot || !quotesMatch(message.quoteSnapshot as unknown as CustomerMessageQuote, quoteSnapshot(order))) throw new ConflictException('Esta solicitação foi substituída ou o orçamento mudou. Confira a mensagem atual antes de confirmar o envio.');
    }
    if (order.status === 'OPEN' && message.purpose === 'QUOTE') await this.orders.assertReadyForApproval(order.id);
    if (!message.sentAt) await this.messages.markSent(id);
    const workflowWarning = message.purpose === 'QUOTE' ? await this.awaitApproval(user, order.id, order.status) : undefined;
    return { sent: true, workflowWarning };
  }

  private async awaitApproval(user: AuthenticatedUser, id: string, status: string) {
    if (status !== 'OPEN') return undefined;
    try { await this.orders.transition(user, { id, toStatus: 'AWAITING_APPROVAL' }); }
    catch {
      this.logger.warn(`Mensagem enviada; status de aprovação não atualizado para OS ${id}.`);
      return 'A mensagem foi enviada, mas o status da OS não foi atualizado. Confira o atendimento antes de reenviar.';
    }
    return undefined;
  }

  async list(serviceOrderId: string): Promise<{ messages: CustomerMessageResponse[] }> {
    const { serviceOrder: order } = await this.orders.getById(serviceOrderId);
    const messages = await this.messages.list(serviceOrderId);
    return { messages: messages.map((message) => ({
      id: message.id, channel: message.channel as CustomerMessageResponse['channel'], question: message.question,
      purpose: message.purpose as CustomerMessageResponse['purpose'],
      ...(message.quoteSnapshot ? { quote: message.quoteSnapshot as unknown as CustomerMessageQuote, quoteIsCurrent: quotesMatch(message.quoteSnapshot as unknown as CustomerMessageQuote, quoteSnapshot(order)) } : {}),
      deliveryMode: message.deliveryMode as CustomerMessageResponse['deliveryMode'], sentAt: message.sentAt?.toISOString(),
      options: message.options, message: message.message, createdAt: message.createdAt.toISOString(), ...this.responseFields(message),
    })) };
  }

  async getPublic(token: string): Promise<PublicCustomerMessageResponse> {
    const record = await this.requireToken(token);
    const { message } = record;
    if (message.deliveryMode === 'WA_AKG') throw new NotFoundException('Responda pelos botões na conversa do WhatsApp.');
    return this.publicResponse(record);
  }

  async answer(token: string, selectedOption: number): Promise<PublicCustomerMessageResponse> {
    const record = await this.requireToken(token);
    const { message } = record;
    if (message.deliveryMode === 'WA_AKG') throw new NotFoundException('Responda pelos botões na conversa do WhatsApp.');
    return (await this.answerToken(token, selectedOption)).response;
  }

  private async answerToken(token: string, selectedOption: number): Promise<{ response: PublicCustomerMessageResponse; newlyRecorded: boolean }> {
    const record = await this.requireToken(token);
    const { message } = record;
    if (!Number.isInteger(selectedOption) || selectedOption < 0 || selectedOption >= message.options.length) throw new BadRequestException('Escolha uma das opções disponíveis.');
    if (message.answeredAt) {
      if (message.selectedOption === selectedOption) return { response: await this.getTokenResponse(token), newlyRecorded: false };
      throw new ConflictException('Uma resposta já foi registrada para esta pergunta.');
    }
    const availability = this.availability(record);
    if (!availability.canAnswer) throw new ConflictException(availability.unavailableReason);
    const result = await this.messages.answer(message.id, message.tenantId, hashToken(token), selectedOption);
    if (result.count !== 1) {
      const current = await this.requireToken(token);
      if (current.message.selectedOption === selectedOption) return { response: await this.getTokenResponse(token), newlyRecorded: false };
      throw new ConflictException('Uma resposta já foi registrada para esta pergunta.');
    }
    await this.audit.record({ tenantId: message.tenantId, action: 'customer_message.answered', entity: 'customer_message', entityId: message.id, metadata: { serviceOrderId: message.serviceOrderId } });
    return { response: await this.getTokenResponse(token), newlyRecorded: true };
  }

  async answerFromWhatsApp(tenantId: string, sessionId: string, sender: string, content: string) {
    const match = /^axm:([a-f0-9]{64}):([0-4])$/.exec(content);
    if (!match) return { received: true, recorded: false, reason: 'UNRECOGNIZED_BUTTON' };
    const [, token, option] = match;
    const record = await this.messages.byTokenHash(hashToken(token));
    const message = record?.message;
    // Only the original recipient, session and tenant may answer this dispatch.
    if (!message || message.tenantId !== tenantId || message.channel !== 'WHATSAPP' || message.deliveryMode !== 'WA_AKG' || message.whatsappSessionId !== sessionId || message.whatsappRecipient !== sender) {
      return { received: true, recorded: false, reason: 'MESSAGE_OR_SENDER_MISMATCH' };
    }
    try {
      const result = await this.answerToken(token, Number(option));
      if (!result.newlyRecorded) return { received: true, recorded: true, confirmation: 'already_recorded' };
      // The database's conditional write elects one sender, including concurrent
      // callbacks. A confirmation failure never reverses the recorded choice.
      try {
        const connection = await this.whatsapp.getConnection(tenantId);
        if (!connection || connection.sessionId !== sessionId) throw new Error('Session changed');
        await this.whatsapp.sendConfirmation(connection, sender, message.options[Number(option)]);
        return { received: true, recorded: true, confirmation: 'sent' };
      } catch {
        this.logger.warn(`Resposta registrada; confirmação WhatsApp não confirmada para mensagem ${message.id}.`);
        return { received: true, recorded: true, confirmation: 'failed' };
      }
    } catch (error) {
      // Duplicate/late events are acknowledged without changing the first answer.
      if (message.purpose === 'QUOTE' && (error instanceof ConflictException || error instanceof GoneException)) {
        try {
          const connection = await this.whatsapp.getConnection(tenantId);
          if (connection?.sessionId === sessionId) await this.whatsapp.sendNotice(connection, sender, `⚠️ *SOLICITAÇÃO INDISPONÍVEL*\n\n${error.message}\n\n💬 Entre em contato com a oficina para conferir a solicitação atual.`);
        } catch { this.logger.warn(`Aviso de solicitação indisponível não confirmado para mensagem ${message.id}.`); }
      }
      if (error instanceof ConflictException || error instanceof GoneException || error instanceof NotFoundException || error instanceof BadRequestException) return { received: true, recorded: false, reason: error instanceof ConflictException ? 'ALREADY_ANSWERED_DIFFERENTLY' : error instanceof GoneException ? 'EXPIRED' : 'UNAVAILABLE_OR_INVALID_OPTION' };
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
    return this.publicResponse(await this.requireToken(token));
  }

  private availability(record: NonNullable<Awaited<ReturnType<CustomerMessageRepository['byTokenHash']>>>) {
    if (record.message.purpose === 'QUOTE') {
      if (record.quoteIsCurrent === false) return { canAnswer: false, unavailableReason: 'Este orçamento foi alterado. Solicite à oficina a versão atualizada.' };
      if (record.isLatestQuote === false) return { canAnswer: false, unavailableReason: 'Há uma solicitação mais recente. Responda à última mensagem enviada pela oficina.' };
      if (['DELIVERED', 'CANCELLED'].includes(record.orderStatus)) return { canAnswer: false, unavailableReason: 'Este atendimento já foi encerrado. Entre em contato com a oficina.' };
    }
    return { canAnswer: true };
  }

  private publicResponse(record: NonNullable<Awaited<ReturnType<CustomerMessageRepository['byTokenHash']>>>): PublicCustomerMessageResponse {
    const { message, companyName, quoteIsCurrent } = record;
    const snapshot = message.quoteSnapshot as unknown as CustomerMessageQuote | null;
    return { companyName, purpose: message.purpose as PublicCustomerMessageResponse['purpose'], question: message.question, options: message.options, message: message.message,
      ...(snapshot ? { quote: { ...snapshot, items: snapshot.items.map(({ description, type, quantity, unitPriceCents, lineTotalCents }) => ({ description, type, quantity, unitPriceCents, lineTotalCents })) }, quoteIsCurrent } : {}),
      ...this.availability(record), ...this.responseFields(message) };
  }
}
