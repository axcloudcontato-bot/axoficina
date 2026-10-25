import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { LEGAL_VERSION } from '@oficina/contracts';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { AuditLogService } from '../src/shared/audit-log/audit-log.service';
import { generateValidCpf } from './utils/generate-cpf';

describe('Reception search (HTTP + PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenants: string[] = [];
  const workshops: Array<{ token: string; customerId: string; vehicleId: string; orderId: string; document: string }> = [];
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(AuditLogService).useValue({ record: async () => undefined }).compile();
    app = module.createNestApplication({ bodyParser: false }); configureApp(app); await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
    for (let index = 0; index < 2; index++) {
      const signup = await request(app.getHttpServer()).post('/api/v1/auth/signup').send({ accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: `Reception ${index}`, tenant_document: generateValidCpf(), admin_name: 'Admin', admin_email: `reception-${index}-${Date.now()}@example.invalid`, password: 'supersecret1' }).expect(201);
      tenants.push(signup.body.tenant.id);
      const token: string = signup.body.access_token;
      const document = generateValidCpf();
      const customer = await request(app.getHttpServer()).post('/api/v1/customers').set('Authorization', `Bearer ${token}`).send({ type: 'PF', document, name: `Cliente ${index}`, phone: '(11) 98888-7766', email: 'Existing@Example.invalid' }).expect(201);
      const vehicle = await request(app.getHttpServer()).post('/api/v1/vehicles').set('Authorization', `Bearer ${token}`).send({ customer_id: customer.body.customer.id, plate: 'ABC-1234', brand: 'Fiat', model: 'Uno', chassis: '9BWZZZ377VT004251', year: 2020 }).expect(201);
      const order = await request(app.getHttpServer()).post('/api/v1/service-orders').set('Authorization', `Bearer ${token}`).send({ vehicle_id: vehicle.body.vehicle.id }).expect(201);
      workshops.push({ token, document, customerId: customer.body.customer.id, vehicleId: vehicle.body.vehicle.id, orderId: order.body.service_order.id });
    }
  });
  afterAll(async () => {
    if (prisma && tenants.length) {
      const where = { tenantId: { in: tenants } };
      await prisma.unscoped.serviceOrderStatusHistory.deleteMany({ where: { serviceOrderId: { in: workshops.map((workshop) => workshop.orderId) } } });
      await prisma.unscoped.serviceOrder.deleteMany({ where }); await prisma.unscoped.vehicle.deleteMany({ where });
      await prisma.unscoped.customer.deleteMany({ where }); await prisma.unscoped.user.deleteMany({ where });
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: tenants } } });
    }
    await app?.close();
  });
  it('matches masked documents, unmasked phones and case-insensitive emails within each workshop', async () => {
    await Promise.all(workshops.map(async (workshop) => {
      const masked = workshop.document.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
      for (const search of [masked, '11988887766', '+55 (11) 98888-7766', 'existing@example.INVALID']) {
        const found = await request(app.getHttpServer()).post('/api/v1/customers/list').set('Authorization', `Bearer ${workshop.token}`).send({ offset: 0, limit: 20, search }).expect(200);
        expect(found.body.items.map((item: { id: string }) => item.id)).toEqual([workshop.customerId]);
      }
    }));
  });
  it('finds vehicles by plate variants, chassis, year and owner contact without crossing tenants', async () => {
    for (const workshop of workshops) for (const search of ['abc1234', 'ABC-1234', '9bwzzz377vt004251', '2020', 'existing@example.invalid', '11988887766']) {
      const found = await request(app.getHttpServer()).post('/api/v1/vehicles/list').set('Authorization', `Bearer ${workshop.token}`).send({ offset: 0, limit: 20, search, match_owner: true }).expect(200);
      expect(found.body.items.map((item: { id: string }) => item.id)).toEqual([workshop.vehicleId]);
    }
  });
  it('also resolves those contacts and plates in the global order search', async () => {
    const workshop = workshops[0];
    for (const search of ['11988887766', workshop.document, 'existing@example.invalid', 'abc1234']) {
      const found = await request(app.getHttpServer()).post('/api/v1/service-orders/list').set('Authorization', `Bearer ${workshop.token}`).send({ offset: 0, limit: 20, search }).expect(200);
      expect(found.body.items.map((item: { id: string }) => item.id)).toEqual([workshop.orderId]);
    }
    const oversized = await request(app.getHttpServer()).post('/api/v1/service-orders/list').set('Authorization', `Bearer ${workshop.token}`).send({ offset: 0, limit: 20, search: '9'.repeat(30) }).expect(200);
    expect(oversized.body.items).toEqual([]);
  });
});
