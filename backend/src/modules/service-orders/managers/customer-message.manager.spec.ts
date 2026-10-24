import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CustomerMessageManager } from './customer-message.manager';
import { CreateCustomerMessageDto } from '../dto/customer-message.dto';

const token = 'a'.repeat(64);
const user = { tenantId: 'tenant-a', userId: 'user-a', role: 'ADMIN' as const };
function setup() {
  const record = {
    id: 'message-1', tenantId: user.tenantId, serviceOrderId: 'order-1', customerId: 'customer-1',
    channel: 'EMAIL', question: 'Aprova?', options: ['Sim', 'Não'], message: 'Total: R$ 350,00',
    deliveryMode: 'LINK', sentAt: null, whatsappSessionId: null as string | null, whatsappRecipient: null as string | null,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), answeredAt: null as Date | null, selectedOption: null as number | null,
  };
  const messages = { create: jest.fn().mockResolvedValue(record), markSent: jest.fn(), remove: jest.fn(), list: jest.fn().mockResolvedValue([record]), byTokenHash: jest.fn().mockImplementation(async () => ({ message: record, companyName: 'Oficina' })), answer: jest.fn().mockImplementation(async (_id, _tenantId, _hash, option: number) => { record.selectedOption = option; record.answeredAt = new Date(); return { count: 1 }; }) };
  const order = { id: 'order-1', customerId: 'customer-1', orderNumber: 12, status: 'OPEN', customerName: '<Cliente>', vehicleBrand: 'Honda', vehicleModel: 'Fit', vehiclePlate: 'ABC1234', totalAmountCents: 35000, items: [{ description: '<Freios & óleo>', type: 'PART', lineTotalCents: 35000 }] };
  const orders = { getById: jest.fn().mockResolvedValue({ serviceOrder: order }) };
  const customers = { byId: jest.fn().mockResolvedValue({ email: 'cliente@example.invalid', phone: '(12) 99999-9999' }) };
  const mailer = { send: jest.fn().mockResolvedValue({}) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const whatsapp = { getConnection: jest.fn().mockResolvedValue(null), sendButtons: jest.fn().mockResolvedValue({ providerMessageId: 'wa-1' }), sendConfirmation: jest.fn().mockResolvedValue(undefined) };
  const manager = new CustomerMessageManager(messages as never, orders as never, customers as never, mailer as never, new ConfigService({ FRONTEND_URL: 'https://oficina.example' }), audit as never, whatsapp as never);
  return { record, messages, order, orders, customers, mailer, audit, whatsapp, manager };
}

const input = { serviceOrderId: 'order-1', channel: 'EMAIL' as const, question: 'Aprova <este> orçamento?', options: ['Sim & aprovar', 'Não'], includeQuote: true };

