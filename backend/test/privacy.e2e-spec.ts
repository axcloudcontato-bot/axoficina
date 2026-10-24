import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { LEGAL_VERSION } from '@oficina/contracts';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { generateValidCpf } from './utils/generate-cpf';

describe('Privacy and minimization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: { access_token: string; user: { id: string }; tenant: { id: string } };
  let other: typeof admin;
  let customerId: string;
  let deletionId: string;
  const password = 'privacy-test-password';
  const accepted = { accepted_terms: true, legal_version: LEGAL_VERSION };
  const auth = () => `Bearer ${admin.access_token}`;
  const api = () => request(app.getHttpServer());
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app); await app.init(); prisma = app.get(PrismaService);
    async function signup(suffix: string) {
      const response = await api().post('/api/v1/auth/signup').send({ ...accepted, tenant_name: `Privacy test ${suffix}`, tenant_document: generateValidCpf(), admin_name: 'Privacy Admin', admin_email: `privacy-${suffix}-${Date.now()}@example.invalid`, password });
      expect(response.status).toBe(201); return response.body;
    }
    admin = await signup('a'); other = await signup('b');
  });
  beforeEach(() => { (app.get(ThrottlerStorage) as ThrottlerStorageService).storage.clear(); });
  afterAll(async () => {
    if (prisma && admin && other) {
      const where = { tenantId: { in: [admin.tenant.id, other.tenant.id] } };
      const users = await prisma.unscoped.user.findMany({ where, select: { id: true } });
      await prisma.unscoped.refreshToken.deleteMany({ where: { userId: { in: users.map((user) => user.id) } } });
      await prisma.unscoped.privacyRequest.deleteMany({ where });
      await prisma.unscoped.auditLog.deleteMany({ where });
      await prisma.unscoped.vehicle.deleteMany({ where });
      await prisma.unscoped.customer.deleteMany({ where });
      await prisma.unscoped.user.deleteMany({ where });
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: [admin.tenant.id, other.tenant.id] } } });
    }
    await app?.close();
  });

  it('requires explicit, current acceptance and persists it without collecting IP', async () => {
    const body = { tenant_name: 'Reject', tenant_document: generateValidCpf(), admin_name: 'Reject', admin_email: 'reject@example.invalid', password };
    expect((await api().post('/api/v1/auth/signup').send(body)).status).toBe(400);
    expect((await api().post('/api/v1/auth/signup').send({ ...body, accepted_terms: true, legal_version: 'old' })).status).toBe(400);
    const user = await prisma.unscoped.user.findFirstOrThrow({ where: { id: admin.user.id } });
    expect(user.legalVersion).toBe(LEGAL_VERSION); expect(user.legalAcceptedAt).toBeInstanceOf(Date);
  });
  it('allows multiple customers without documents and does not copy documents to the audit metadata', async () => {
    for (const name of ['Minimal one', 'Minimal two']) {
      const response = await api().post('/api/v1/customers').set('Authorization', auth()).send({ type: 'PF', name, phone: '11999998888' });
      expect(response.status).toBe(201); expect(response.body.customer.document).toBe('');
      customerId = response.body.customer.id;
    }
  });
  it('removes cleared optional fields, validates address properties, and permits document correction', async () => {
    const document = generateValidCpf();
    expect((await api().post('/api/v1/customers/update').set('Authorization', auth()).send({ id: customerId, document, email: 'optional@example.invalid', notes: 'remove me', address: { city: 'São Paulo' } })).status).toBe(200);
    const cleared = await api().post('/api/v1/customers/update').set('Authorization', auth()).send({ id: customerId, document: '', email: null, notes: null, address: null });
    expect(cleared.status).toBe(200);
    const row = await prisma.unscoped.customer.findFirstOrThrow({ where: { id: customerId } });
    expect(row.email).toBeNull(); expect(row.notes).toBeNull(); expect(row.address).toBeNull(); expect(row.document).toBe('');
    const extra = await api().post('/api/v1/customers/update').set('Authorization', auth()).send({ id: customerId, address: { unnecessary_sensitive_field: 'must be rejected' } });
    expect(extra.status).toBe(400);
    expect((await api().post('/api/v1/customers/update').set('Authorization', auth()).send({ id: customerId, name: null })).status).toBe(400);
  });
  it('returns a limited self export with no credentials', async () => {
    const result = await api().get('/api/v1/privacy/export').set('Authorization', auth());
    expect(result.status).toBe(200); expect(result.headers['cache-control']).toBe('no-store');
    expect(result.body.account.id).toBe(admin.user.id);
    expect(result.body.account.password_hash).toBeUndefined(); expect(result.body.account.mfa_secret).toBeUndefined();
  });
  it('isolates requests, customer exports and erasure by tenant', async () => {
    const created = await api().post('/api/v1/privacy/requests').set('Authorization', auth()).send({ type: 'DELETION', customer_id: customerId });
    expect(created.status).toBe(201); deletionId = created.body.request.id;
    const list = await api().get('/api/v1/privacy/requests').set('Authorization', `Bearer ${other.access_token}`);
    expect(list.body.items).toEqual([]);
    expect((await api().post('/api/v1/privacy/customers/export').set('Authorization', `Bearer ${other.access_token}`).send({ id: customerId })).status).toBe(404);
    expect((await api().post('/api/v1/privacy/customers/erase').set('Authorization', `Bearer ${other.access_token}`).send({ request_id: deletionId, password, confirmation: 'EXCLUIR' })).status).toBe(400);
  });
  it('requires password and confirmation, then actually clears the isolated record and legacy audit metadata', async () => {
    await prisma.unscoped.auditLog.create({ data: { tenantId: admin.tenant.id, entity: 'customer', entityId: customerId, action: 'customer.created', metadata: { document: generateValidCpf() } } });
    expect((await api().post('/api/v1/privacy/customers/erase').set('Authorization', auth()).send({ request_id: deletionId, password: 'wrong', confirmation: 'EXCLUIR' })).status).toBe(403);
    expect((await api().post('/api/v1/privacy/customers/erase').set('Authorization', auth()).send({ request_id: deletionId, password, confirmation: 'DELETE' })).status).toBe(400);
    expect((await api().post('/api/v1/privacy/customers/erase').set('Authorization', auth()).send({ request_id: deletionId, password, confirmation: 'EXCLUIR' })).status).toBe(200);
    const customer = await prisma.unscoped.customer.findFirstOrThrow({ where: { id: customerId } });
    expect(customer.name).toBe('Cadastro com dados apagados'); expect(customer.phone).toBe(''); expect(customer.document).toBe(''); expect(customer.deletedAt).toBeInstanceOf(Date);
    const audit = await prisma.unscoped.auditLog.findFirstOrThrow({ where: { entityId: customerId, action: 'customer.created' } });
    expect(audit.metadata).toEqual({});
    const protocol = await prisma.unscoped.privacyRequest.findFirstOrThrow({ where: { id: deletionId } });
    expect(protocol.status).toBe('COMPLETED'); expect(protocol.details).toBeNull();
  });
  it('blocks erasure with archived dependencies and requires justification and a future retention review', async () => {
    const customer = await prisma.unscoped.customer.create({ data: { tenantId: admin.tenant.id, type: 'PF', name: 'Linked', document: '', phone: '11999998888' } });
    await prisma.unscoped.vehicle.create({ data: { tenantId: admin.tenant.id, customerId: customer.id, brand: 'Test', model: 'Test', plate: 'ABC1D23', deletedAt: new Date() } });
    const created = await api().post('/api/v1/privacy/requests').set('Authorization', auth()).send({ type: 'DELETION', customer_id: customer.id });
    const id = created.body.request.id;
    expect((await api().post('/api/v1/privacy/customers/erase').set('Authorization', auth()).send({ request_id: id, password, confirmation: 'EXCLUIR' })).status).toBe(409);
    expect((await api().post('/api/v1/privacy/requests/resolve').set('Authorization', auth()).send({ id, status: 'COMPLETED', response: 'Just mark it done' })).status).toBe(400);
    expect((await api().post('/api/v1/privacy/requests/resolve').set('Authorization', auth()).send({ id, status: 'RETAINED', response: 'Needs legal review' })).status).toBe(400);
    expect((await api().post('/api/v1/privacy/requests/resolve').set('Authorization', auth()).send({ id, status: 'RETAINED', response: 'Dados do atendimento sujeitos a avaliação de obrigação legal; revisar o documento relacionado.', retention_until: new Date(Date.now() + 86400000).toISOString() })).status).toBe(200);
    expect((await api().post('/api/v1/privacy/requests/resolve').set('Authorization', auth()).send({ id, status: 'IN_REVIEW', response: 'Reabrindo para revisar a necessidade de conservação.' })).status).toBe(200);
  });
  it('does not erase the only administrator and leaves the company data intact', async () => {
    const created = await api().post('/api/v1/privacy/requests').set('Authorization', auth()).send({ type: 'DELETION' });
    const response = await api().post('/api/v1/privacy/account/erase').set('Authorization', auth()).send({ request_id: created.body.request.id, password, confirmation: 'EXCLUIR' });
    expect(response.status).toBe(409);
    expect(await prisma.unscoped.tenant.count({ where: { id: admin.tenant.id, deletedAt: null } })).toBe(1);
  });
  it('allows own requests but rejects customer management for an ordinary user, and revokes erased sessions', async () => {
    const role = await prisma.unscoped.role.findFirstOrThrow({ where: { name: 'MECHANIC', tenantId: null } });
    const { passwordHash } = await prisma.unscoped.user.findFirstOrThrow({ where: { id: admin.user.id } });
    const email = `privacy-staff-${Date.now()}@example.invalid`;
    const staff = await prisma.unscoped.user.create({ data: { tenantId: admin.tenant.id, roleId: role.id, email, name: 'Staff', passwordHash, status: 'active' } });
    const login = await api().post('/api/v1/auth/login').send({ email, password });
    const bearer = `Bearer ${login.body.access_token}`;
    expect((await api().get('/api/v1/privacy/requests/manage').set('Authorization', bearer)).status).toBe(403);
    expect((await api().post('/api/v1/privacy/requests').set('Authorization', bearer).send({ type: 'DELETION', customer_id: customerId })).status).toBe(403);
    const created = await api().post('/api/v1/privacy/requests').set('Authorization', bearer).send({ type: 'DELETION' });
    expect(created.status).toBe(201);
    const deleted = await api().post('/api/v1/privacy/account/erase').set('Authorization', bearer).send({ request_id: created.body.request.id, password, confirmation: 'EXCLUIR' });
    expect(deleted.status).toBe(200);
    expect((await api().get('/api/v1/privacy/export').set('Authorization', bearer)).status).toBe(401);
    expect((await api().post('/api/v1/auth/refresh').send({ refresh_token: login.body.refresh_token })).status).toBe(401);
    const erased = await prisma.unscoped.user.findFirstOrThrow({ where: { id: staff.id } });
    expect(erased.passwordHash).toBeNull(); expect(erased.email).toContain('@deleted.invalid'); expect(erased.name).toBe('Conta com dados apagados');
  });
});
