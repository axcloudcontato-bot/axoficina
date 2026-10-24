import { LEGAL_VERSION } from '@oficina/contracts';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { generateValidCpf } from './utils/generate-cpf';

describe('Service Order Items (e2e)', () => {
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
      const serviceOrders = await prisma.unscoped.serviceOrder.findMany({
        where: { tenantId: { in: createdTenantIds } },
        select: { id: true },
      });
      const serviceOrderIds = serviceOrders.map((serviceOrder) => serviceOrder.id);
      await prisma.unscoped.serviceOrderItem.deleteMany({ where: { serviceOrderId: { in: serviceOrderIds } } });
      await prisma.unscoped.serviceOrderStatusHistory.deleteMany({ where: { serviceOrderId: { in: serviceOrderIds } } });
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
        tenant_name: `Oficina Items E2E ${suffix}`,
        tenant_document: generateValidCpf(),
        admin_name: 'Admin E2E',
        admin_email: `admin-items-${suffix}@e2e-test.com`,
        password: 'supersecret1',
      });
    createdTenantIds.push(response.body.tenant.id);
    return response.body as { access_token: string; tenant: { id: string } };
  }

  async function inviteMechanic(adminToken: string, suffix: string): Promise<string> {
    const invite = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `mechanic-items-${suffix}@e2e-test.com`, name: 'Mecânico', role: 'MECHANIC' });
    const inviteToken = invite.body.invite_link.split('/invite/')[1];

    const accept = await request(app.getHttpServer())
      .post('/api/v1/users/accept-invite')
      .send({ accepted_terms: true, legal_version: LEGAL_VERSION, invite_token: inviteToken, password: 'supersecret1' });
    return accept.body.access_token as string;
  }

  let plateCounter = 0;
  function uniquePlate(): string {
    plateCounter += 1;
    return `ITM${plateCounter}${Math.floor(Math.random() * 10000)}`;
  }

  async function createCustomer(adminToken: string, suffix: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'PF', document: generateValidCpf(), name: `Dono ${suffix}`, phone: '11999998888' });
    return response.body.customer.id as string;
  }

  async function createVehicle(adminToken: string, customerId: string, suffix: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customer_id: customerId, brand: 'Fiat', model: `Uno ${suffix}`, plate: uniquePlate() });
    return response.body.vehicle.id as string;
  }

  async function createServiceOrder(adminToken: string, customerSuffix: string): Promise<string> {
    const customerId = await createCustomer(adminToken, customerSuffix);
    const vehicleId = await createVehicle(adminToken, customerId, customerSuffix);
    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ vehicle_id: vehicleId });
    return response.body.service_order.id as string;
  }

  async function transition(adminToken: string, serviceOrderId: string, toStatus: string) {
    return request(app.getHttpServer())
      .post('/api/v1/service-orders/transition')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: serviceOrderId, to_status: toStatus });
  }

  it('adds a PART and a LABOR item and reflects the summed total_amount_cents on the service order', async () => {
    const admin = await signupAdmin(`add-${Date.now()}`);
    const serviceOrderId = await createServiceOrder(admin.access_token, 'add');

    const partResponse = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'Filtro de óleo', quantity: 2, unit_price_cents: 5000 });
    expect(partResponse.status).toBe(201);
    expect(partResponse.body.item.line_total_cents).toBe(10000);

    const laborResponse = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'LABOR', description: 'Troca de óleo', quantity: 1, unit_price_cents: 8000 });
    expect(laborResponse.status).toBe(201);

    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${serviceOrderId}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(getResponse.body.service_order.total_amount_cents).toBe(18000);
    expect(getResponse.body.service_order.items).toHaveLength(2);
  });

  it('accepts a fractional quantity (e.g. 1.5 liters of oil)', async () => {
    const admin = await signupAdmin(`fraction-${Date.now()}`);
    const serviceOrderId = await createServiceOrder(admin.access_token, 'fraction');

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'Óleo 5W30', quantity: 1.5, unit_price_cents: 4000 });

    expect(response.status).toBe(201);
    expect(response.body.item.line_total_cents).toBe(6000);
  });

  it('edits an item and recalculates the total', async () => {
    const admin = await signupAdmin(`edit-${Date.now()}`);
    const serviceOrderId = await createServiceOrder(admin.access_token, 'edit');
    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'Pastilha de freio', quantity: 1, unit_price_cents: 12000 });

    const updateResponse = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.item.id, quantity: 2 });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.item.line_total_cents).toBe(24000);

    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${serviceOrderId}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(getResponse.body.service_order.total_amount_cents).toBe(24000);
  });

  it('removes an item and the total goes back to what remains', async () => {
    const admin = await signupAdmin(`remove-${Date.now()}`);
    const serviceOrderId = await createServiceOrder(admin.access_token, 'remove');
    const kept = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'Item mantido', quantity: 1, unit_price_cents: 3000 });
    const removed = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'Item removido', quantity: 1, unit_price_cents: 7000 });

    const deleteResponse = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items/delete')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: removed.body.item.id });
    expect(deleteResponse.status).toBe(200);

    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${serviceOrderId}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(getResponse.body.service_order.total_amount_cents).toBe(3000);
    expect(getResponse.body.service_order.items.map((item: { id: string }) => item.id)).toEqual([kept.body.item.id]);
  });

  it('removing every item brings the total back to zero, not an error', async () => {
    const admin = await signupAdmin(`removeall-${Date.now()}`);
    const serviceOrderId = await createServiceOrder(admin.access_token, 'removeall');
    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'Único item', quantity: 1, unit_price_cents: 5000 });

    await request(app.getHttpServer())
      .post('/api/v1/service-orders/items/delete')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.item.id });

    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${serviceOrderId}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body.service_order.total_amount_cents).toBe(0);
    expect(getResponse.body.service_order.items).toEqual([]);
  });

  it('POST /service-orders/list returns total_amount_cents without loading the full items array', async () => {
    const admin = await signupAdmin(`list-${Date.now()}`);
    const serviceOrderId = await createServiceOrder(admin.access_token, 'list');
    await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'LABOR', description: 'Mão de obra', quantity: 1, unit_price_cents: 9000 });

    const listResponse = await request(app.getHttpServer())
      .post('/api/v1/service-orders/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10 });

    const row = listResponse.body.items.find((item: { id: string }) => item.id === serviceOrderId);
    expect(row.total_amount_cents).toBe(9000);
    expect(row.items).toBeUndefined();
  });

  it('rejects zero or negative quantity, and negative unit_price_cents, with 400', async () => {
    const admin = await signupAdmin(`invalid-${Date.now()}`);
    const serviceOrderId = await createServiceOrder(admin.access_token, 'invalid');

    const zeroQuantity = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'X', quantity: 0, unit_price_cents: 100 });
    expect(zeroQuantity.status).toBe(400);

    const negativeQuantity = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'X', quantity: -1, unit_price_cents: 100 });
    expect(negativeQuantity.status).toBe(400);

    const negativePrice = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'X', quantity: 1, unit_price_cents: -100 });
    expect(negativePrice.status).toBe(400);
  });

  it('rejects a quantity with more than 2 decimal places with 400 (Edge Case 6)', async () => {
    const admin = await signupAdmin(`decimals-${Date.now()}`);
    const serviceOrderId = await createServiceOrder(admin.access_token, 'decimals');

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'Óleo', quantity: 1.239, unit_price_cents: 100 });

    expect(response.status).toBe(400);
  });

  it('rejects adding an item to a service order that belongs to another tenant with 404', async () => {
    const adminA = await signupAdmin(`crossA-${Date.now()}`);
    const adminB = await signupAdmin(`crossB-${Date.now()}`);
    const serviceOrderIdOfA = await createServiceOrder(adminA.access_token, 'crossA');

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ service_order_id: serviceOrderIdOfA, type: 'PART', description: 'X', quantity: 1, unit_price_cents: 100 });

    expect(response.status).toBe(404);
  });

  it('rejects updating/deleting an item belonging to another tenant with 404, without leaking or altering it', async () => {
    const adminA = await signupAdmin(`crossitemA-${Date.now()}`);
    const adminB = await signupAdmin(`crossitemB-${Date.now()}`);
    const serviceOrderIdOfA = await createServiceOrder(adminA.access_token, 'crossitemA');
    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${adminA.access_token}`)
      .send({ service_order_id: serviceOrderIdOfA, type: 'PART', description: 'Item de A', quantity: 1, unit_price_cents: 5000 });

    const updateAttempt = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items/update')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ id: created.body.item.id, quantity: 99 });
    expect(updateAttempt.status).toBe(404);

    const deleteAttempt = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items/delete')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ id: created.body.item.id });
    expect(deleteAttempt.status).toBe(404);

    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${serviceOrderIdOfA}`)
      .set('Authorization', `Bearer ${adminA.access_token}`);
    expect(getResponse.body.service_order.items).toHaveLength(1);
    expect(getResponse.body.service_order.items[0].description).toBe('Item de A');
  });

  it('MECHANIC is blocked (403) from creating, updating, or deleting items', async () => {
    const suffix = `mechanic-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const serviceOrderId = await createServiceOrder(admin.access_token, suffix);
    const mechanicToken = await inviteMechanic(admin.access_token, suffix);

    const createAttempt = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'X', quantity: 1, unit_price_cents: 100 });
    expect(createAttempt.status).toBe(403);

    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'PART', description: 'X', quantity: 1, unit_price_cents: 100 });

    const updateAttempt = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items/update')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ id: created.body.item.id, quantity: 2 });
    expect(updateAttempt.status).toBe(403);

    const deleteAttempt = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items/delete')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ id: created.body.item.id });
    expect(deleteAttempt.status).toBe(403);
  });

  it('allows adding, editing, and removing items regardless of the service order status (no lock on DELIVERED or CANCELLED)', async () => {
    const admin = await signupAdmin(`nolock-${Date.now()}`);
    const serviceOrderId = await createServiceOrder(admin.access_token, 'nolock');
    await transition(admin.access_token, serviceOrderId, 'IN_PROGRESS');
    await transition(admin.access_token, serviceOrderId, 'COMPLETED');
    await transition(admin.access_token, serviceOrderId, 'DELIVERED');

    const addAfterDelivered = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ service_order_id: serviceOrderId, type: 'LABOR', description: 'Retrabalho', quantity: 1, unit_price_cents: 2000 });
    expect(addAfterDelivered.status).toBe(201);

    const updateAfterDelivered = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: addAfterDelivered.body.item.id, quantity: 2 });
    expect(updateAfterDelivered.status).toBe(200);

    const deleteAfterDelivered = await request(app.getHttpServer())
      .post('/api/v1/service-orders/items/delete')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: addAfterDelivered.body.item.id });
    expect(deleteAfterDelivered.status).toBe(200);
  });
});
