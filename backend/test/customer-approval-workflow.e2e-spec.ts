import { randomUUID } from 'node:crypto';
import { BadGatewayException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { LEGAL_VERSION, SERVICE_ORDER_PHOTO_ANGLES } from '@oficina/contracts';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { AuditLogService } from '../src/shared/audit-log/audit-log.service';
import { TenantMailerService } from '../src/modules/settings/services/tenant-mailer.service';
import { WaAkgService } from '../src/modules/settings/services/wa-akg.service';
import { CustomerMessageManager } from '../src/modules/service-orders/managers/customer-message.manager';
import { generateValidCpf } from './utils/generate-cpf';

describe('Customer approval workflow (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenants: string[] = [];
  const mailer = { send: jest.fn().mockResolvedValue({}) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const whatsapp = { getConnection: jest.fn().mockResolvedValue(null), sendButtons: jest.fn().mockResolvedValue({ providerMessageId: 'provider-1' }), sendNotice: jest.fn().mockResolvedValue(undefined), sendConfirmation: jest.fn().mockResolvedValue(undefined) };
  let token: string; let outsider: string; let customerId: string; let vehicleId: string;
  let orderId: string; let itemId: string; let number = 0;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TenantMailerService).useValue(mailer)
      .overrideProvider(WaAkgService).useValue(whatsapp)
      .overrideProvider(AuditLogService).useValue(audit).compile();
    app = fixture.createNestApplication({ bodyParser: false }); configureApp(app);
    await app.listen(0, '127.0.0.1'); prisma = app.get(PrismaService);
    async function signup() {
      const response = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
        accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: 'Approval workflow', tenant_document: generateValidCpf(),
        admin_name: 'Approval admin', admin_email: `approval-${randomUUID()}@example.invalid`, password: 'supersecret1',
      }).expect(201);
      tenants.push(response.body.tenant.id); return response.body.access_token as string;
    }
    token = await signup(); outsider = await signup();
    const customer = await prisma.unscoped.customer.create({ data: { tenantId: tenants[0], type: 'PF', name: 'Cliente Aprovação', document: generateValidCpf(), phone: '11999998888', email: 'approval-client@example.invalid' } }); customerId = customer.id;
    const vehicle = await prisma.unscoped.vehicle.create({ data: { tenantId: tenants[0], customerId, brand: 'Honda', model: 'Fit', plate: 'APR1A23' } }); vehicleId = vehicle.id;
  });
  beforeEach(async () => {
    jest.clearAllMocks(); whatsapp.getConnection.mockResolvedValue(null); mailer.send.mockResolvedValue({});
    const order = await prisma.unscoped.serviceOrder.create({ data: { tenantId: tenants[0], customerId, vehicleId, orderNumber: ++number, status: 'OPEN', openedAt: new Date() } }); orderId = order.id;
    const item = await prisma.unscoped.serviceOrderItem.create({ data: { serviceOrderId: orderId, type: 'LABOR', description: 'Revisão de freios', quantity: 1, unitPriceCents: 15000 } }); itemId = item.id;
  });
  afterAll(async () => {
    if (prisma && tenants.length) {
      const ids = (await prisma.unscoped.serviceOrder.findMany({ where: { tenantId: { in: tenants } }, select: { id: true } })).map(order => order.id);
      await prisma.unscoped.customerMessage.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.serviceOrderPhoto.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.serviceOrderStatusHistory.deleteMany({ where: { serviceOrderId: { in: ids } } });
      await prisma.unscoped.serviceOrderItem.deleteMany({ where: { serviceOrderId: { in: ids } } });
      await prisma.unscoped.serviceOrder.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.vehicle.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.customer.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.user.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: tenants } } });
    }
    if (app) await app.close();
  });
  function post(path: string, body: object, auth = token) { return request(app.getHttpServer()).post(`/api/v1/${path}`).set('Authorization', `Bearer ${auth}`).send(body); }
  function send(body = {}) { return post('service-orders/customer-messages', { service_order_id: orderId, purpose: 'QUOTE', channel: 'EMAIL', question: 'Custom text ignored for approvals', options: ['Other', 'Choices'], include_quote: false, ...body }); }
  const publicToken = (response: request.Response) => new URL(response.body.response_url).pathname.split('/').pop()!;
  async function photos(category: 'ENTRY' | 'EXIT') { await prisma.unscoped.serviceOrderPhoto.createMany({ data: SERVICE_ORDER_PHOTO_ANGLES.map(angle => ({ tenantId: tenants[0], serviceOrderId: orderId, category, angle, storageKey: randomUUID(), originalName: 'fixture.png', mimeType: 'image/png', sizeBytes: 1 })) }); }
  async function status() { return (await prisma.unscoped.serviceOrder.findFirstOrThrow({ where: { id: orderId } })).status; }

  it('shows entry requirements before dispatch and checks the preview revision before any send', async () => {
    await send().expect(400); expect(mailer.send).not.toHaveBeenCalled(); expect(await status()).toBe('OPEN');
    await photos('ENTRY');
    const original = await request(app.getHttpServer()).get('/api/v1/service-order').query({ id: orderId }).set('Authorization', `Bearer ${token}`).expect(200);
    await prisma.unscoped.serviceOrderItem.update({ where: { id: itemId }, data: { unitPriceCents: 18000 } });
    await send({ expected_quote_revision: original.body.service_order.quote_revision }).expect(409);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('follows send → customer approval → explicit start → completion → pickup notice → delivery', async () => {
    await photos('ENTRY');
    const sent = await send().expect(201); expect(await status()).toBe('AWAITING_APPROVAL');
    expect(sent.body.sent).toBe(true); expect(sent.body.message_id).toBeTruthy();
    const link = publicToken(sent);
    const preview = await request(app.getHttpServer()).get('/api/v1/public/customer-message').query({ token: link }).expect(200);
    expect(preview.body).toMatchObject({ purpose: 'QUOTE', can_answer: true, quote_is_current: true, options: ['Aprovar orçamento', 'Não aprovar', 'Falar com a oficina'], quote: { total_amount_cents: 15000 } });
    expect(preview.body.quote.items[0]).not.toHaveProperty('id');
    await post('public/customer-message/answer', { token: link, selected_option: 0 }).expect(200);
    expect(await status()).toBe('AWAITING_APPROVAL');
    await post('service-orders/transition', { id: orderId, to_status: 'IN_PROGRESS', authorization: 'CUSTOMER_MESSAGE' }).expect(200);
    await post('service-orders/transition', { id: orderId, to_status: 'COMPLETED' }).expect(400);
    await photos('EXIT');
    await prisma.unscoped.serviceOrderPhoto.createMany({ data: ['ISSUE', 'RESOLVED'].map(category => ({ tenantId: tenants[0], serviceOrderId: orderId, serviceOrderItemId: itemId, category, storageKey: randomUUID(), originalName: 'fixture.png', mimeType: 'image/png', sizeBytes: 1 })) });
    await post('service-orders/transition', { id: orderId, to_status: 'COMPLETED' }).expect(200);
    await send({ purpose: 'PICKUP', include_quote: false }).expect(201);
    expect(await status()).toBe('COMPLETED');
    await post('service-orders/transition', { id: orderId, to_status: 'DELIVERED' }).expect(200);
    expect(await status()).toBe('DELIVERED');
    await send().expect(400);
  });

  it('keeps the sent snapshot and refuses approval of changed or superseded quotes', async () => {
    await photos('ENTRY'); const first = await send().expect(201);
    await prisma.unscoped.serviceOrderItem.update({ where: { id: itemId }, data: { unitPriceCents: 19000 } });
    const old = await request(app.getHttpServer()).get('/api/v1/public/customer-message').query({ token: publicToken(first) }).expect(200);
    expect(old.body).toMatchObject({ can_answer: false, quote_is_current: false, quote: { total_amount_cents: 15000 } });
    await post('public/customer-message/answer', { token: publicToken(first), selected_option: 0 }).expect(409);
    await post('service-orders/transition', { id: orderId, to_status: 'IN_PROGRESS', authorization: 'CUSTOMER_MESSAGE' }).expect(400);
    const second = await send().expect(201); const third = await send().expect(201);
    const superseded = await request(app.getHttpServer()).get('/api/v1/public/customer-message').query({ token: publicToken(second) }).expect(200);
    expect(superseded.body.can_answer).toBe(false);
    await post('public/customer-message/answer', { token: publicToken(third), selected_option: 1 }).expect(200);
    const history = await request(app.getHttpServer()).get('/api/v1/service-orders/customer-messages').query({ serviceOrderId: orderId }).set('Authorization', `Bearer ${token}`).expect(200);
    expect(history.body.messages.find((message: { id: string }) => message.id === first.body.message_id).quote_is_current).toBe(false);
    expect(await status()).toBe('AWAITING_APPROVAL');
  });

  it('only marks an app handoff as sent after explicit confirmation and isolates message ids', async () => {
    await photos('ENTRY'); const prepared = await send({ channel: 'WHATSAPP' }).expect(201);
    expect(prepared.body.sent).toBe(false); expect(await status()).toBe('OPEN');
    await post('service-orders/customer-messages/confirm-dispatch', { id: prepared.body.message_id }, outsider).expect(404);
    await post('service-orders/customer-messages/confirm-dispatch', { id: prepared.body.message_id }).expect(200);
    await post('service-orders/customer-messages/confirm-dispatch', { id: prepared.body.message_id }).expect(200);
    expect(await status()).toBe('AWAITING_APPROVAL');
    expect(await prisma.unscoped.serviceOrderStatusHistory.count({ where: { serviceOrderId: orderId, toStatus: 'AWAITING_APPROVAL' } })).toBe(1);
  });

  it('does not invalidate the previous request when an email fails and blocks premature pickup notices', async () => {
    await send({ purpose: 'PICKUP' }).expect(400); await photos('ENTRY'); const sent = await send().expect(201);
    mailer.send.mockRejectedValueOnce(new BadGatewayException('SMTP unavailable'));
    await send().expect(502);
    const previous = await request(app.getHttpServer()).get('/api/v1/public/customer-message').query({ token: publicToken(sent) }).expect(200);
    expect(previous.body.can_answer).toBe(true);
  });

  it('tells a WhatsApp recipient when an old approval is unavailable without recording it', async () => {
    await photos('ENTRY'); whatsapp.getConnection.mockResolvedValue({ sessionId: 'session-one' } as never);
    const sent = await send({ channel: 'WHATSAPP' }).expect(201);
    await prisma.unscoped.serviceOrderItem.update({ where: { id: itemId }, data: { description: 'Orçamento revisado' } });
    const result = await app.get(CustomerMessageManager).answerFromWhatsApp(tenants[0], 'session-one', '5511999998888@s.whatsapp.net', `axm:${publicToken(sent)}:0`);
    expect(result.recorded).toBe(false);
    expect(whatsapp.sendNotice).toHaveBeenCalledWith(expect.anything(), '5511999998888@s.whatsapp.net', expect.stringContaining('alterado'));
    expect((await prisma.unscoped.customerMessage.findFirstOrThrow({ where: { id: sent.body.message_id } })).answeredAt).toBeNull();
  });

  it('records the team authorization source without creating a customer reply', async () => {
    await photos('ENTRY');
    await post('service-orders/transition', { id: orderId, to_status: 'IN_PROGRESS', authorization: 'MANUAL' }).expect(200);
    expect(await prisma.unscoped.customerMessage.count({ where: { serviceOrderId: orderId } })).toBe(0);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'service_order.transitioned', metadata: expect.objectContaining({ authorization: 'MANUAL', quoteRevision: expect.stringMatching(/^[a-f0-9]{64}$/) }) }));
  });

  it('does not confirm an app handoff that another request replaced or whose quote changed', async () => {
    await photos('ENTRY');
    const first = await send({ channel: 'WHATSAPP' }).expect(201);
    const second = await send({ channel: 'WHATSAPP' }).expect(201);
    await post('service-orders/customer-messages/confirm-dispatch', { id: first.body.message_id }).expect(409);
    expect(await status()).toBe('OPEN');
    await prisma.unscoped.serviceOrderItem.update({ where: { id: itemId }, data: { unitPriceCents: 18000 } });
    await post('service-orders/customer-messages/confirm-dispatch', { id: second.body.message_id }).expect(409);
    expect(await status()).toBe('OPEN');
  });
});
