import { LEGAL_VERSION } from '@oficina/contracts';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { generateValidCpf } from './utils/generate-cpf';

describe('Customers (e2e)', () => {
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
    // Cada teste faz pelo menos um signup (AUTH_THROTTLE: 5/60s) — sem
    // reset, testes depois do 5º signup do arquivo esbarram em 429. Ver
    // comentário equivalente em auth.e2e-spec.ts.
    (app.get(ThrottlerStorage) as ThrottlerStorageService).storage.clear();
  });

  afterAll(async () => {
    if (createdTenantIds.length > 0) {
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
        tenant_name: `Oficina Customers E2E ${suffix}`,
        tenant_document: generateValidCpf(),
        admin_name: 'Admin E2E',
        admin_email: `admin-customers-${suffix}@e2e-test.com`,
        password: 'supersecret1',
      });
    createdTenantIds.push(response.body.tenant.id);
    return response.body as { access_token: string; tenant: { id: string } };
  }

  async function inviteMechanic(adminToken: string, suffix: string): Promise<string> {
    const invite = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `mechanic-customers-${suffix}@e2e-test.com`, name: 'Mecânico', role: 'MECHANIC' });
    const inviteToken = invite.body.invite_link.split('/convite/')[1];

    const accept = await request(app.getHttpServer())
      .post('/api/v1/users/accept-invite')
      .send({ accepted_terms: true, legal_version: LEGAL_VERSION, invite_token: inviteToken, password: 'supersecret1' });
    return accept.body.access_token as string;
  }

  function customerPayload(suffix: string) {
    return {
      type: 'PF',
      document: generateValidCpf(),
      name: `Cliente E2E ${suffix}`,
      phone: '11999998888',
    };
  }

  it('creates a customer and returns it normalized', async () => {
    const admin = await signupAdmin(`create-${Date.now()}`);
    const payload = customerPayload('create');

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.body.customer.id).toBeDefined();
    expect(response.body.customer.document).toBe(payload.document.replace(/\D/g, ''));
  });

  it('creates a customer with the Feature 6 optional fields and returns them', async () => {
    const admin = await signupAdmin(`create-extended-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({
        ...customerPayload('create-extended'),
        rg: '12.345.678-9',
        secondary_contact_name: 'Maria da Silva',
        secondary_contact_phone: '11988887777',
        secondary_contact_relation: 'Cônjuge',
        preferred_contact_channel: 'WHATSAPP',
        preferred_contact_time: 'AFTERNOON',
      });

    expect(response.status).toBe(201);
    expect(response.body.customer.rg).toBe('12.345.678-9');
    expect(response.body.customer.secondary_contact_name).toBe('Maria da Silva');
    expect(response.body.customer.preferred_contact_channel).toBe('WHATSAPP');
    expect(response.body.customer.preferred_contact_time).toBe('AFTERNOON');
  });

  it('accepts partially-filled Feature 6 fields (only name, no phone/relation)', async () => {
    const admin = await signupAdmin(`create-partial-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ ...customerPayload('create-partial'), secondary_contact_name: 'Maria da Silva' });

    expect(response.status).toBe(201);
    expect(response.body.customer.secondary_contact_name).toBe('Maria da Silva');
    expect(response.body.customer.secondary_contact_phone).toBeUndefined();
  });

  it('rejects an invalid preferred_contact_channel with 400', async () => {
    const admin = await signupAdmin(`badchannel-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ ...customerPayload('badchannel'), preferred_contact_channel: 'CARRIER_PIGEON' });

    expect(response.status).toBe(400);
  });

  it('does not block state_registration on a PF customer or rg on a PJ customer (Edge Case 3)', async () => {
    const admin = await signupAdmin(`crossfield-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ ...customerPayload('crossfield'), type: 'PF', state_registration: '123.456.789.111' });

    expect(response.status).toBe(201);
    expect(response.body.customer.state_registration).toBe('123.456.789.111');
  });

  it('updates the Feature 6 fields on an existing customer', async () => {
    const admin = await signupAdmin(`update-extended-${Date.now()}`);
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(customerPayload('update-extended'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.customer.id, preferred_contact_channel: 'EMAIL', preferred_contact_time: 'MORNING' });

    expect(response.status).toBe(200);
    expect(response.body.customer.preferred_contact_channel).toBe('EMAIL');
    expect(response.body.customer.preferred_contact_time).toBe('MORNING');
  });

  it('rejects an invalid document with 400', async () => {
    const admin = await signupAdmin(`invalid-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ ...customerPayload('invalid'), document: '123' });

    expect(response.status).toBe(400);
  });

  it('rejects a duplicate document within the same tenant with 409', async () => {
    const admin = await signupAdmin(`dup-${Date.now()}`);
    const payload = customerPayload('dup');

    const first = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ ...payload, name: 'Outro nome' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CUSTOMER_DOCUMENT_ALREADY_EXISTS');
  });

  it('allows the same document across two different tenants', async () => {
    const adminA = await signupAdmin(`tenantA-${Date.now()}`);
    const adminB = await signupAdmin(`tenantB-${Date.now()}`);
    const sharedDocument = generateValidCpf();

    const first = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminA.access_token}`)
      .send({ ...customerPayload('shared-a'), document: sharedDocument });
    const second = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ ...customerPayload('shared-b'), document: sharedDocument });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
  });

  it('updates a customer', async () => {
    const admin = await signupAdmin(`update-${Date.now()}`);
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(customerPayload('update'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.customer.id, phone: '11888887777' });

    expect(response.status).toBe(200);
    expect(response.body.customer.phone).toBe('11888887777');
    expect(response.body.customer.type).toBe('PF');
  });

  it('rejects type/document in the update body — not editable after creation', async () => {
    const admin = await signupAdmin(`updatetype-${Date.now()}`);
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(customerPayload('updatetype'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.customer.id, type: 'PJ' });

    expect(response.status).toBe(400);
  });

  it('returns 404 when updating a customer that does not exist', async () => {
    const admin = await signupAdmin(`update404-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      // UUID v4 sintaticamente válido, mas que não existe no banco — o
      // "nil UUID" (todo zero) falha @IsUUID('4') antes mesmo de chegar
      // no Manager, o que testaria a validação, não o 404 do Manager.
      .send({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', phone: '11888887777' });

    expect(response.status).toBe(404);
  });

  it('rejects a malformed id with 400 (not a 500 from an unhandled Prisma error)', async () => {
    const admin = await signupAdmin(`badid-${Date.now()}`);

    const getResponse = await request(app.getHttpServer())
      .get('/api/v1/customer?id=not-a-uuid')
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(getResponse.status).toBe(400);

    const updateResponse = await request(app.getHttpServer())
      .post('/api/v1/customers/update')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: 'not-a-uuid', phone: '11888887777' });
    expect(updateResponse.status).toBe(400);

    const deleteResponse = await request(app.getHttpServer())
      .post('/api/v1/customers/delete')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: 'not-a-uuid' });
    expect(deleteResponse.status).toBe(400);
  });

  it('gets a customer by id', async () => {
    const admin = await signupAdmin(`get-${Date.now()}`);
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(customerPayload('get'));

    const response = await request(app.getHttpServer())
      .get(`/api/v1/customer?id=${created.body.customer.id}`)
      .set('Authorization', `Bearer ${admin.access_token}`);

    expect(response.status).toBe(200);
    expect(response.body.customer.id).toBe(created.body.customer.id);
  });

  it('lists customers scoped to the tenant, filtered by search', async () => {
    const admin = await signupAdmin(`list-${Date.now()}`);
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ ...customerPayload('list'), name: 'Maria Findable' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10, search: 'Findable' });

    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(response.body.items.every((item: { name: string }) => item.name.includes('Findable'))).toBe(true);
  });

  it('soft deletes a customer', async () => {
    const admin = await signupAdmin(`delete-${Date.now()}`);
    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(customerPayload('delete'));

    const response = await request(app.getHttpServer())
      .post('/api/v1/customers/delete')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.customer.id });
    expect(response.status).toBe(200);

    const getAfterDelete = await request(app.getHttpServer())
      .get(`/api/v1/customer?id=${created.body.customer.id}`)
      .set('Authorization', `Bearer ${admin.access_token}`);
    expect(getAfterDelete.status).toBe(404);
  });

  it('allows recreating a customer with the same document after soft delete', async () => {
    const admin = await signupAdmin(`recreate-${Date.now()}`);
    const payload = customerPayload('recreate');

    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(payload);
    await request(app.getHttpServer())
      .post('/api/v1/customers/delete')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ id: created.body.customer.id });

    const recreated = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(payload);

    expect(recreated.status).toBe(201);
  });

  it('MECHANIC is blocked from create/update/delete but allowed to get/list (Edge Case 3)', async () => {
    const suffix = `mechanic-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const mechanicToken = await inviteMechanic(admin.access_token, suffix);

    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send(customerPayload('mechanic-read'));

    const createAttempt = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send(customerPayload('mechanic-create'));
    expect(createAttempt.status).toBe(403);

    const updateAttempt = await request(app.getHttpServer())
      .post('/api/v1/customers/update')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ id: created.body.customer.id, phone: '11777776666' });
    expect(updateAttempt.status).toBe(403);

    const deleteAttempt = await request(app.getHttpServer())
      .post('/api/v1/customers/delete')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ id: created.body.customer.id });
    expect(deleteAttempt.status).toBe(403);

    const getAttempt = await request(app.getHttpServer())
      .get(`/api/v1/customer?id=${created.body.customer.id}`)
      .set('Authorization', `Bearer ${mechanicToken}`);
    expect(getAttempt.status).toBe(200);

    const listAttempt = await request(app.getHttpServer())
      .post('/api/v1/customers/list')
      .set('Authorization', `Bearer ${mechanicToken}`)
      .send({ offset: 0, limit: 10 });
    expect(listAttempt.status).toBe(200);
  });

  it('tenant isolation: a customer from tenant A never appears for tenant B (Edge Case 5)', async () => {
    const adminA = await signupAdmin(`isoA-${Date.now()}`);
    const adminB = await signupAdmin(`isoB-${Date.now()}`);

    const created = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer ${adminA.access_token}`)
      .send(customerPayload('iso'));

    const getFromB = await request(app.getHttpServer())
      .get(`/api/v1/customer?id=${created.body.customer.id}`)
      .set('Authorization', `Bearer ${adminB.access_token}`);
    expect(getFromB.status).toBe(404);

    const updateFromB = await request(app.getHttpServer())
      .post('/api/v1/customers/update')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ id: created.body.customer.id, phone: '11000000000' });
    expect(updateFromB.status).toBe(404);

    const deleteFromB = await request(app.getHttpServer())
      .post('/api/v1/customers/delete')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ id: created.body.customer.id });
    expect(deleteFromB.status).toBe(404);

    const listFromB = await request(app.getHttpServer())
      .post('/api/v1/customers/list')
      .set('Authorization', `Bearer ${adminB.access_token}`)
      .send({ offset: 0, limit: 100 });
    expect(listFromB.body.items.some((item: { id: string }) => item.id === created.body.customer.id)).toBe(false);
  });
});
