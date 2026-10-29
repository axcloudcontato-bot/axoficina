import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import * as request from 'supertest';
import { DEFAULT_CARE_SETTINGS, LEGAL_VERSION, keysToSnake, type CareSettings, type CareServiceKey } from '@oficina/contracts';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { AuditLogService } from '../src/shared/audit-log/audit-log.service';
import { WaAkgService } from '../src/modules/settings/services/wa-akg.service';
import { TenantMailerService } from '../src/modules/settings/services/tenant-mailer.service';
import { CustomerCareAutomationService } from '../src/modules/customer-care/customer-care-automation.service';
import { CustomerCarePlansService } from '../src/modules/customer-care/customer-care-plans.service';
import { addMonthsClamped, DAY_MS, localClock } from '../src/modules/customer-care/care-policy';
import { generateValidCpf } from './utils/generate-cpf';
import { uniquePlate } from './utils/unique-plate';

describe('Customer care automation (HTTP + PostgreSQL)', () => {
  let app: INestApplication; let prisma: PrismaService; let automation: CustomerCareAutomationService;
  let tenantId: string; let adminToken: string; let customerId: string; let vehicleId: string;
  const tenants: string[] = []; const now = new Date(`${localClock(new Date(), 'America/Sao_Paulo').date}T13:00:00Z`);
  const birthday = `1990-${localClock(now, 'America/Sao_Paulo').date.slice(5)}`;
  const whatsapp = { getConnection: jest.fn().mockResolvedValue({ sessionId: 'test' }), sendNotice: jest.fn().mockResolvedValue(undefined) };
  const mailer = { send: jest.fn().mockResolvedValue({ accepted: ['customer@example.invalid'] }) };
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(WaAkgService).useValue(whatsapp).overrideProvider(TenantMailerService).useValue(mailer).overrideProvider(AuditLogService).useValue({ record: jest.fn().mockResolvedValue(undefined) }).compile();
    app = fixture.createNestApplication({ bodyParser: false }); configureApp(app); await app.init();
    prisma = app.get(PrismaService); automation = app.get(CustomerCareAutomationService);
  });
  beforeEach(async () => {
    await prisma.unscoped.customerCareDelivery.updateMany({ where: { tenantId: { in: tenants }, status: { in: ['PENDING', 'SENDING'] } }, data: { status: 'SKIPPED', reason: 'Fixture encerrada pelo teste anterior.' } });
    jest.clearAllMocks(); whatsapp.getConnection.mockResolvedValue({ sessionId: 'test' }); whatsapp.sendNotice.mockResolvedValue(undefined); mailer.send.mockResolvedValue({ accepted: ['customer@example.invalid'] });
    (app.get(ThrottlerStorage) as ThrottlerStorageService).storage.clear();
    const signup = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({ accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: 'Oficina do Cuidado', tenant_document: generateValidCpf(), admin_name: 'Equipe', admin_email: `care-${randomUUID()}@example.invalid`, password: 'supersecret1' }).expect(201);
    tenantId = signup.body.tenant.id; adminToken = signup.body.access_token; tenants.push(tenantId);
    await prisma.unscoped.tenant.updateMany({ where: { id: tenantId }, data: { waAkgEnabled: true, smtpEnabled: true, smtpHost: 'smtp.example.invalid', smtpFromEmail: 'workshop@example.invalid' } });
    const customer = await post('customers', { type: 'PF', name: 'Mariana Teste', phone: '11999998888', email: 'customer@example.invalid', birthDate: birthday, careMessagesEnabled: true }).expect(201);
    customerId = customer.body.customer.id;
    const vehicle = await post('vehicles', { customerId, brand: 'Honda', model: 'Fit', plate: uniquePlate() }).expect(201);
    vehicleId = vehicle.body.vehicle.id;
  });
  afterAll(async () => {
    if (prisma) {
      const where = { tenantId: { in: tenants } };
      const orders = await prisma.unscoped.serviceOrder.findMany({ where, select: { id: true } });
      await prisma.unscoped.serviceOrderItem.deleteMany({ where: { serviceOrderId: { in: orders.map(item => item.id) } } });
      await prisma.unscoped.customerCareDelivery.deleteMany({ where }); await prisma.unscoped.customerCarePlan.deleteMany({ where }); await prisma.unscoped.customerCareSettings.deleteMany({ where });
      await prisma.unscoped.serviceOrder.deleteMany({ where }); await prisma.unscoped.vehicle.deleteMany({ where }); await prisma.unscoped.customer.deleteMany({ where }); await prisma.unscoped.user.deleteMany({ where }); await prisma.unscoped.tenant.deleteMany({ where: { id: { in: tenants } } });
    }
    await app?.close();
  });
  function post(path: string, body: object, token = adminToken) { return request(app.getHttpServer()).post(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`).send(keysToSnake(body)); }
  async function enable(patch: Partial<CareSettings> = {}) { const settings = { ...structuredClone(DEFAULT_CARE_SETTINGS), enabled: true, weekdaysOnly: false, ...patch }; await post('customer-care/settings', settings).expect(200); return settings; }
  async function plan(key: CareServiceKey = 'OIL_CHANGE') {
    return post('customer-care/services', { vehicleId, serviceKey: key, completedAt: addMonthsClamped(now, -6).toISOString().slice(0, 10), mileage: 10000 }).expect(200);
  }
  async function delivery() { return (await prisma.unscoped.customerCareDelivery.findFirst({ where: { tenantId, customerId } }))!; }

  it('starts paused, records consent, validates birth dates and never sends without opt-in', async () => {
    const initial = await request(app.getHttpServer()).get('/api/v1/customer-care').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(initial.body.settings.enabled).toBe(false);
    expect(initial.body.stats.opted_in).toBe(1);
    expect((await prisma.unscoped.customer.findFirst({ where: { id: customerId, tenantId } }))?.careConsentAt).not.toBeNull();
    await post('customers/update', { id: customerId, birthDate: '2026-02-30' }).expect(400);
    await post('customers/update', { id: customerId, careMessagesEnabled: null }).expect(400);
    await automation.scan(now, tenantId); expect(await delivery()).toBeNull();
    await enable(); await post('customers/update', { id: customerId, careMessagesEnabled: false }).expect(200);
    await automation.scan(now, tenantId); await automation.dispatch(now); expect(whatsapp.sendNotice).not.toHaveBeenCalled();
  });
  it('claims a birthday once across concurrent scans and workers, using the real provider adapter', async () => {
    await enable(); await Promise.all([automation.scan(now, tenantId), automation.scan(now, tenantId)]);
    expect(await prisma.unscoped.customerCareDelivery.count({ where: { tenantId } })).toBe(1);
    await Promise.all([automation.dispatch(now), automation.dispatch(now)]);
    expect(whatsapp.sendNotice).toHaveBeenCalledTimes(1); expect((await delivery()).status).toBe('SENT');
    expect(whatsapp.sendNotice.mock.calls[0][2]).toContain('🎂 Feliz aniversário, Mariana!');
    await automation.scan(now, tenantId); await automation.dispatch(now); expect(whatsapp.sendNotice).toHaveBeenCalledTimes(1);
  });
  it('combines oil and brakes into one digest and observes the contact gap', async () => {
    await enable({ campaigns: DEFAULT_CARE_SETTINGS.campaigns.map(item => item.key === 'BIRTHDAY' ? { ...item, enabled: false } : { ...item }) });
    await plan('OIL_CHANGE'); await plan('BRAKES'); await automation.scan(now, tenantId);
    expect((await delivery()).campaignKeys.sort()).toEqual(['BRAKES', 'OIL_CHANGE']);
    await automation.dispatch(now); expect(whatsapp.sendNotice).toHaveBeenCalledTimes(1);
    await automation.scan(new Date(now.getTime() + DAY_MS), tenantId); expect(await prisma.unscoped.customerCareDelivery.count({ where: { tenantId } })).toBe(1);
  });
  it('pauses through an opaque public link, and cancels a queued message before delivery', async () => {
    await enable(); await automation.scan(now, tenantId);
    const record = await delivery(); const token = record.message.match(/preferencias-de-contato\/([a-f0-9]{64})/)![1];
    expect(record.unsubscribeToken).not.toBe(token); expect(record.unsubscribeHash).not.toBe(token);
    const info = await request(app.getHttpServer()).post('/api/v1/customer-care/preferences/lookup').send({ token }).expect(200);
    expect(info.body.workshop_name).toBe('Oficina do Cuidado'); expect(info.body.customer_name).toBeUndefined();
    await request(app.getHttpServer()).post('/api/v1/customer-care/preferences/pause').send({ token }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/customer-care/preferences/pause').send({ token }).expect(200);
    await automation.dispatch(now); expect(whatsapp.sendNotice).not.toHaveBeenCalled(); expect((await delivery()).status).toBe('SKIPPED');
    expect((await prisma.unscoped.customer.findFirst({ where: { id: customerId, tenantId } }))?.careMessagesEnabled).toBe(false);
  });
  it('rechecks live consent and suppresses a service completed after queueing', async () => {
    await enable({ campaigns: DEFAULT_CARE_SETTINGS.campaigns.map(item => item.key === 'BIRTHDAY' ? { ...item, enabled: false } : { ...item }) });
    await plan(); await automation.scan(now, tenantId);
    await post('customer-care/services', { vehicleId, serviceKey: 'OIL_CHANGE', completedAt: localClock(new Date(), 'America/Sao_Paulo').date, mileage: 20000 }).expect(200);
    await automation.dispatch(now); expect((await delivery()).status).toBe('SKIPPED'); expect(whatsapp.sendNotice).not.toHaveBeenCalled();
  });
  it('quarantines an ambiguous send result and never automatically retries it', async () => {
    await enable(); await automation.scan(now, tenantId); whatsapp.sendNotice.mockRejectedValueOnce(new Error('provider timeout'));
    await automation.dispatch(now); expect((await delivery()).status).toBe('UNKNOWN');
    await automation.scan(now, tenantId); await automation.dispatch(now); expect(whatsapp.sendNotice).toHaveBeenCalledTimes(1);
    await post('customer-care/retry', { id: (await delivery()).id }).expect(409);
  });
  it('honors channel and time preferences instead of silently sending through another channel', async () => {
    await enable(); await post('customers/update', { id: customerId, preferredContactChannel: 'EMAIL', preferredContactTime: 'AFTERNOON' }).expect(200);
    await automation.scan(now, tenantId); expect(await delivery()).toBeNull();
    const afternoon = new Date(now.getTime() + 3 * 60 * 60_000);
    await automation.scan(afternoon, tenantId); await automation.dispatch(afternoon);
    expect(mailer.send).toHaveBeenCalledTimes(1); expect(whatsapp.sendNotice).not.toHaveBeenCalled(); expect((await delivery()).channel).toBe('EMAIL');
    await post('customers/update', { id: customerId, preferredContactChannel: 'SMS' }).expect(200);
    await automation.scan(afternoon, tenantId); expect(await prisma.unscoped.customerCareDelivery.count({ where: { tenantId } })).toBe(1);
  });
  it('applies the tenant daily limit atomically', async () => {
    await enable({ dailyLimit: 1 });
    await post('customers', { type: 'PF', name: 'Segundo Cliente', phone: '11999997777', birthDate: birthday, careMessagesEnabled: true }).expect(201);
    await Promise.all([automation.scan(now, tenantId), automation.scan(now, tenantId)]);
    expect(await prisma.unscoped.customerCareDelivery.count({ where: { tenantId } })).toBe(1);
    await post('customer-care/services', { vehicleId: randomUUID(), serviceKey: 'OIL_CHANGE', completedAt: '2026-01-01' }).expect(404);
    await post('customer-care/preview', { campaignKey: 'OIL_CHANGE', customerId: randomUUID() }).expect(404);
  });
  it('resets only explicitly tagged services in the same delivered-order transaction', async () => {
    const order = await prisma.unscoped.serviceOrder.create({ data: { tenantId, orderNumber: 1, customerId, vehicleId, status: 'DELIVERED', openedAt: now, closedAt: now, entryMileage: 25000 } });
    await prisma.unscoped.serviceOrderItem.createMany({ data: [{ serviceOrderId: order.id, type: 'LABOR', description: 'Troca de óleo', careServiceKey: 'OIL_CHANGE', quantity: 1, unitPriceCents: 100 }, { serviceOrderId: order.id, type: 'PART', description: 'Pastilhas citadas em orçamento, sem vínculo confirmado', quantity: 1, unitPriceCents: 100 }] });
    await prisma.unscoped.$transaction(tx => app.get(CustomerCarePlansService).recordDelivered(tx, order, now));
    const plans = await prisma.unscoped.customerCarePlan.findMany({ where: { tenantId, vehicleId } });
    expect(plans.map(item => item.serviceKey).sort()).toEqual(['OIL_CHANGE', 'PERIODIC_REVIEW']);
    expect(plans.every(item => item.mileage === 25000 && item.sourceOrderId === order.id)).toBe(true);
    const body = await request(app.getHttpServer()).get('/api/v1/customer-care').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(body.body.plans).toHaveLength(2);
    expect(body.body.plans.find((item: { service_key: string }) => item.service_key === 'OIL_CHANGE').due_mileage).toBe(35000);
  });

  it('suppresses reminders during an active order and after vehicle ownership changes', async () => {
    await enable({ campaigns: DEFAULT_CARE_SETTINGS.campaigns.map(item => item.key === 'BIRTHDAY' ? { ...item, enabled: false } : { ...item }) });
    await plan();
    const order = await prisma.unscoped.serviceOrder.create({ data: { tenantId, orderNumber: 1, customerId, vehicleId, status: 'OPEN', openedAt: now } });
    await automation.scan(now, tenantId); expect(await delivery()).toBeNull();
    await prisma.unscoped.serviceOrder.updateMany({ where: { id: order.id, tenantId }, data: { status: 'CANCELLED' } });
    const second = await post('customers', { type: 'PF', name: 'Novo proprietário', phone: '11999997777', careMessagesEnabled: true }).expect(201);
    await prisma.unscoped.vehicle.updateMany({ where: { id: vehicleId, tenantId }, data: { customerId: second.body.customer.id } });
    await automation.scan(now, tenantId); expect(await delivery()).toBeNull(); expect(whatsapp.sendNotice).not.toHaveBeenCalled();
  });

  it('recovers abandoned claims conservatively, without a second external call', async () => {
    await enable(); await automation.scan(now, tenantId);
    const record = await delivery();
    await prisma.unscoped.customerCareDelivery.updateMany({ where: { id: record.id, tenantId }, data: { status: 'SENDING', attemptedAt: new Date(now.getTime() - 6 * 60_000) } });
    await automation.dispatch(now);
    expect((await delivery()).status).toBe('UNKNOWN'); expect(whatsapp.sendNotice).not.toHaveBeenCalled();
  });

  it('retries a pre-send configuration failure after repair, with fresh validation', async () => {
    await enable(); await automation.scan(now, tenantId);
    whatsapp.getConnection.mockRejectedValueOnce(new Error('configuration unavailable'));
    await automation.dispatch(now); const failed = await delivery(); expect(failed.status).toBe('FAILED'); expect(whatsapp.sendNotice).not.toHaveBeenCalled();
    await post('customer-care/retry', { id: failed.id }).expect(200);
    // Align the HTTP retry's wall-clock timestamp with this test's virtual
    // daytime window; no provider is contacted while a test is outside it.
    await prisma.unscoped.customerCareDelivery.updateMany({ where: { id: failed.id, tenantId }, data: { scheduledAt: now } });
    await automation.dispatch(now); expect((await delivery()).status).toBe('SENT'); expect(whatsapp.sendNotice).toHaveBeenCalledTimes(1);
  });

  it('rejects real customer, vehicle and delivery identifiers owned by another workshop', async () => {
    await enable(); await automation.scan(now, tenantId); const record = await delivery();
    const other = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({ accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: 'Outra oficina', tenant_document: generateValidCpf(), admin_name: 'Outra equipe', admin_email: `care-other-${randomUUID()}@example.invalid`, password: 'supersecret1' }).expect(201);
    tenants.push(other.body.tenant.id); const token = other.body.access_token;
    await post('customer-care/services', { vehicleId, serviceKey: 'OIL_CHANGE', completedAt: '2026-01-01' }, token).expect(404);
    await post('customer-care/preview', { campaignKey: 'OIL_CHANGE', customerId }, token).expect(404);
    await post('customer-care/retry', { id: record.id }, token).expect(409);
    const isolated = await request(app.getHttpServer()).get('/api/v1/customer-care').set('Authorization', `Bearer ${token}`).expect(200);
    expect(isolated.body.plans).toEqual([]); expect(isolated.body.deliveries).toEqual([]); expect(isolated.body.stats.opted_in).toBe(0);
  });

  it('uses the real last delivered visit for legacy customers without guessing specific services', async () => {
    await enable({ campaigns: DEFAULT_CARE_SETTINGS.campaigns.map(item => item.key === 'BIRTHDAY' ? { ...item, enabled: false } : { ...item }) });
    const closedAt = addMonthsClamped(now, -6);
    const order = await prisma.unscoped.serviceOrder.create({ data: { tenantId, orderNumber: 1, customerId, vehicleId, status: 'DELIVERED', openedAt: closedAt, closedAt, entryMileage: 20000 } });
    await prisma.unscoped.serviceOrderItem.create({ data: { serviceOrderId: order.id, type: 'LABOR', description: 'Óleo mencionado em item antigo sem identificação de cuidado', quantity: 1, unitPriceCents: 100 } });
    await automation.scan(now, tenantId);
    const plans = await prisma.unscoped.customerCarePlan.findMany({ where: { tenantId, vehicleId } });
    expect(plans.map(item => item.serviceKey)).toEqual(['PERIODIC_REVIEW']);
    expect(plans[0].completedAt).toEqual(closedAt); expect((await delivery()).campaignKeys).toEqual(['PERIODIC_REVIEW']);
  });
});
