import { LEGAL_VERSION } from '@oficina/contracts';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { generateValidCpf } from './utils/generate-cpf';

describe('Vehicles (e2e)', () => {
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
        tenant_name: `Oficina Vehicles E2E ${suffix}`,
        tenant_document: generateValidCpf(),
        admin_name: 'Admin E2E',
        admin_email: `admin-vehicles-${suffix}@e2e-test.com`,
        password: 'supersecret1',
      });
    createdTenantIds.push(response.body.tenant.id);
    return response.body as { access_token: string; tenant: { id: string } };
  }

  async function inviteMechanic(adminToken: string, suffix: string): Promise<string> {
    const invite = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `mechanic-vehicles-${suffix}@e2e-test.com`, name: 'Mecânico', role: 'MECHANIC' });
    const inviteToken = invite.body.invite_link.split('/invite/')[1];

    const accept = await request(app.getHttpServer())
      .post('/api/v1/users/accept-invite')
      .send({ accepted_terms: true, legal_version: LEGAL_VERSION, invite_token: inviteToken, password: 'supersecret1' });
    return accept.body.access_token as string;
  }

  async function createCustomer(adminToken: string, suffix: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'PF', document: generateValidCpf(), name: `Dono ${suffix}`, phone: '11999998888' });
    return response.body.customer.id as string;
  }

  async function createCustomerWithNameAndDocument(adminToken: string, name: string, document: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'PF', document, name, phone: '11999998888' });
    return response.body.customer.id as string;
  }

  let plateCounter = 0;
  function uniquePlate(): string {
    plateCounter += 1;
    return `E2E${plateCounter}${Math.floor(Math.random() * 10000)}`;
  }

  function vehiclePayload(customerId: string, suffix: string) {
    return {
      customer_id: customerId,
      brand: 'Fiat',
      model: `Uno ${suffix}`,
      plate: uniquePlate(),
    };
  }

  it('creates a vehicle linked to an existing customer', async () => {
    const admin = await signupAdmin(`create-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'create');

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'create'));

    expect(response.status).toBe(201);
    expect(response.body.vehicle.id).toBeDefined();
    expect(response.body.vehicle.customer_id).toBe(customerId);
    expect(response.body.vehicle.customer_name).toBe('Dono create');
  });

  it('rejects a non-existent customer_id with 400', async () => {
    const admin = await signupAdmin(`badcustomer-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'badcustomer'));

    expect(response.status).toBe(400);
  });

  it('rejects a customer_id belonging to another tenant with 400', async () => {
    const adminA = await signupAdmin(`crosscust-a-${Date.now()}`);
    const adminB = await signupAdmin(`crosscust-b-${Date.now()}`);
    const customerOfA = await createCustomer(adminA.access_token, 'crosscust');

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send(vehiclePayload(customerOfA, 'crosscust'));

    expect(response.status).toBe(400);
  });

  it('rejects a duplicate plate within the same tenant with 409', async () => {
    const admin = await signupAdmin(`dup-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'dup');
    const payload = vehiclePayload(customerId, 'dup');

    const first = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ ...payload, model: 'Outro modelo' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('VEHICLE_PLATE_ALREADY_EXISTS');
  });

  it('allows the same plate across two different tenants', async () => {
    const adminA = await signupAdmin(`tenantA-${Date.now()}`);
    const adminB = await signupAdmin(`tenantB-${Date.now()}`);
    const customerA = await createCustomer(adminA.access_token, 'tenantA');
    const customerB = await createCustomer(adminB.access_token, 'tenantB');
    const sharedPlate = uniquePlate();

    const first = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminA.access_token}`)
      .send({ customer_id: customerA, brand: 'Fiat', model: 'Uno', plate: sharedPlate });
    const second = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ customer_id: customerB, brand: 'Fiat', model: 'Uno', plate: sharedPlate });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it('updates a vehicle', async () => {
    const admin = await signupAdmin(`update-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'update');
    const created = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'update'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.vehicle.id, mileage: 42000 });

    expect(response.status).toBe(200);
    expect(response.body.vehicle.mileage).toBe(42000);
  });

  it('rejects customer_id in the update body — not editable after creation', async () => {
    const admin = await signupAdmin(`updatecust-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'updatecust');
    const created = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'updatecust'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.vehicle.id, customer_id: customerId });

    expect(response.status).toBe(400);
  });

  it('rejects changing the plate to one already used by another vehicle', async () => {
    const admin = await signupAdmin(`updateplate-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'updateplate');
    const first = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'updateplate-1'));
    const second = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'updateplate-2'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: second.body.vehicle.id, plate: first.body.vehicle.plate });

    expect(response.status).toBe(409);
  });

  it('gets a vehicle by id', async () => {
    const admin = await signupAdmin(`get-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'get');
    const created = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'get'));

    const response = await request(app.getHttpServer())
      .get(`/api/v1/vehicle?id=${created.body.vehicle.id}`)
      .set('Authorization', `Bearer ${admin.access_token}`);

    expect(response.status).toBe(200);
    expect(response.body.vehicle.id).toBe(created.body.vehicle.id);
  });

  it('lists vehicles scoped to the tenant, filtered by search and customer_id', async () => {
    const admin = await signupAdmin(`list-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'list');
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ ...vehiclePayload(customerId, 'list'), model: 'Palio Findable' });

    const bySearch = await request(app.getHttpServer())
      .post('/api/v1/vehicles/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10, search: 'Findable' });
    expect(bySearch.status).toBe(200);
    expect(bySearch.body.total).toBeGreaterThanOrEqual(1);

    const byCustomer = await request(app.getHttpServer())
      .post('/api/v1/vehicles/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10, customer_id: customerId });
    expect(byCustomer.body.items.every((item: { customer_id: string }) => item.customer_id === customerId)).toBe(true);
  });

  it('matches a vehicle by the owning customer name, even when no vehicle field matches', async () => {
    const admin = await signupAdmin(`searchname-${Date.now()}`);
    const customerId = await createCustomerWithNameAndDocument(admin.access_token, 'Zeferino Alcatrãozinho da Silva', generateValidCpf());
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'searchname'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10, search: 'Alcatrãozinho', match_owner: true });

    expect(response.status).toBe(200);
    expect(response.body.items.some((item: { customer_id: string }) => item.customer_id === customerId)).toBe(true);
  });

  it('does NOT match by owner name/document when match_owner is not sent (opt-in, default false)', async () => {
    const admin = await signupAdmin(`searchnamegate-${Date.now()}`);
    const customerId = await createCustomerWithNameAndDocument(admin.access_token, 'Zeferino Alcatrãozinho da Silva', generateValidCpf());
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'searchnamegate'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10, search: 'Alcatrãozinho' });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
  });

  it('matches a vehicle by the owning customer document (CPF), even when no vehicle field matches', async () => {
    const admin = await signupAdmin(`searchdoc-${Date.now()}`);
    const document = generateValidCpf();
    const customerId = await createCustomerWithNameAndDocument(admin.access_token, 'Cliente Documento', document);
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'searchdoc'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10, search: document, match_owner: true });

    expect(response.status).toBe(200);
    expect(response.body.items.some((item: { customer_id: string }) => item.customer_id === customerId)).toBe(true);
  });

  it('returns no results when the search matches neither vehicle fields nor any customer', async () => {
    const admin = await signupAdmin(`searchnone-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'searchnone');
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'searchnone'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10, search: 'termo-que-nao-bate-em-nada-xyz', match_owner: true });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
  });

  it('search by customer name does not leak vehicles from another tenant', async () => {
    const adminA = await signupAdmin(`searchisoA-${Date.now()}`);
    const adminB = await signupAdmin(`searchisoB-${Date.now()}`);
    const sharedName = `Cliente Compartilhado ${Date.now()}`;
    const customerA = await createCustomerWithNameAndDocument(adminA.access_token, sharedName, generateValidCpf());
    await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminA.access_token}`)
      .send(vehiclePayload(customerA, 'searchisoA'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles/list')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ offset: 0, limit: 10, search: sharedName, match_owner: true });

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
  });

  it('soft deletes a vehicle', async () => {
    const admin = await signupAdmin(`delete-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'delete');
    const created = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'delete'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/vehicles/delete')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.vehicle.id });
    expect(response.status).toBe(200);

    const getAfterDelete = await request(app.getHttpServer())
      .get(`/api/v1/vehicle?id=${created.body.vehicle.id}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it('allows recreating a vehicle with the same plate after soft delete', async () => {
    const admin = await signupAdmin(`recreate-${Date.now()}`);
    const customerId = await createCustomer(admin.access_token, 'recreate');
    const payload = vehiclePayload(customerId, 'recreate');

    const created = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(payload);
    await request(app.getHttpServer())
      .post('/api/v1/vehicles/delete')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.vehicle.id });

    const recreated = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(payload);

    expect(recreated.status).toBe(201);
  });

  it('MECHANIC is blocked from create/update/delete but allowed to get/list', async () => {
    const suffix = `mechanic-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const customerId = await createCustomer(admin.access_token, suffix);
    const mechanicToken = await inviteMechanic(admin.access_token, suffix);

    const created = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(vehiclePayload(customerId, 'mechanic-read'));

    const createAttempt = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send(vehiclePayload(customerId, 'mechanic-create'));
    expect(createAttempt.status).toBe(403);

    const updateAttempt = await request(app.getHttpServer())
      .post('/api/v1/vehicles/update')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ id: created.body.vehicle.id, mileage: 1000 });
    expect(updateAttempt.status).toBe(403);

    const deleteAttempt = await request(app.getHttpServer())
      .post('/api/v1/vehicles/delete')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ id: created.body.vehicle.id });
    expect(deleteAttempt.status).toBe(403);

    const getAttempt = await request(app.getHttpServer())
      .get(`/api/v1/vehicle?id=${created.body.vehicle.id}`)
      .set('Authorization', `Bearer ${mechanicToken}`);
    expect(getAttempt.status).toBe(200);

    const listAttempt = await request(app.getHttpServer())
      .post('/api/v1/vehicles/list')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ offset: 0, limit: 10 });
    expect(listAttempt.status).toBe(200);
  });

  it('tenant isolation: a vehicle from tenant A never appears for tenant B', async () => {
    const adminA = await signupAdmin(`isoA-${Date.now()}`);
    const adminB = await signupAdmin(`isoB-${Date.now()}`);
    const customerA = await createCustomer(adminA.access_token, 'isoA');

    const created = await request(app.getHttpServer())
      .post('/api/v1/vehicles')
      .set('Authorization', `Bearer ${adminA.access_token}`)
      .send(vehiclePayload(customerA, 'iso'));

    const getFromB = await request(app.getHttpServer())
      .get(`/api/v1/vehicle?id=${created.body.vehicle.id}`)
      .set('Authorization', `Bearer ${adminB.access_token}`);
    expect(getFromB.status).toBe(404);

    const updateFromB = await request(app.getHttpServer())
      .post('/api/v1/vehicles/update')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ id: created.body.vehicle.id, mileage: 1 });
    expect(updateFromB.status).toBe(404);

    const deleteFromB = await request(app.getHttpServer())
      .post('/api/v1/vehicles/delete')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ id: created.body.vehicle.id });
    expect(deleteFromB.status).toBe(404);

    const listFromB = await request(app.getHttpServer())
      .post('/api/v1/vehicles/list')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ offset: 0, limit: 100 });
    expect(listFromB.body.items.some((item: { id: string }) => item.id === created.body.vehicle.id)).toBe(false);
  });
});
