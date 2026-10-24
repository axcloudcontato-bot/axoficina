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
    await request(app.getHttpServer()).post(webhookPath).send(event).expect(401);
    const wrongSender = { ...event, data: { ...event.data, from: '5511888887777@s.whatsapp.net' } };
    const wrongResult = await request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(wrongSender)).send(wrongSender).expect(200);
    expect(wrongResult.body.recorded).toBe(false);
    const freeText = { ...event, data: { ...event.data, type: 'TEXT' } };
    expect((await request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(freeText)).send(freeText).expect(200)).body.recorded).toBe(false);
    await request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(event)).send(wrongSender).expect(401);
    expect((await request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(event)).send(event).expect(200)).body.recorded).toBe(true);
    expect((await request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(event)).send(event).expect(200)).body.recorded).toBe(true);
    const changedChoice = { ...event, data: { ...event.data, content: `axm:${token}:1` } };
    expect((await request(app.getHttpServer()).post(webhookPath).set('X-Webhook-Signature', sign(changedChoice)).send(changedChoice).expect(200)).body.recorded).toBe(false);
    const history = await request(app.getHttpServer()).get('/api/v1/service-orders/customer-messages').query({ serviceOrderId: orderId }).set('Authorization', `Bearer ${owner.token}`).expect(200);
    expect(history.body.messages.find((message: { delivery_mode: string }) => message.delivery_mode === 'WA_AKG')).toMatchObject({ selected_option: 0, sent_at: expect.any(String), answered_at: expect.any(String) });
    // Restore manual sharing for the original link-expiry scenario below.
    await prisma.unscoped.tenant.update({ where: { id: owner.tenantId }, data: { waAkgEnabled: false } });
  });

  it('blocks expired and cancelled-order links', async () => {
    await prisma.unscoped.customerMessage.update({ where: { id: messageId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app.getHttpServer()).get('/api/v1/public/customer-message').query({ token: publicToken }).expect(410);
    await request(app.getHttpServer()).post('/api/v1/public/customer-message/answer').send({ token: publicToken, selected_option: winningOption }).expect(410);
    const result = await request(app.getHttpServer()).post('/api/v1/service-orders/customer-messages').set('Authorization', `Bearer ${owner.token}`).send(payload()).expect(201);
    const freshToken = new URL(result.body.response_url).pathname.split('/').pop()!;
    await prisma.unscoped.serviceOrder.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    await request(app.getHttpServer()).get('/api/v1/public/customer-message').query({ token: freshToken }).expect(404);
  });
});
