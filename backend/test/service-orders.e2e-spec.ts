import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { generateValidCpf } from './utils/generate-cpf';

describe('Service Orders (e2e)', () => {
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
        tenant_name: `Oficina OS E2E ${suffix}`,
        tenant_document: generateValidCpf(),
        admin_name: 'Admin E2E',
        admin_email: `admin-os-${suffix}@e2e-test.com`,
        password: 'supersecret1',
      });
    createdTenantIds.push(response.body.tenant.id);
    return response.body as { access_token: string; tenant: { id: string } };
  }

  async function inviteRole(adminToken: string, suffix: string, role: 'MECHANIC' | 'FRONT_DESK' | 'MANAGER'): Promise<string> {
    const invite = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `${role.toLowerCase()}-os-${suffix}@e2e-test.com`, name: `Usuário ${role}`, role });
    const inviteToken = invite.body.invite_link.split('/invite/')[1];

    const accept = await request(app.getHttpServer())
      .post('/api/v1/users/accept-invite')
      .send({ invite_token: inviteToken, password: 'supersecret1' });
    return accept.body.access_token as string;
  }

  async function inviteTechnician(adminToken: string, suffix: string): Promise<{ token: string; userId: string }> {
    const invite = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `technician-os-${suffix}@e2e-test.com`, name: 'Técnico E2E', role: 'MECHANIC' });
    const inviteToken = invite.body.invite_link.split('/invite/')[1];

    const accept = await request(app.getHttpServer())
      .post('/api/v1/users/accept-invite')
      .send({ invite_token: inviteToken, password: 'supersecret1' });
    return { token: accept.body.access_token as string, userId: accept.body.user.id as string };
  }

  let plateCounter = 0;
  function uniquePlate(): string {
    plateCounter += 1;
    return `OS${plateCounter}${Math.floor(Math.random() * 10000)}`;
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

  // PNG 1x1 válido (assinatura real verificada pelo manager) — só pra
  // satisfazer a exigência de evidência fotográfica (ENTRY/EXIT, por ângulo,
  // e ISSUE/RESOLVED por item) antes das transições que agora a exigem, ver
  // service-order-state-machine.ts.
  const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  const ALL_ANGLES = ['FRONT', 'REAR', 'LEFT_SIDE', 'RIGHT_SIDE', 'SPARE_TIRE', 'DASHBOARD'] as const;

  async function uploadPhoto(
    token: string,
    serviceOrderId: string,
    fields: { category: 'ENTRY' | 'EXIT'; angle: (typeof ALL_ANGLES)[number] } | { category: 'ISSUE' | 'RESOLVED'; serviceOrderItemId: string },
  ): Promise<void> {
    let req = request(app.getHttpServer())
      .post('/api/v1/service-orders/photos')
      .set('Authorization', `Bearer ${token}`)
      .field('serviceOrderId', serviceOrderId)
      .field('category', fields.category);
    req = 'angle' in fields ? req.field('angle', fields.angle) : req.field('serviceOrderItemId', fields.serviceOrderItemId);
    const response = await req.attach('file', TINY_PNG, { filename: 'evidence.png', contentType: 'image/png' });
    if (response.status !== 201) {
      throw new Error(`uploadPhoto(${JSON.stringify(fields)}) failed with ${response.status}: ${JSON.stringify(response.body)}`);
    }
  }

  async function uploadAllAngles(token: string, serviceOrderId: string, category: 'ENTRY' | 'EXIT'): Promise<void> {
    for (const angle of ALL_ANGLES) {
      await uploadPhoto(token, serviceOrderId, { category, angle });
    }
  }

  it('creates a service order deriving customer_id from the vehicle, no customer_id accepted in the body', async () => {
    const admin = await signupAdmin(`create-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'create');
    const vehicleId = await createVehicle(admin.access_token, customerId, 'create');

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId });

    expect(response.status).toBe(201);
    expect(response.body.service_order.customer_id).toBe(customerId);
    expect(response.body.service_order.vehicle_id).toBe(vehicleId);
    expect(response.body.service_order.status).toBe('OPEN');
  });

  it('rejects customer_id in the create body — derived from the vehicle, not accepted directly', async () => {
    const admin = await signupAdmin(`createcust-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'createcust');
    const vehicleId = await createVehicle(admin.access_token, customerId, 'createcust');

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId, customer_id: customerId });

    expect(response.status).toBe(400);
  });

  it('rejects a non-existent vehicle_id with 400', async () => {
    const admin = await signupAdmin(`badvehicle-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });

    expect(response.status).toBe(400);
  });

  it('rejects a vehicle_id belonging to another tenant with 400', async () => {
    const adminA = await signupAdmin(`crossveh-a-${Date.now()}`);
    const adminB = await signupAdmin(`crossveh-b-${Date.now()}`);
    const customerA = await createCustomer(adminA.access_token, 'crossveh');
    const vehicleOfA = await createVehicle(adminA.access_token, customerA, 'crossveh');

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ vehicle_id: vehicleOfA });

    expect(response.status).toBe(400);
  });

  it('rejects a non-existent technician_id with 400', async () => {
    const admin = await signupAdmin(`badtech-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'badtech');
    const vehicleId = await createVehicle(admin.access_token, customerId, 'badtech');

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId, technician_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });

    expect(response.status).toBe(400);
  });

  it('rejects a disabled technician_id with 400', async () => {
    const suffix = `disabledtech-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);
    const technician = await inviteTechnician(admin.access_token, suffix);
    await prisma.unscoped.user.update({ where: { id: technician.userId }, data: { status: 'disabled' } });

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId, technician_id: technician.userId });

    expect(response.status).toBe(400);
  });

  it('rejects a malformed checklist (array instead of object) with 400', async () => {
    const admin = await signupAdmin(`badchecklist-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'badchecklist');
    const vehicleId = await createVehicle(admin.access_token, customerId, 'badchecklist');

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId, checklist: ['tires', 'brakes'] });

    expect(response.status).toBe(400);
  });

  it('happy path: create -> get with history -> update -> transitions through to DELIVERED -> list with filters', async () => {
    const suffix = `happy-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);
    const technician = await inviteTechnician(admin.access_token, suffix);

    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId });
    const id = created.body.service_order.id as string;

    const afterGet = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${id}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(afterGet.status).toBe(200);
    expect(afterGet.body.service_order.status_history).toHaveLength(1);
    expect(afterGet.body.service_order.status_history[0].to_status).toBe('OPEN');

    const afterUpdate = await request(app.getHttpServer())
      .post('/api/v1/service-orders/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id, technician_id: technician.userId, diagnosis: 'Troca de pastilha de freio', checklist: { tires: 'ok' } });
    expect(afterUpdate.status).toBe(200);
    expect(afterUpdate.body.service_order.diagnosis).toBe('Troca de pastilha de freio');
    expect(afterUpdate.body.service_order.technician_name).toBe('Técnico E2E');

    await uploadAllAngles(admin.access_token, id, 'ENTRY');
    await uploadAllAngles(admin.access_token, id, 'EXIT');

    const sequence: Array<[string, number]> = [
      ['IN_PROGRESS', 200],
      ['WAITING_PARTS', 200],
      ['IN_PROGRESS', 200],
      ['COMPLETED', 200],
      ['DELIVERED', 200],
    ];
    for (const [toStatus, expectedStatus] of sequence) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/service-orders/transition')
        .set('Authorization', `Bearer ${admin.access_token}`)
        .send({ id, to_status: toStatus });
      expect(response.status).toBe(expectedStatus);
      expect(response.body.service_order.status).toBe(toStatus);
    }

    const delivered = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${id}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(delivered.body.service_order.closed_at).not.toBeNull();
    expect(delivered.body.service_order.status_history).toHaveLength(6);

    const byStatus = await request(app.getHttpServer())
      .post('/api/v1/service-orders/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10, status: 'DELIVERED' });
    expect(byStatus.body.items.some((item: { id: string }) => item.id === id)).toBe(true);

    const byVehicle = await request(app.getHttpServer())
      .post('/api/v1/service-orders/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10, vehicle_id: vehicleId });
    expect(byVehicle.body.items.every((item: { vehicle_id: string }) => item.vehicle_id === vehicleId)).toBe(true);
  });

  it('rejects transitions that skip a step or leave a terminal state, with 400', async () => {
    const suffix = `badtransition-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);

    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId });
    const id = created.body.service_order.id as string;

    const skipStep = await request(app.getHttpServer())
      .post('/api/v1/service-orders/transition')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id, to_status: 'DELIVERED' });
    expect(skipStep.status).toBe(400);

    await request(app.getHttpServer())
      .post('/api/v1/service-orders/transition')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id, to_status: 'IN_PROGRESS' });
    await request(app.getHttpServer())
      .post('/api/v1/service-orders/transition')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id, to_status: 'CANCELLED' });

    const leaveTerminal = await request(app.getHttpServer())
      .post('/api/v1/service-orders/transition')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id, to_status: 'OPEN' });
    expect(leaveTerminal.status).toBe(400);
  });

  it('race condition: only one of two concurrent transitions on the same service order succeeds', async () => {
    const suffix = `race-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);

    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId });
    const id = created.body.service_order.id as string;
    await uploadAllAngles(admin.access_token, id, 'ENTRY');

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/service-orders/transition')
        .set('Authorization', `Bearer ${admin.access_token}`)
        .send({ id, to_status: 'IN_PROGRESS' }),
      request(app.getHttpServer())
        .post('/api/v1/service-orders/transition')
        .set('Authorization', `Bearer ${admin.access_token}`)
        .send({ id, to_status: 'CANCELLED' }),
    ]);

    // Exatamente um dos dois vence: a invariante é "nunca os dois sucedem",
    // não qual código o perdedor recebe. O perdedor normalmente perde no
    // lock otimista (409), mas se o outro já comitou antes mesmo da leitura
    // inicial deste, ele enxerga o novo status (CANCELLED, terminal) e cai
    // no 400 de transição inválida primeiro — os dois são "perdeu a corrida".
    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses[0]).toBe(200);
    expect(statuses[1]).toBeGreaterThanOrEqual(400);
    expect(statuses[1]).toBeLessThan(500);

    const afterRace = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${id}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(afterRace.body.service_order.status_history).toHaveLength(2);
  });

  it('soft deletes a service order in any status', async () => {
    const suffix = `delete-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);

    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId });
    const id = created.body.service_order.id as string;

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders/delete')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id });
    expect(response.status).toBe(200);

    const getAfterDelete = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${id}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it('falls back to a placeholder plate instead of 500 when the linked vehicle was soft-deleted after creation', async () => {
    const suffix = `orphan-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);

    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleId });
    const id = created.body.service_order.id as string;

    await request(app.getHttpServer())
      .post('/api/v1/vehicles/delete')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: vehicleId });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${id}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(response.status).toBe(200);
    expect(response.body.service_order.vehicle_plate).toBe('Veículo removido');
  });

  it('all 4 roles have full access — no RBAC differentiation for this feature', async () => {
    const suffix = `roles-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const vehicleId = await createVehicle(admin.access_token, customerId, suffix);
    const mechanicToken = await inviteRole(admin.access_token, suffix, 'MECHANIC');
    const frontDeskToken = await inviteRole(admin.access_token, `${suffix}-fd`, 'FRONT_DESK');
    const managerToken = await inviteRole(admin.access_token, `${suffix}-mgr`, 'MANAGER');

    for (const token of [mechanicToken, frontDeskToken, managerToken]) {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/service-orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ vehicle_id: vehicleId });
      expect(createResponse.status).toBe(201);
      const id = createResponse.body.service_order.id as string;

      const updateResponse = await request(app.getHttpServer())
        .post('/api/v1/service-orders/update')
        .set('Authorization', `Bearer ${token}`)
        .send({ id, diagnosis: 'Ok' });
      expect(updateResponse.status).toBe(200);

      await uploadAllAngles(token, id, 'ENTRY');

      const transitionResponse = await request(app.getHttpServer())
        .post('/api/v1/service-orders/transition')
        .set('Authorization', `Bearer ${token}`)
        .send({ id, to_status: 'IN_PROGRESS' });
      expect(transitionResponse.status).toBe(200);

      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/service-order?id=${id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getResponse.status).toBe(200);

      const listResponse = await request(app.getHttpServer())
        .post('/api/v1/service-orders/list')
        .set('Authorization', `Bearer ${token}`)
        .send({ offset: 0, limit: 10 });
      expect(listResponse.status).toBe(200);

      const deleteResponse = await request(app.getHttpServer())
        .post('/api/v1/service-orders/delete')
        .set('Authorization', `Bearer ${token}`)
        .send({ id });
      expect(deleteResponse.status).toBe(200);
    }
  });

  it('tenant isolation: a service order from tenant A never appears for tenant B', async () => {
    const adminA = await signupAdmin(`isoA-${Date.now()}`);
    const adminB = await signupAdmin(`isoB-${Date.now()}`);
    const customerA = await createCustomer(adminA.access_token, 'isoA');
    const vehicleA = await createVehicle(adminA.access_token, customerA, 'isoA');

    const created = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${adminA.access_token}`)
      .send({ vehicle_id: vehicleA });
    const id = created.body.service_order.id as string;

    const getFromB = await request(app.getHttpServer())
      .get(`/api/v1/service-order?id=${id}`)
      .set('Authorization', `Bearer ${adminB.access_token}`);
    expect(getFromB.status).toBe(404);

    const transitionFromB = await request(app.getHttpServer())
      .post('/api/v1/service-orders/transition')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ id, to_status: 'IN_PROGRESS' });
    expect(transitionFromB.status).toBe(404);

    const deleteFromB = await request(app.getHttpServer())
      .post('/api/v1/service-orders/delete')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ id });
    expect(deleteFromB.status).toBe(404);

    const listFromB = await request(app.getHttpServer())
      .post('/api/v1/service-orders/list')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ offset: 0, limit: 100 });
    expect(listFromB.body.items.some((item: { id: string }) => item.id === id)).toBe(false);
  });

  it('filters by customer_id — Feature 6 (Cadastro de Cliente Expandido) Histórico tab', async () => {
    const suffix = `customerfilter-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerA = await createCustomer(admin.access_token, `${suffix}-a`);
    const customerB = await createCustomer(admin.access_token, `${suffix}-b`);
    const vehicleA = await createVehicle(admin.access_token, customerA, `${suffix}-a`);
    const vehicleB = await createVehicle(admin.access_token, customerB, `${suffix}-b`);

    const createdA = await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleA });
    await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ vehicle_id: vehicleB });

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 100, customer_id: customerA });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].id).toBe(createdA.body.service_order.id);
  });

  it('customer_id filter is tenant-isolated — a customer_id from another tenant returns an empty list', async () => {
    const adminA = await signupAdmin(`customeriso-a-${Date.now()}`);
    const adminB = await signupAdmin(`customeriso-b-${Date.now()}`);
    const customerA = await createCustomer(adminA.access_token, 'customeriso');
    const vehicleA = await createVehicle(adminA.access_token, customerA, 'customeriso');
    await request(app.getHttpServer())
      .post('/api/v1/service-orders')
      .set('Authorization', `Bearer ${adminA.access_token}`)
      .send({ vehicle_id: vehicleA });

    const response = await request(app.getHttpServer())
      .post('/api/v1/service-orders/list')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ offset: 0, limit: 100, customer_id: customerA });

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(0);
  });
});
