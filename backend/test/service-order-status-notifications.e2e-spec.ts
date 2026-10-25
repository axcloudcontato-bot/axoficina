import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { LEGAL_VERSION, SERVICE_ORDER_PHOTO_ANGLES } from '@oficina/contracts';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { AuditLogService } from '../src/shared/audit-log/audit-log.service';
import { WaAkgService } from '../src/modules/settings/services/wa-akg.service';
import { ServiceOrderStatusNotificationService } from '../src/modules/service-orders/services/service-order-status-notification.service';
import { ServiceOrderStatusNotificationRepository } from '../src/modules/service-orders/repositories/service-order-status-notification.repository';
import { generateValidCpf } from './utils/generate-cpf';

describe('Automatic WhatsApp status notices (HTTP + PostgreSQL)', () => {
  let app: INestApplication; let prisma: PrismaService; let dispatcher: ServiceOrderStatusNotificationService;
  const tenants: string[] = []; const tokens: string[] = []; const currentOrders: string[] = [];
  let customerId: string; let vehicleId: string; let sequence = 0;
  const whatsapp = { getConnection: jest.fn().mockImplementation(async (tenantId: string) => ({ sessionId: tenantId })), sendNotice: jest.fn().mockResolvedValue(undefined) };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(WaAkgService).useValue(whatsapp).overrideProvider(AuditLogService).useValue({ record: async () => undefined }).compile();
    app = fixture.createNestApplication({ bodyParser: false }); configureApp(app); await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService); dispatcher = app.get(ServiceOrderStatusNotificationService);
    for (let index = 0; index < 2; index++) {
      const response = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({ accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: 'Movement notices', tenant_document: generateValidCpf(), admin_name: 'Status admin', admin_email: `movement-${randomUUID()}@example.invalid`, password: 'supersecret1' }).expect(201);
      tenants.push(response.body.tenant.id); tokens.push(response.body.access_token);
    }
  });
  beforeEach(async () => {
    jest.clearAllMocks(); whatsapp.getConnection.mockImplementation(async (tenantId: string) => ({ sessionId: tenantId })); whatsapp.sendNotice.mockResolvedValue(undefined);
    currentOrders.length = 0;
    const customer = await post('customers', { type: 'PF', name: 'Cliente Avisos', phone: '11999998888', preferred_contact_channel: 'WHATSAPP' }).expect(201); customerId = customer.body.customer.id;
    const vehicle = await prisma.unscoped.vehicle.create({ data: { tenantId: tenants[0], customerId, brand: 'Honda', model: 'Fit', plate: `NTF${String(++sequence).padStart(4, '0')}` } }); vehicleId = vehicle.id;
  });
  afterEach(async () => { await prisma.unscoped.serviceOrderStatusNotification.deleteMany({ where: { serviceOrderId: { in: currentOrders }, tenantId: { in: tenants } } }); });
  afterAll(async () => {
    if (prisma && tenants.length) {
      const ids = (await prisma.unscoped.serviceOrder.findMany({ where: { tenantId: { in: tenants } }, select: { id: true } })).map(order => order.id);
      await prisma.unscoped.serviceOrderStatusNotification.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.serviceOrderPhoto.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.serviceOrderStatusHistory.deleteMany({ where: { serviceOrderId: { in: ids } } });
      await prisma.unscoped.serviceOrder.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.vehicle.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.customer.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.user.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: tenants } } });
    }
    if (app) await app.close();
  });
  function post(path: string, body: object, token = tokens[0]) { return request(app.getHttpServer()).post(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`).send(body); }
  async function opt(enabled: boolean) { return post('customers/update', { id: customerId, notify_service_order_updates: enabled }).expect(200); }
  async function open() { const response = await post('service-orders', { vehicle_id: vehicleId, customer_complaint: 'Revisão dos freios' }).expect(201); currentOrders.push(response.body.service_order.id); return response.body.service_order.id as string; }
  async function photos(orderId: string, category: 'ENTRY' | 'EXIT') { await prisma.unscoped.serviceOrderPhoto.createMany({ data: SERVICE_ORDER_PHOTO_ANGLES.map(angle => ({ tenantId: tenants[0], serviceOrderId: orderId, category, angle, storageKey: randomUUID(), originalName: 'fixture.png', mimeType: 'image/png', sizeBytes: 1 })) }); }
  function list(orderId: string, token = tokens[0]) { return post('service-orders/status-notifications/list', { service_order_id: orderId, offset: 0, limit: 100 }, token); }
  async function drain() { for (let index = 0; index < 5; index++) await dispatcher.dispatchPending(); }

  it('defaults off, saves true/false, validates the phone and never confuses the preferred channel with opt-in', async () => {
    const id = await open(); await drain(); expect(whatsapp.sendNotice).not.toHaveBeenCalled(); expect((await list(id)).body.total).toBe(0);
    const enabled = await opt(true); expect(enabled.body.customer.notify_service_order_updates).toBe(true);
    await post('customers/update', { id: customerId, phone: '123' }).expect(400);
    await post('customers/update', { id: customerId, notify_service_order_updates: 'true' }).expect(400);
    await post('customers/update', { id: customerId, notify_service_order_updates: null }).expect(400);
    const disabled = await opt(false); expect(disabled.body.customer.notify_service_order_updates).toBe(false);
    await post('service-orders/transition', { id, to_status: 'CANCELLED' }).expect(200); await drain();
    expect(whatsapp.sendNotice).not.toHaveBeenCalled(); expect((await list(id)).body.total).toBe(0);
  });

  it('notifies opening and every actual status change in order, including approval, parts, resume and delivery', async () => {
    await opt(true); const id = await open(); await photos(id, 'ENTRY'); await photos(id, 'EXIT');
    for (const status of ['AWAITING_APPROVAL', 'IN_PROGRESS', 'WAITING_PARTS', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED']) await post('service-orders/transition', { id, to_status: status }).expect(200);
    await drain();
    const expected = ['ORDEM DE SERVIÇO ABERTA', 'ORÇAMENTO EM APROVAÇÃO', 'SERVIÇO INICIADO', 'AGUARDANDO PEÇAS', 'SERVIÇO RETOMADO', 'VEÍCULO PRONTO PARA RETIRADA', 'VEÍCULO ENTREGUE'];
    expect(whatsapp.sendNotice).toHaveBeenCalledTimes(7);
    expected.forEach((title, index) => expect(whatsapp.sendNotice.mock.calls[index][2]).toContain(`*${title}*`));
    expect(whatsapp.sendNotice.mock.calls[0]).toEqual([expect.objectContaining({ sessionId: tenants[0] }), '5511999998888@s.whatsapp.net', expect.stringContaining('*Solicitação:* Revisão dos freios')]);
    await drain(); expect(whatsapp.sendNotice).toHaveBeenCalledTimes(7);
    const history = await list(id).expect(200); expect(history.body.total).toBe(7); expect(history.body.items.every((record: { status: string }) => record.status === 'SENT')).toBe(true);
    await post('service-orders/transition', { id, to_status: 'IN_PROGRESS' }).expect(400); expect((await list(id)).body.total).toBe(7);
  });

  it('only notifies the winning transition and only once across concurrent dispatchers', async () => {
    await opt(true); const id = await open();
    const changes = await Promise.all([post('service-orders/transition', { id, to_status: 'CANCELLED' }), post('service-orders/transition', { id, to_status: 'CANCELLED' })]);
    expect(changes.filter(result => result.status === 200)).toHaveLength(1);
    await Promise.all([dispatcher.dispatchPending(), dispatcher.dispatchPending(), dispatcher.dispatchPending()]); await drain();
    expect(whatsapp.sendNotice).toHaveBeenCalledTimes(2); expect(whatsapp.sendNotice.mock.calls[0][2]).toContain('*ORDEM DE SERVIÇO ABERTA*'); expect(whatsapp.sendNotice.mock.calls[1][2]).toContain('*ORDEM DE SERVIÇO CANCELADA*');
  });

  it('leaves the OS successful on provider failures, persists an uncertain result and only retries explicitly', async () => {
    await opt(true); whatsapp.sendNotice.mockRejectedValueOnce(new Error('timeout api-key-must-not-leak'));
    const id = await open(); await drain();
    const failed = await list(id).expect(200); const noticeId = failed.body.items[0].id;
    expect(failed.body.items[0]).toMatchObject({ status: 'FAILED', attempts: 1 }); expect(JSON.stringify(failed.body)).not.toContain('api-key-must-not-leak');
    expect((await prisma.unscoped.serviceOrder.findFirstOrThrow({ where: { id } })).status).toBe('OPEN');
    await drain(); expect(whatsapp.sendNotice).toHaveBeenCalledTimes(1);
    await post('service-orders/status-notifications/retry', { id: noticeId }).expect(400);
    await post('service-orders/status-notifications/retry', { id: noticeId, confirm_resend: true }, tokens[1]).expect(404);
    await post('service-orders/status-notifications/retry', { id: noticeId, confirm_resend: true }).expect(200);
    await drain(); const sent = (await list(id)).body.items[0]; expect(sent).toMatchObject({ id: noticeId, status: 'SENT', attempts: 2 });
    await post('service-orders/status-notifications/retry', { id: noticeId, confirm_resend: true }).expect(409);
  });

  it('rechecks revocation and changed phones before sending queued notices', async () => {
    await opt(true); const id = await open(); await opt(false); await drain();
    expect((await list(id)).body.items[0].status).toBe('SKIPPED'); expect(whatsapp.sendNotice).not.toHaveBeenCalled();
    await opt(true); await post('service-orders/transition', { id, to_status: 'CANCELLED' }).expect(200);
    await post('customers/update', { id: customerId, phone: '21988887777' }).expect(200); await drain();
    expect(whatsapp.sendNotice).not.toHaveBeenCalled();
    const history = await list(id); expect(history.body.items.every((record: { status: string }) => record.status === 'SKIPPED')).toBe(true);
    expect(history.body.items[0].failure_reason).toContain('telefone');
  });

  it('starts with future movements only, isolates history and records disabled integration failures', async () => {
    const id = await open(); await opt(true); whatsapp.getConnection.mockResolvedValueOnce(null as never);
    await post('service-orders/transition', { id, to_status: 'CANCELLED' }).expect(200); await drain();
    const history = await list(id).expect(200); expect(history.body.total).toBe(1); expect(history.body.items[0].failure_reason).toContain('desativada');
    await list(id, tokens[1]).expect(404);
    await request(app.getHttpServer()).post('/api/v1/service-orders/status-notifications/list').send({ service_order_id: id }).expect(401);
  });

  it('retains uncertainty after a process interruption instead of automatically duplicating a message', async () => {
    await opt(true); const id = await open();
    await prisma.unscoped.serviceOrderStatusNotification.updateMany({ where: { serviceOrderId: id }, data: { status: 'SENDING', attempts: 1, attemptedAt: new Date(Date.now() - 11 * 60_000) } });
    await drain(); expect(whatsapp.sendNotice).not.toHaveBeenCalled();
    expect((await list(id)).body.items[0]).toMatchObject({ status: 'FAILED', attempts: 1 });
  });

  it('rolls back the movement and its history if the durable notice cannot be recorded', async () => {
    await opt(true); const id = await open();
    const repo = app.get(ServiceOrderStatusNotificationRepository);
    const spy = jest.spyOn(repo, 'record').mockRejectedValueOnce(new Error('simulated storage failure'));
    await post('service-orders/transition', { id, to_status: 'CANCELLED' }).expect(500); spy.mockRestore();
    expect((await prisma.unscoped.serviceOrder.findFirstOrThrow({ where: { id } })).status).toBe('OPEN');
    expect(await prisma.unscoped.serviceOrderStatusHistory.count({ where: { serviceOrderId: id } })).toBe(1);
    expect((await list(id)).body.total).toBe(1); expect(whatsapp.sendNotice).not.toHaveBeenCalled();
  });
});
