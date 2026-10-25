import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { LEGAL_VERSION } from '@oficina/contracts';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { AuditLogService } from '../src/shared/audit-log/audit-log.service';
import { TenantMailerService } from '../src/modules/settings/services/tenant-mailer.service';
import { generateValidCpf } from './utils/generate-cpf';
import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

describe('Customer message buttons (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenantIds: string[] = [];
  const mailer = { send: jest.fn().mockResolvedValue({}) };
  let owner: { token: string; tenantId: string };
  let outsider: { token: string; tenantId: string };
  let orderId: string;
  let publicToken: string;
  let messageId: string;
  let winningOption: number;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TenantMailerService).useValue(mailer)
      .overrideProvider(AuditLogService).useValue({ record: async () => undefined })
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    // This suite sends concurrent replies. The suite owns the listener so
    // Supertest cannot close it before all responses have completed.
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    async function signup(suffix: string) {
      const result = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
        accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: `Reply buttons ${suffix}`,
        tenant_document: generateValidCpf(), admin_name: 'Teste botões',
        admin_email: `reply-buttons-${suffix}-${Date.now()}@example.invalid`, password: 'supersecret1',
      }).expect(201);
      tenantIds.push(result.body.tenant.id);
      return { token: result.body.access_token as string, tenantId: result.body.tenant.id as string };
    }
    owner = await signup('owner');
    outsider = await signup('outsider');
    const customer = await prisma.unscoped.customer.create({ data: { tenantId: owner.tenantId, type: 'PF', document: generateValidCpf(), name: 'Cliente de teste', phone: '11999998888', email: 'client@example.invalid' } });
    const vehicle = await prisma.unscoped.vehicle.create({ data: { tenantId: owner.tenantId, customerId: customer.id, brand: 'Fiat', model: 'Uno', plate: 'TST0001' } });
    const order = await prisma.unscoped.serviceOrder.create({ data: { tenantId: owner.tenantId, customerId: customer.id, vehicleId: vehicle.id, orderNumber: 1, status: 'OPEN', openedAt: new Date() } });
    orderId = order.id;
  });

  afterAll(async () => {
    if (prisma && tenantIds.length) {
      const where = { tenantId: { in: tenantIds } };
      await prisma.unscoped.customerReplyRead.deleteMany({ where });
      await prisma.unscoped.customerMessage.deleteMany({ where });
      await prisma.unscoped.serviceOrder.deleteMany({ where });
      await prisma.unscoped.vehicle.deleteMany({ where });
      await prisma.unscoped.customer.deleteMany({ where });
      await prisma.unscoped.user.deleteMany({ where });
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await app?.close();
  });

  const payload = () => ({ service_order_id: orderId, channel: 'WHATSAPP', question: 'Confirma a retirada?', options: ['Confirmar', 'Outro horário'], include_quote: false });
  afterEach(() => jest.restoreAllMocks());

  it('requires authentication and rejects empty or duplicate button options', async () => {
    await request(app.getHttpServer()).post('/api/v1/service-orders/customer-messages').send(payload()).expect(401);
    for (const options of [['Sim', 'sim '], ['Sim', ' '], ['A', 'B', 'C', 'D']]) {
      await request(app.getHttpServer()).post('/api/v1/service-orders/customer-messages').set('Authorization', `Bearer ${owner.token}`).send({ ...payload(), options }).expect(400);
    }
  });

  it('creates a public reply link for WhatsApp and isolates history by tenant', async () => {
    const result = await request(app.getHttpServer()).post('/api/v1/service-orders/customer-messages').set('Authorization', `Bearer ${owner.token}`).send(payload()).expect(201);
    publicToken = new URL(result.body.response_url).pathname.split('/').pop()!;
    expect(result.body.sent).toBe(false);
    expect(result.body.whatsapp_url).toContain('https://wa.me/5511999998888?text=');
    expect(mailer.send).not.toHaveBeenCalled();
    const history = await request(app.getHttpServer()).get('/api/v1/service-orders/customer-messages').query({ serviceOrderId: orderId }).set('Authorization', `Bearer ${owner.token}`).expect(200);
    messageId = history.body.messages[0].id;
    expect(history.body.messages).toHaveLength(1);
    expect(history.body.messages[0]).not.toHaveProperty('token_hash');
    await request(app.getHttpServer()).get('/api/v1/service-orders/customer-messages').query({ serviceOrderId: orderId }).set('Authorization', `Bearer ${outsider.token}`).expect(404);
    await request(app.getHttpServer()).post('/api/v1/service-orders/customer-messages').set('Authorization', `Bearer ${outsider.token}`).send(payload()).expect(404);
  });

  it('opens without login and GET never records a response', async () => {
    const result = await request(app.getHttpServer()).get('/api/v1/public/customer-message').query({ token: publicToken }).expect(200);
    expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body).toMatchObject({ question: 'Confirma a retirada?', options: ['Confirmar', 'Outro horário'] });
    expect(result.body).not.toHaveProperty('token_hash');
    expect(result.body).not.toHaveProperty('tenant_id');
    expect((await prisma.unscoped.customerMessage.findUniqueOrThrow({ where: { id: messageId } })).answeredAt).toBeNull();
    await request(app.getHttpServer()).post('/api/v1/public/customer-message/answer').send({ token: publicToken, selected_option: 2 }).expect(400);
  });

  it('atomically accepts only one concurrent response, then permits an identical retry', async () => {
    const results = await Promise.all([0, 1].map((option) => request(app.getHttpServer()).post('/api/v1/public/customer-message/answer').send({ token: publicToken, selected_option: option })));
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    winningOption = results.find((result) => result.status === 200)!.body.selected_option as number;
    await request(app.getHttpServer()).post('/api/v1/public/customer-message/answer').send({ token: publicToken, selected_option: winningOption }).expect(200);
    const history = await request(app.getHttpServer()).get('/api/v1/service-orders/customer-messages').query({ serviceOrderId: orderId }).set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(history.body.messages[0]).toMatchObject({ selected_option: winningOption, answered_at: expect.any(String) });
  });

  it('keeps a persistent response notification per user and isolates tenants and permissions', async () => {
    const path = '/api/v1/customer-reply-notifications';
    await request(app.getHttpServer()).get(path).expect(401);
    const initial = await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(initial.headers['cache-control']).toBe('no-store');
    expect(initial.body).toMatchObject({ unread_count: 1, items: [{ id: messageId, service_order_id: orderId, customer_name: 'Cliente de teste', selected_option: payload().options[winningOption], channel: 'WHATSAPP' }] });
    expect(JSON.stringify(initial.body)).not.toMatch(/token_hash|whatsapp_recipient|provider_message_id/);
    expect((await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${outsider.token}`).expect(200)).body).toMatchObject({ items: [], unread_count: 0 });
    await request(app.getHttpServer()).post(`${path}/${messageId}/read`).set('Authorization', `Bearer ${outsider.token}`).expect(404);
    await request(app.getHttpServer()).get(path).query({ cursor: 'invalid' }).set('Authorization', `Bearer ${owner.token}`).expect(400);
    await Promise.all([0, 1].map(() => request(app.getHttpServer()).post(`${path}/${messageId}/read`).set('Authorization', `Bearer ${owner.token}`).expect(200)));
    const read = await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(read.body).toMatchObject({ unread_count: 0, items: [{ id: messageId, read_at: expect.any(String) }] });
    expect(await prisma.unscoped.customerReplyRead.count({ where: { tenantId: owner.tenantId, customerMessageId: messageId } })).toBe(1);
    const admin = await prisma.unscoped.user.findFirstOrThrow({ where: { tenantId: owner.tenantId } });
    const mechanicRole = await prisma.unscoped.role.findFirstOrThrow({ where: { name: 'MECHANIC', tenantId: null } });
    for (const [index, roleId] of [admin.roleId, mechanicRole.id].entries()) {
      const colleague = await prisma.unscoped.user.create({ data: { tenantId: owner.tenantId, roleId, status: 'active', name: `Colega ${index}`, email: `reply-colleague-${index}-${Date.now()}@example.invalid`, passwordHash: admin.passwordHash } });
      const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: colleague.email, password: 'supersecret1' }).expect(200);
      const token = login.body.access_token;
      const feed = await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`).expect(index === 0 ? 200 : 403);
      if (index === 0) expect(feed.body).toMatchObject({ unread_count: 1, items: [{ id: messageId }] });
      else await request(app.getHttpServer()).post(`${path}/${messageId}/read`).set('Authorization', `Bearer ${token}`).expect(403);
    }
  });

  it('renders email buttons through the configured mailer', async () => {
    const result = await request(app.getHttpServer()).post('/api/v1/service-orders/customer-messages').set('Authorization', `Bearer ${owner.token}`).send({ ...payload(), channel: 'EMAIL' }).expect(201);
    expect(result.body.sent).toBe(true);
    expect(mailer.send).toHaveBeenCalledWith(owner.tenantId, expect.objectContaining({ to: 'client@example.invalid', html: expect.stringContaining('?option=0') }));
  });

  it('sends native buttons and records only signed callbacks from the intended WhatsApp recipient', async () => {
    const webhookSecret = 'test-webhook-secret-'.repeat(3);
    const apiKey = 'private-wa-key';
    const settings = await request(app.getHttpServer()).post('/api/v1/settings/whatsapp').set('Authorization', `Bearer ${owner.token}`).send({ base_url: 'https://chat.axcloud.com.br', session_id: 'oficina', api_key: apiKey, webhook_secret: webhookSecret, enabled: true }).expect(200);
    expect(settings.body).toMatchObject({ enabled: true, api_key_configured: true, webhook_secret_configured: true });
    expect(JSON.stringify(settings.body)).not.toContain(apiKey);
    expect(JSON.stringify(settings.body)).not.toContain(webhookSecret);
    const stored = await prisma.unscoped.tenant.findFirstOrThrow({ where: { id: owner.tenantId } });
    expect(stored.waAkgApiKey).not.toBe(apiKey);
    const config = app.get(ConfigService);
    const oldApiUrl = config.get<string>('PUBLIC_API_URL');
    config.set('PUBLIC_API_URL', await app.getUrl());
    try {
      const callbackTest = await request(app.getHttpServer()).post('/api/v1/settings/whatsapp/webhook/test').set('Authorization', `Bearer ${owner.token}`).expect(200);
      expect(callbackTest.body.reachable).toBe(true);
    } finally { config.set('PUBLIC_API_URL', oldApiUrl); }
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: true, data: { key: { id: 'native-message-1' } } }), { status: 200 }));
    let sent: request.Response;
    try {
      sent = await request(app.getHttpServer()).post('/api/v1/service-orders/customer-messages').set('Authorization', `Bearer ${owner.token}`).send(payload()).expect(201);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).buttons).toHaveLength(2);
    } finally { fetchMock.mockRestore(); }
    expect(sent.body).toMatchObject({ sent: true, delivery_mode: 'WA_AKG' });
    expect(sent.body).not.toHaveProperty('whatsapp_url');
    const token = new URL(sent.body.response_url).pathname.split('/').pop()!;
    await request(app.getHttpServer()).post('/api/v1/public/customer-message/answer').send({ token, selected_option: 0 }).expect(404);
    const webhookPath = `/api/v1/webhooks/wa-akg/${owner.tenantId}`;
    const event = { event: 'message.received', sessionId: 'oficina', timestamp: new Date().toISOString(), data: { from: '5511999998888@s.whatsapp.net', isGroup: false, type: 'INTERACTIVE_RESPONSE', content: `axm:${token}:0`, key: { id: 'reply-1', fromMe: false }, display_text: 'Confirmar' } };
    const sign = (value: unknown) => `sha256=${createHmac('sha256', webhookSecret).update(JSON.stringify(value)).digest('hex')}`;
    const confirmationFetch = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: true }), { status: 200 }));
    await request(app.getHttpServer()).post(webhookPath).send(event).expect(401);
    const wrongSender = { ...event, data: { ...event.data, from: '5511888887777@s.whatsapp.net' } };
    const wrongResult = await request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(wrongSender)).send(wrongSender).expect(200);
    expect(wrongResult.body.recorded).toBe(false);
    const freeText = { ...event, data: { ...event.data, type: 'TEXT' } };
    expect((await request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(freeText)).send(freeText).expect(200)).body.recorded).toBe(false);
    await request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(event)).send(wrongSender).expect(401);
    const replies = await Promise.all([0, 1].map(() => request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(event)).send(event).expect(200)));
    expect(replies.map((reply) => reply.body.confirmation).sort()).toEqual(['already_recorded', 'sent']);
    expect(replies.every((reply) => reply.body.recorded === true)).toBe(true);
    expect(confirmationFetch).toHaveBeenCalledTimes(1);
    expect(String(confirmationFetch.mock.calls[0][0])).toContain('/5511999998888%40s.whatsapp.net/send');
    expect(JSON.parse(confirmationFetch.mock.calls[0][1]!.body as string)).toMatchObject({ message: { text: expect.stringContaining('📩 *Sua resposta foi registrada:* Confirmar') } });
    const changedChoice = { ...event, data: { ...event.data, content: `axm:${token}:1` } };
    expect((await request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(changedChoice)).send(changedChoice).expect(200)).body.recorded).toBe(false);
    expect(confirmationFetch).toHaveBeenCalledTimes(1);
    confirmationFetch.mockRestore();
    const history = await request(app.getHttpServer()).get('/api/v1/service-orders/customer-messages').query({ serviceOrderId: orderId }).set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(history.body.messages.find((message: { delivery_mode: string }) => message.delivery_mode === 'WA_AKG')).toMatchObject({ selected_option: 0, sent_at: expect.any(String), answered_at: expect.any(String) });
    const notifications = await request(app.getHttpServer()).get('/api/v1/customer-reply-notifications').set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(notifications.body.items.filter((item: { selected_option: string; read_at?: string }) => item.selected_option === 'Confirmar' && !item.read_at)).toHaveLength(1);
    expect(notifications.body.unread_count).toBe(1);
    // Restore manual sharing for the original link-expiry scenario below.
    await prisma.unscoped.tenant.update({ where: { id: owner.tenantId }, data: { waAkgEnabled: false } });
  });

  it('includes email replies and paginates history without losing unread counts', async () => {
    const email = await request(app.getHttpServer()).post('/api/v1/service-orders/customer-messages').set('Authorization', `Bearer ${owner.token}`).send({ ...payload(), channel: 'EMAIL' }).expect(201);
    const token = new URL(email.body.response_url).pathname.split('/').pop()!;
    await request(app.getHttpServer()).post('/api/v1/public/customer-message/answer').send({ token, selected_option: 1 }).expect(200);
    const feed = await request(app.getHttpServer()).get('/api/v1/customer-reply-notifications').set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(feed.body.items[0]).toMatchObject({ channel: 'EMAIL', selected_option: 'Outro horário' });
    const original = await prisma.unscoped.customerMessage.findFirstOrThrow({ where: { id: messageId } });
    const ids: string[] = [];
    try {
      for (let index = 0; index < 22; index++) {
        const record = await prisma.unscoped.customerMessage.create({ data: { ...original, quoteSnapshot: original.quoteSnapshot ?? undefined, id: undefined, tokenHash: `notification-${owner.tenantId}-${index}` } });
        ids.push(record.id);
      }
      const first = await request(app.getHttpServer()).get('/api/v1/customer-reply-notifications').set('Authorization', `Bearer ${owner.token}`).expect(200);
      expect(first.body.items).toHaveLength(20);
      expect(first.body.unread_count).toBe(24);
      const second = await request(app.getHttpServer()).get('/api/v1/customer-reply-notifications').query({ cursor: first.body.next_cursor }).set('Authorization', `Bearer ${owner.token}`).expect(200);
      expect(second.body.unread_count).toBe(24);
      expect(second.body).not.toHaveProperty('next_cursor');
      const all = [...first.body.items, ...second.body.items];
      expect(new Set(all.map((item: { id: string }) => item.id)).size).toBe(25);
    } finally { await prisma.unscoped.customerMessage.deleteMany({ where: { id: { in: ids }, tenantId: owner.tenantId } }); }
  });

  it('blocks expired and cancelled-order links', async () => {
    await prisma.unscoped.customerMessage.update({ where: { id: messageId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app.getHttpServer()).get('/api/v1/public/customer-message').query({ token: publicToken }).expect(410);
    await request(app.getHttpServer()).post('/api/v1/public/customer-message/answer').send({ token: publicToken, selected_option: winningOption }).expect(410);
    const result = await request(app.getHttpServer()).post('/api/v1/service-orders/customer-messages').set('Authorization', `Bearer ${owner.token}`).send(payload()).expect(201);
    const freshToken = new URL(result.body.response_url).pathname.split('/').pop()!;
    await prisma.unscoped.serviceOrder.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    await request(app.getHttpServer()).get('/api/v1/public/customer-message').query({ token: freshToken }).expect(404);
    const history = await request(app.getHttpServer()).get('/api/v1/customer-reply-notifications').set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(history.body.items.some((item: { id: string }) => item.id === messageId)).toBe(true);
    await prisma.unscoped.serviceOrder.update({ where: { id: orderId }, data: { deletedAt: new Date() } });
    expect((await request(app.getHttpServer()).get('/api/v1/customer-reply-notifications').set('Authorization', `Bearer ${owner.token}`).expect(200)).body).toMatchObject({ items: [], unread_count: 0 });
  });
});