describe('Customer message replies', () => {
  it('sends HTML buttons with escaped content, authoritative quote and only a hashed token in storage', async () => {
    const { manager, messages, mailer } = setup();
    const result = await manager.create(user, input);
    const newToken = new URL(result.responseUrl).pathname.split('/').pop()!;
    expect(newToken).toMatch(/^[a-f0-9]{64}$/);
    expect(messages.create.mock.calls[0][0].tokenHash).toBe(createHash('sha256').update(newToken).digest('hex'));
    expect(messages.create.mock.calls[0][0]).not.toHaveProperty('token');
    expect(mailer.send).toHaveBeenCalledWith('tenant-a', expect.objectContaining({ to: 'cliente@example.invalid', html: expect.stringContaining('?option=0') }));
    const email = mailer.send.mock.calls[0][1];
    expect(email.html).toContain('&lt;Freios &amp; óleo&gt;');
    expect(email.html).toContain('Sim &amp; aprovar');
    expect(email.html).not.toContain('<Cliente>');
    expect(email.text).toContain('350,00');
    expect(result.sent).toBe(true);
  });

  it('prepares WhatsApp text with a public reply link and no SMTP send', async () => {
    const { manager, mailer } = setup();
    const result = await manager.create(user, { ...input, channel: 'WHATSAPP', includeQuote: false });
    expect(result.sent).toBe(false);
    expect(result.whatsappUrl).toMatch(/^https:\/\/wa.me\/5512999999999\?text=/);
    expect(decodeURIComponent(result.whatsappUrl!)).toContain(result.responseUrl);
    expect(decodeURIComponent(result.whatsappUrl!)).not.toContain('350,00');
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('removes the unusable response link on SMTP failure', async () => {
    const { manager, mailer, messages } = setup();
    mailer.send.mockRejectedValueOnce(new Error('SMTP offline'));
    await expect(manager.create(user, input)).rejects.toThrow('SMTP offline');
    expect(messages.remove).toHaveBeenCalledWith('message-1');
  });

  it('dispatches native buttons with unique ids and records provider acceptance', async () => {
    const { manager, messages, whatsapp } = setup();
    whatsapp.getConnection.mockResolvedValue({ baseUrl: 'https://chat.axcloud.com.br/api', sessionId: 'oficina', apiKey: 'secret' });
    const result = await manager.create(user, { ...input, channel: 'WHATSAPP' });
    expect(result).toMatchObject({ sent: true, deliveryMode: 'WA_AKG' });
    expect(result).not.toHaveProperty('whatsappUrl');
    expect(messages.create).toHaveBeenCalledWith(expect.objectContaining({ deliveryMode: 'WA_AKG', whatsappSessionId: 'oficina', whatsappRecipient: '5512999999999@s.whatsapp.net' }));
    expect(whatsapp.sendButtons).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ options: input.options, token: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(messages.markSent).toHaveBeenCalledWith('message-1', 'wa-1');
  });

  it('keeps the record if native delivery is uncertain and does not silently send again', async () => {
    const { manager, messages, whatsapp } = setup();
    whatsapp.getConnection.mockResolvedValue({ baseUrl: 'https://chat.axcloud.com.br/api', sessionId: 'oficina', apiKey: 'secret' });
    whatsapp.sendButtons.mockRejectedValue(new Error('timeout'));
    await expect(manager.create(user, { ...input, channel: 'WHATSAPP' })).rejects.toThrow('timeout');
    expect(messages.remove).not.toHaveBeenCalled();
    expect(messages.markSent).not.toHaveBeenCalled();
    expect(whatsapp.sendButtons).toHaveBeenCalledTimes(1);
  });

  it('binds native responses to the original sender, tenant and session and blocks the public-link bypass', async () => {
    const { manager, record, messages, whatsapp } = setup();
    Object.assign(record, { channel: 'WHATSAPP', deliveryMode: 'WA_AKG', whatsappSessionId: 'oficina', whatsappRecipient: '5512999999999@s.whatsapp.net' });
    whatsapp.getConnection.mockResolvedValue({ baseUrl: 'https://chat.axcloud.com.br/api', sessionId: 'oficina', apiKey: 'secret' });
    const content = `axm:${token}:0`;
    await expect(manager.answerFromWhatsApp('other-tenant', 'oficina', record.whatsappRecipient!, content)).resolves.toMatchObject({ recorded: false });
    await expect(manager.answerFromWhatsApp(user.tenantId, 'other-session', record.whatsappRecipient!, content)).resolves.toMatchObject({ recorded: false });
    await expect(manager.answerFromWhatsApp(user.tenantId, 'oficina', '5511888888888@s.whatsapp.net', content)).resolves.toMatchObject({ recorded: false });
    await expect(manager.answerFromWhatsApp(user.tenantId, 'oficina', record.whatsappRecipient!, 'Sim')).resolves.toMatchObject({ recorded: false });
    await expect(manager.answer(token, 0)).rejects.toThrow('conversa do WhatsApp');
    await expect(manager.getPublic(token)).rejects.toThrow('conversa do WhatsApp');
    expect(messages.answer).not.toHaveBeenCalled();
    await expect(manager.answerFromWhatsApp(user.tenantId, 'oficina', record.whatsappRecipient!, content)).resolves.toMatchObject({ recorded: true, confirmation: 'sent' });
    await expect(manager.answerFromWhatsApp(user.tenantId, 'oficina', record.whatsappRecipient!, content)).resolves.toMatchObject({ recorded: true, confirmation: 'already_recorded' });
    await expect(manager.answerFromWhatsApp(user.tenantId, 'oficina', record.whatsappRecipient!, `axm:${token}:1`)).resolves.toMatchObject({ recorded: false });
    expect(messages.answer).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendConfirmation).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendConfirmation).toHaveBeenCalledWith(expect.any(Object), record.whatsappRecipient, record.question, 'Sim');
  });

  it('preserves the choice and acknowledges the webhook when sending the confirmation fails', async () => {
    const { manager, record, whatsapp } = setup();
    Object.assign(record, { channel: 'WHATSAPP', deliveryMode: 'WA_AKG', whatsappSessionId: 'oficina', whatsappRecipient: '5512999999999@s.whatsapp.net' });
    whatsapp.getConnection.mockResolvedValue({ baseUrl: 'https://chat.axcloud.com.br/api', sessionId: 'oficina', apiKey: 'secret' });
    whatsapp.sendConfirmation.mockRejectedValue(new Error('Gateway offline'));
    await expect(manager.answerFromWhatsApp(user.tenantId, 'oficina', record.whatsappRecipient!, `axm:${token}:0`)).resolves.toMatchObject({ recorded: true, confirmation: 'failed' });
    expect(record.selectedOption).toBe(0);
    expect(record.answeredAt).not.toBeNull();
    await manager.answerFromWhatsApp(user.tenantId, 'oficina', record.whatsappRecipient!, `axm:${token}:0`);
    expect(whatsapp.sendConfirmation).toHaveBeenCalledTimes(1);
  });

  it('checks tenant-scoped order access before creating or listing messages', async () => {
    const { manager, orders, messages } = setup();
    orders.getById.mockRejectedValue(new Error('Not found'));
    await expect(manager.create(user, input)).rejects.toThrow('Not found');
    await expect(manager.list('another-tenant-order')).rejects.toThrow('Not found');
    expect(messages.create).not.toHaveBeenCalled();
    expect(messages.list).not.toHaveBeenCalled();
  });

  it('does not expose internal ids or token hashes publicly and GET never answers', async () => {
    const { manager, messages } = setup();
    const response = await manager.getPublic(token);
    expect(response).not.toHaveProperty('tokenHash');
    expect(response).not.toHaveProperty('tenantId');
    expect(response).not.toHaveProperty('customerId');
    expect(messages.answer).not.toHaveBeenCalled();
  });

  it('rejects an expired or unavailable link without writing a response', async () => {
    const { manager, record, messages } = setup();
    record.expiresAt = new Date(Date.now() - 1);
    await expect(manager.answer(token, 0)).rejects.toThrow('expirou');
    expect(messages.answer).not.toHaveBeenCalled();
    messages.byTokenHash.mockResolvedValueOnce(null);
    await expect(manager.getPublic(token)).rejects.toThrow('inválido');
  });

  it('rejects an option that is not in the question and prevents changing an answer', async () => {
    const { manager, messages } = setup();
    await expect(manager.answer(token, 2)).rejects.toThrow('opções disponíveis');
    await manager.answer(token, 0);
    await expect(manager.answer(token, 0)).resolves.toMatchObject({ selectedOption: 0 });
    await expect(manager.answer(token, 1)).rejects.toThrow('já foi registrada');
    expect(messages.answer).toHaveBeenCalledTimes(1);
  });

  it('does not accept the losing write of a concurrent answer', async () => {
    const { manager, record, messages } = setup();
    messages.answer.mockImplementationOnce(async () => { record.selectedOption = 1; record.answeredAt = new Date(); return { count: 0 }; });
    await expect(manager.answer(token, 0)).rejects.toThrow('já foi registrada');
  });

  it.each([
    { question: ' ', options: ['Sim', 'Não'] },
    { question: 'Aprova?', options: ['Sim', 'sim '] },
    { question: 'Aprova?', options: ['Sim', ''] },
    { question: 'Aprova?', options: ['A', 'B', 'C', 'D'] },
  ])('validates question and button labels: %j', async (changes) => {
    const dto = plainToInstance(CreateCustomerMessageDto, { ...input, serviceOrderId: 'dffb4d33-1b58-441d-bb18-06770469737a', ...changes });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
