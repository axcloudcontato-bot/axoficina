import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { LEGAL_VERSION } from '@oficina/contracts';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { AuditLogService } from '../src/shared/audit-log/audit-log.service';
import { generateValidCpf } from './utils/generate-cpf';

describe('Productivity (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenantIds: string[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuditLogService).useValue({ record: async () => undefined }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma && tenantIds.length) {
      const where = { tenantId: { in: tenantIds } };
      await prisma.unscoped.technicianProductivityTarget.deleteMany({ where });
      await prisma.unscoped.serviceOrderProductivityShare.deleteMany({ where });
      await prisma.unscoped.serviceOrderWorkSession.deleteMany({ where });
      const orders = await prisma.unscoped.serviceOrder.findMany({ where, select: { id: true } });
      await prisma.unscoped.serviceOrderItem.deleteMany({ where: { serviceOrderId: { in: orders.map(order => order.id) } } });
      await prisma.unscoped.serviceOrder.deleteMany({ where });
      await prisma.unscoped.user.deleteMany({ where });
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await app?.close();
  });

  async function signup(suffix: string) {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({
      accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: `Productivity ${suffix}`,
      tenant_document: generateValidCpf(), admin_name: 'Admin produtividade',
      admin_email: `productivity-${suffix}-${Date.now()}@example.invalid`, password: 'supersecret1',
    }).expect(201);
    tenantIds.push(response.body.tenant.id);
    return { token: response.body.access_token as string, tenantId: response.body.tenant.id as string };
  }

  it('isolates workshops, serializes work starts, pages orders and reconciles a justified correction', async () => {
    const owner = await signup('owner');
    const outsider = await signup('outsider');
    const invited = await request(app.getHttpServer()).post('/api/v1/users/invite').set('Authorization', `Bearer ${owner.token}`)
      .send({ email: `productivity-mechanic-${Date.now()}@example.invalid`, name: 'Mecânico teste', role: 'MECHANIC' }).expect(201);
    const accepted = await request(app.getHttpServer()).post('/api/v1/users/accept-invite')
      .send({ accepted_terms: true, legal_version: LEGAL_VERSION, invite_token: invited.body.invite_link.split('/convite/')[1], password: 'supersecret1' }).expect(200);
    const mechanicToken = accepted.body.access_token as string;
    const mechanicId = accepted.body.user.id as string;
    const order = await prisma.unscoped.serviceOrder.create({ data: { tenantId: owner.tenantId, orderNumber: 1, customerId: randomUUID(), vehicleId: randomUUID(), technicianId: mechanicId, status: 'IN_PROGRESS', openedAt: new Date() } });
    const item = await prisma.unscoped.serviceOrderItem.create({ data: { serviceOrderId: order.id, type: 'LABOR', description: 'Serviço', quantity: 1, unitPriceCents: 5000 } });
    const start = () => request(app.getHttpServer()).post('/api/v1/service-orders/work-sessions/start').set('Authorization', `Bearer ${mechanicToken}`).send({ service_order_id: order.id });
    const attempts = await Promise.all([start(), start()]);
    expect(attempts.map(result => result.status).sort()).toEqual([200, 409]);
    expect(await prisma.unscoped.serviceOrderWorkSession.count({ where: { tenantId: owner.tenantId, serviceOrderId: order.id, endedAt: null } })).toBe(1);
    await request(app.getHttpServer()).get('/api/v1/service-orders/work-sessions').set('Authorization', `Bearer ${outsider.token}`).query({ serviceOrderId: order.id }).expect(404);
    await request(app.getHttpServer()).post('/api/v1/service-orders/work-sessions/stop').set('Authorization', `Bearer ${mechanicToken}`).send({ service_order_id: order.id }).expect(200);
    const deliveredAt = new Date();
    await prisma.unscoped.serviceOrder.update({ where: { id: order.id }, data: { status: 'DELIVERED', closedAt: deliveredAt } });
    await prisma.unscoped.serviceOrderProductivityShare.create({ data: { tenantId: owner.tenantId, serviceOrderId: order.id, technicianId: mechanicId, laborCents: 5000, workedMinutes: 45, basis: 'RECORDED', deliveredAt } });
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(deliveredAt);
    const [year, monthIndex] = month.split('-').map(Number);
    const range = { start_at: new Date(Date.UTC(year, monthIndex - 1, 1, 3)).toISOString(), end_at: new Date(Date.UTC(year, monthIndex, 1, 3)).toISOString() };
    await request(app.getHttpServer()).post('/api/v1/service-orders/technician-productivity').set('Authorization', `Bearer ${mechanicToken}`).send(range).expect(403);
    const report = await request(app.getHttpServer()).post('/api/v1/service-orders/technician-productivity').set('Authorization', `Bearer ${owner.token}`).send(range).expect(200);
    expect(report.body.totals).toMatchObject({ completed_count: 1, labor_revenue_cents: 5000 });
    const target = { technician_id: mechanicId, month, completed_count: 2, labor_revenue_cents: 10000, worked_minutes: 120 };
    await request(app.getHttpServer()).post('/api/v1/service-orders/productivity-target').set('Authorization', `Bearer ${mechanicToken}`).send(target).expect(403);
    await request(app.getHttpServer()).post('/api/v1/service-orders/productivity-target').set('Authorization', `Bearer ${owner.token}`).send(target).expect(200);
    const withTarget = await request(app.getHttpServer()).post('/api/v1/service-orders/technician-productivity').set('Authorization', `Bearer ${owner.token}`).send(range).expect(200);
    expect(withTarget.body.items[0].target).toMatchObject({ completed_count: 2, labor_revenue_cents: 10000, worked_minutes: 120 });
    const details = await request(app.getHttpServer()).post('/api/v1/service-orders/technician-productivity/orders').set('Authorization', `Bearer ${owner.token}`)
      .send({ ...range, technician_id: mechanicId, offset: 0, limit: 1 }).expect(200);
    expect(details.body).toMatchObject({ total: 1, items: [{ id: order.id, labor_cents: 5000 }] });
    const outsiderReport = await request(app.getHttpServer()).post('/api/v1/service-orders/technician-productivity').set('Authorization', `Bearer ${outsider.token}`).send(range).expect(200);
    expect(outsiderReport.body.totals.completed_count).toBe(0);
    const outsiderDetails = await request(app.getHttpServer()).post('/api/v1/service-orders/technician-productivity/orders').set('Authorization', `Bearer ${outsider.token}`)
      .send({ ...range, technician_id: mechanicId, offset: 0, limit: 1 }).expect(200);
    expect(outsiderDetails.body.items).toEqual([]);
    await request(app.getHttpServer()).post('/api/v1/service-orders/items/update').set('Authorization', `Bearer ${owner.token}`)
      .send({ id: item.id, unit_price_cents: 6000, edit_reason: 'Correção aprovada pelo gestor' }).expect(200);
    const corrected = await prisma.unscoped.serviceOrderProductivityShare.findFirst({ where: { serviceOrderId: order.id } });
    expect(corrected).toMatchObject({ technicianId: mechanicId, laborCents: 6000, workedMinutes: 45 });
  });
});
