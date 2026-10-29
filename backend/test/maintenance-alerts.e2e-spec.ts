import { LEGAL_VERSION } from '@oficina/contracts';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { generateValidCpf } from './utils/generate-cpf';
import { uniquePlate } from './utils/unique-plate';

describe('Maintenance Alerts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    (app.get(ThrottlerStorage) as ThrottlerStorageService).storage.clear();
  });

  afterAll(async () => {
    if (createdTenantIds.length > 0) {
      await prisma.unscoped.maintenanceAlert.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      const serviceOrders = await prisma.unscoped.serviceOrder.findMany({
        where: { tenantId: { in: createdTenantIds } },
        select: { id: true },
      });
      await prisma.unscoped.serviceOrderStatusHistory.deleteMany({
        where: { serviceOrderId: { in: serviceOrders.map((serviceOrder) => serviceOrder.id) } },
      });
      await prisma.unscoped.serviceOrder.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      await prisma.unscoped.vehicle.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      await prisma.unscoped.customer.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      await prisma.unscoped.user.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
    }
    await app.close();
  });

  async function signupAdmin(suffix: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        accepted_terms: true, legal_version: LEGAL_VERSION,
        tenant_name: `Oficina Alertas E2E ${suffix}`,
        tenant_document: generateValidCpf(),
        admin_name: 'Admin E2E',
        admin_email: `admin-alerts-${suffix}@e2e-test.com`,
        password: 'supersecret1',
      });
    createdTenantIds.push(response.body.tenant.id);
    return response.body as { access_token: string; tenant: { id: string } };
  }


  async function createCustomer(adminToken: string, suffix: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'PF', document: generateValidCpf(), name: `Dono ${suffix}`, phone: '11999998888' });
    return response.body.customer.id as string;
  }

  // PNG 1x1 válido — satisfaz a exigência de evidência fotográfica (ENTRY/EXIT,
  // por ângulo) antes das transições que agora a exigem (ver service-order-state-machine.ts).
  const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const ALL_ANGLES = ['FRONT', 'REAR', 'LEFT_SIDE', 'RIGHT_SIDE', 'SPARE_TIRE', 'DASHBOARD'] as const;

  async function uploadPhoto(token: string, serviceOrderId: string, category: 'ENTRY' | 'EXIT', angle: (typeof ALL_ANGLES)[number]): Promise<void> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders/photos')
      .set('Authorization', `Bearer ${token}`)
      .field('serviceOrderId', serviceOrderId)
      .field('category', category)
      .field('angle', angle)
      .attach('file', TINY_PNG, { filename: 'evidence.png', contentType: 'image/png' });
    if (response.status !== 201) {
      throw new Error(`uploadPhoto(${category}, ${angle}) failed with ${response.status}: ${JSON.stringify(response.body)}`);
    }
  }

  async function uploadAllAngles(token: string, serviceOrderId: string, category: 'ENTRY' | 'EXIT'): Promise<void> {
    for (const angle of ALL_ANGLES) {
      await uploadPhoto(token, serviceOrderId, category, angle);
    }
  }

  async function createVehicle(adminToken: string, customerId: string, suffix: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_id: customerId, brand: 'Fiat', model: `Uno ${suffix}`, plate: uniquePlate() });
    return response.body.vehicle.id as string;
  }

  function monthsAgo(months: number): Date {
    const date = new Date();
    date.setUTCMonth(date.getUTCMonth() - months);
    return date;
  }

  async function seedAlert(tenantId: string, vehicleId: string, customerId: string, referenceDate: Date, status: 'OPEN' | 'RESOLVED' = 'OPEN') {
    return prisma.unscoped.maintenanceAlert.create({
      data: { tenantId, vehicleId, customerId, referenceDate, status },
    });
  }

  it('lists only OPEN alerts by default, ordered by oldest reference first', async () => {
    const suffix = `list-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);
    const olderVehicleId = await createVehicle(admin.access_token, customerId, `${suffix}-b`);

    await seedAlert(admin.tenant.id, vehicleId, customerId, monthsAgo(7));
    const olderAlert = await seedAlert(admin.tenant.id, olderVehicleId, customerId, monthsAgo(9));
    await seedAlert(admin.tenant.id, vehicleId, customerId, monthsAgo(1), 'RESOLVED');

    const response = await request(app.getHttpServer())
      .post('/api/v1/maintenance-alerts/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 20 });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0].id).toBe(olderAlert.id);
    expect(response.body.items.every((item: { status: string }) => item.status === 'OPEN')).toBe(true);
  });

  it('filters by status=RESOLVED when requested', async () => {
    const suffix = `filter-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);

    await seedAlert(admin.tenant.id, vehicleId, customerId, monthsAgo(7));
    const resolved = await seedAlert(admin.tenant.id, vehicleId, customerId, monthsAgo(13), 'RESOLVED');

    const response = await request(app.getHttpServer())
      .post('/api/v1/maintenance-alerts/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 20, status: 'RESOLVED' });

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([resolved.id]);
  });

  it('resolves an OPEN alert, recording who resolved it', async () => {
    const suffix = `resolve-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);
    const alert = await seedAlert(admin.tenant.id, vehicleId, customerId, monthsAgo(7));

    const response = await request(app.getHttpServer())
      .post('/api/v1/maintenance-alerts/resolve')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: alert.id });

    expect(response.status).toBe(200);
    expect(response.body.alert.status).toBe('RESOLVED');
    expect(response.body.alert.resolved_by).toBeTruthy();
  });

  it('resolving an already-resolved alert is idempotent (Edge Case 8)', async () => {
    const suffix = `idempotent-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);
    const alert = await seedAlert(admin.tenant.id, vehicleId, customerId, monthsAgo(7));

    const first = await request(app.getHttpServer())
      .post('/api/v1/maintenance-alerts/resolve')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: alert.id });
    const second = await request(app.getHttpServer())
      .post('/api/v1/maintenance-alerts/resolve')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: alert.id });

    expect(second.status).toBe(200);
    expect(second.body.alert.resolved_at).toBe(first.body.alert.resolved_at);
  });

  it('returns 404 resolving an alert id that does not exist, without leaking other tenants (Edge Case 9)', async () => {
    const admin = await signupAdmin(`missing-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/maintenance-alerts/resolve')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: randomUUID() });

    expect(response.status).toBe(404);
  });

  it('never lists or resolves an alert belonging to another tenant', async () => {
    const suffixA = `isolation-a-${Date.now()}`;
    const suffixB = `isolation-b-${Date.now()}`;
    const adminA = await signupAdmin(suffixA);
    const adminB = await signupAdmin(suffixB);
    const customerIdB = await createCustomer(adminB.access_token, suffixB);
    const vehicleIdB = await createVehicle(adminB.access_token, customerIdB, suffixB);
    const alertB = await seedAlert(adminB.tenant.id, vehicleIdB, customerIdB, monthsAgo(7));

    const listAsA = await request(app.getHttpServer())
      .post('/api/v1/maintenance-alerts/list')
      .set('Authorization', `Bearer ${adminA.access_token}`)
      .send({ offset: 0, limit: 20 });
    expect(listAsA.body.items.some((item: { id: string }) => item.id === alertB.id)).toBe(false);

    const resolveAsA = await request(app.getHttpServer())
      .post('/api/v1/maintenance-alerts/resolve')
      .set('Authorization', `Bearer ${adminA.access_token}`)
      .send({ id: alertB.id });
    expect(resolveAsA.status).toBe(404);
  });

  it('auto-resolves an open alert when the linked service order is transitioned to DELIVERED (Edge Case 4)', async () => {
    const suffix = `autoresolve-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);
    const staleAlert = await seedAlert(admin.tenant.id, vehicleId, customerId, monthsAgo(9));

    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId });
    const serviceOrderId = created.body.service_order.id as string;
    await uploadAllAngles(admin.access_token, serviceOrderId, 'ENTRY');
    await uploadAllAngles(admin.access_token, serviceOrderId, 'EXIT');

    for (const toStatus of ['IN_PROGRESS', 'COMPLETED', 'DELIVERED']) {
      const transitionResponse = await request(app.getHttpServer())
        .post('/api/v1/service-orders/transition')
        .set('Authorization', `Bearer ${admin.access_token}`)
        .send({ id: serviceOrderId, to_status: toStatus });
      expect(transitionResponse.status).toBe(200);
    }

    const reloaded = await prisma.unscoped.maintenanceAlert.findFirst({ where: { id: staleAlert.id } });
    expect(reloaded?.status).toBe('RESOLVED');
    expect(reloaded?.resolvedBy).toBeNull();
  });
});
