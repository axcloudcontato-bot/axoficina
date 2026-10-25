import { randomUUID } from 'node:crypto';
import { LEGAL_VERSION } from '@oficina/contracts';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { AuditLogService } from '../src/shared/audit-log/audit-log.service';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { generateValidCpf } from './utils/generate-cpf';

describe('Service order history (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenants: string[] = [];
  let token: string;
  let otherToken: string;
  const customerId = randomUUID();
  const vehicleId = randomUUID();
  const firstDelivery = randomUUID();
  const lastDelivery = randomUUID();
  const opened = randomUUID();

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuditLogService).useValue({ record: async () => undefined }).compile();
    app = fixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    async function signup() {
      const response = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
        accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: 'History test',
        tenant_document: generateValidCpf(), admin_name: 'History admin',
        admin_email: `history-${randomUUID()}@example.invalid`, password: 'supersecret1',
      }).expect(201);
      tenants.push(response.body.tenant.id);
      return response.body.access_token as string;
    }
    token = await signup(); otherToken = await signup();
    await prisma.unscoped.customer.create({ data: { id: customerId, tenantId: tenants[0], type: 'PF', name: 'History customer', document: generateValidCpf(), phone: '11999998888' } });
    await prisma.unscoped.vehicle.create({ data: { id: vehicleId, tenantId: tenants[0], customerId, brand: 'Honda', model: 'Histórico', plate: 'HIS1A23' } });
    const base = { tenantId: tenants[0], customerId, vehicleId, openedAt: new Date('2026-10-01T12:00:00Z') };
    await prisma.unscoped.serviceOrder.createMany({ data: [
      ...Array.from({ length: 103 }, (_, index) => ({ ...base, orderNumber: index + 1, status: 'DELIVERED', closedAt: new Date('2026-10-24T12:00:00Z') })),
      { ...base, id: firstDelivery, orderNumber: 104, status: 'DELIVERED', closedAt: new Date('2026-10-24T03:00:00Z') },
      { ...base, id: lastDelivery, orderNumber: 105, status: 'DELIVERED', closedAt: new Date('2026-10-25T02:59:59.999Z') },
      { ...base, orderNumber: 106, status: 'DELIVERED', closedAt: new Date('2026-10-24T02:59:59.999Z') },
      { ...base, orderNumber: 107, status: 'DELIVERED', closedAt: new Date('2026-10-25T03:00:00Z') },
      { ...base, orderNumber: 108, status: 'CANCELLED', closedAt: new Date('2026-10-24T12:00:00Z') },
      { ...base, orderNumber: 109, status: 'DELIVERED', closedAt: new Date('2026-10-24T12:00:00Z'), deletedAt: new Date() },
      { ...base, id: opened, orderNumber: 110, status: 'OPEN', openedAt: new Date('2026-10-24T13:00:00Z'), expectedDeliveryAt: new Date('2020-01-01') },
    ] });
    await prisma.unscoped.serviceOrderItem.createMany({ data: [
      { serviceOrderId: firstDelivery, type: 'LABOR', description: 'Paid work', quantity: 1, unitPriceCents: 10000 },
      { serviceOrderId: lastDelivery, type: 'LABOR', description: 'Partial work', quantity: 1, unitPriceCents: 10000 },
    ] });
    const admin = await prisma.unscoped.user.findFirstOrThrow({ where: { tenantId: tenants[0] } });
    await prisma.unscoped.serviceOrderReceipt.createMany({ data: [
      { tenantId: tenants[0], serviceOrderId: firstDelivery, amountCents: 10000, method: 'PIX', receivedAt: new Date(), confirmedBy: admin.id },
      { tenantId: tenants[0], serviceOrderId: lastDelivery, amountCents: 5000, method: 'PIX', receivedAt: new Date(), confirmedBy: admin.id },
    ] });
  });

  afterAll(async () => {
    if (prisma && tenants.length) {
      const ids = (await prisma.unscoped.serviceOrder.findMany({ where: { tenantId: { in: tenants } }, select: { id: true } })).map((order) => order.id);
      await prisma.unscoped.serviceOrderReceipt.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.serviceOrderItem.deleteMany({ where: { serviceOrderId: { in: ids } } });
      await prisma.unscoped.serviceOrder.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.vehicle.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.customer.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.user.deleteMany({ where: { tenantId: { in: tenants } } });
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: tenants } } });
    }
    if (app) await app.close();
  });

  function list(body = {}, accessToken = token) {
    return request(app.getHttpServer()).post('/api/v1/service-orders/list').set('Authorization', `Bearer ${accessToken}`)
      .send({ offset: 0, limit: 100, start_date: '2026-10-24', end_date: '2026-10-24', include_metrics: true, ...body });
  }

  it('counts actual deliveries even when they entered earlier, excluding cancellations and soft deletes', async () => {
    const response = await list({ date_field: 'OPENED' }).expect(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([opened]);
    expect(response.body.metrics).toEqual({ active: 1, overdue: 1, waiting_parts: 0, ready: 0, delivered: 105 });
    const empty = await list({ date_field: 'CLOSED', status: 'DELIVERED' }, otherToken).expect(200);
    expect(empty.body.total).toBe(0);
    expect(empty.body.metrics.delivered).toBe(0);
  });

  it('paginates more than 100 deliveries with inclusive day boundaries and stable counts', async () => {
    const first = await list({ date_field: 'CLOSED', status: 'DELIVERED' }).expect(200);
    const second = await list({ date_field: 'CLOSED', status: 'DELIVERED', offset: 100 }).expect(200);
    expect(first.body.total).toBe(105); expect(first.body.items).toHaveLength(100); expect(first.body.has_more).toBe(true);
    expect(second.body.items).toHaveLength(5); expect(second.body.has_more).toBe(false);
    expect(second.body.metrics.delivered).toBe(105);
    const ids = [...first.body.items, ...second.body.items].map((item: { id: string }) => item.id);
    expect(new Set(ids).size).toBe(105); expect(ids).toContain(firstDelivery); expect(ids).toContain(lastDelivery);
    expect(first.body.items[0].id).toBe(lastDelivery);
  });

  it('combines search, dates and operational attention before pagination', async () => {
    const found = await list({ attention: 'OVERDUE', search: 'HIS1A23' }).expect(200);
    expect(found.body.total).toBe(1); expect(found.body.items[0].id).toBe(opened);
    const missing = await list({ attention: 'ACTIVE', search: 'unmatched name' }).expect(200);
    expect(missing.body.total).toBe(0);
    const cancelled = await list({ date_field: 'CLOSED', status: 'CANCELLED' }).expect(200);
    expect(cancelled.body.total).toBe(1); expect(cancelled.body.metrics.delivered).toBe(105);
  });

  it('validates real calendar dates and rejects reversed periods', async () => {
    for (const body of [{ start_date: '2026-02-30' }, { start_date: '2026-10-25', end_date: '2026-10-24' }, { end_date: '2026-10-24T12:00:00Z' }, { date_field: 'INVALID' }]) await list(body).expect(400);
  });

  it('filters actual unpaid balances and shows received amounts in historical results', async () => {
    const response = await list({ date_field: 'CLOSED', attention: 'PAYMENT_PENDING' }).expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0]).toMatchObject({ id: lastDelivery, received_amount_cents: 5000, outstanding_amount_cents: 5000, payment_status: 'PARTIALLY_PAID' });
    const other = await list({ date_field: 'CLOSED', attention: 'PAYMENT_PENDING' }, otherToken).expect(200);
    expect(other.body.total).toBe(0);
  });

  it('supports open-ended periods and only closed orders when consulting delivery dates', async () => {
    const allClosed = await list({ start_date: undefined, end_date: undefined, date_field: 'CLOSED' }).expect(200);
    expect(allClosed.body.total).toBe(108);
    expect(allClosed.body.items.every((item: { closed_at?: string }) => item.closed_at)).toBe(true);
    const from = await list({ start_date: '2026-10-25', end_date: undefined, date_field: 'CLOSED' }).expect(200);
    expect(from.body.total).toBe(1);
    const until = await list({ start_date: undefined, end_date: '2026-10-23', date_field: 'CLOSED' }).expect(200);
    expect(until.body.total).toBe(1);
  });
});
