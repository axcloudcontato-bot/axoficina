import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { LEGAL_VERSION } from '@oficina/contracts';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { SaasAdminService } from '../src/modules/subscriptions/saas-admin.service';
import { generateValidCpf } from './utils/generate-cpf';
import { uniquePlate } from './utils/unique-plate';

type Signup = { access_token: string; refresh_token: string; user: { id: string }; tenant: { id: string; name: string }; email: string };

describe('Closing and erasing a workshop (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let manager: Signup;
  let workshop: Signup;
  const password = 'closure-qa-password';
  const admins = { isAdmin: jest.fn((id: string) => id === manager?.user.id) };
  const prefix = `Closure QA ${Date.now()}`;
  const api = () => request(app.getHttpServer());
  const as = (account: Signup) => ({ Authorization: `Bearer ${account.access_token}` });

  async function signup(suffix: string): Promise<Signup> {
    const email = `closure-${suffix}-${Date.now()}@example.invalid`;
    const response = await api().post('/api/v1/auth/signup').send({
      accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: `${prefix} ${suffix}`,
      tenant_document: generateValidCpf(), admin_name: 'Closure QA', admin_email: email, password,
    });
    expect(response.status).toBe(201);
    return { ...response.body, email };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SaasAdminService).useValue(admins).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    manager = await signup('manager');
    workshop = await signup('workshop');
    // The workshop has some data of its own, so erasing it has something to erase.
    const customer = await api().post('/api/v1/customers').set(as(workshop)).send({ type: 'PF', document: generateValidCpf(), name: 'Cliente de encerramento', phone: '11999998888' });
    expect(customer.status).toBe(201);
    const vehicle = await api().post('/api/v1/vehicles').set(as(workshop)).send({ customer_id: customer.body.customer.id, brand: 'Fiat', model: 'Uno', plate: uniquePlate() });
    expect(vehicle.status).toBe(201);
  });

  beforeEach(() => { (app.get(ThrottlerStorage) as ThrottlerStorageService).storage.clear(); });
  afterAll(async () => {
    if (prisma && manager) {
      await prisma.unscoped.refreshToken.deleteMany({ where: { userId: manager.user.id } });
      await prisma.unscoped.auditLog.deleteMany({ where: { tenantId: manager.tenant.id } });
      await prisma.unscoped.user.deleteMany({ where: { tenantId: manager.tenant.id } });
      await prisma.unscoped.tenant.deleteMany({ where: { id: manager.tenant.id } });
    }
    if (prisma && workshop) await prisma.unscoped.accountClosure.deleteMany({ where: { tenantId: workshop.tenant.id } });
    await app?.close();
  });

  it('asks for the password and the workshop name before the owner closes the account', async () => {
    const wrongPassword = await api().post('/api/v1/account/close').set(as(workshop)).send({ password: 'senha-errada-123', confirm_name: workshop.tenant.name });
    expect(wrongPassword.status).toBe(403);
    const wrongName = await api().post('/api/v1/account/close').set(as(workshop)).send({ password, confirm_name: 'Outra oficina' });
    expect(wrongName.status).toBe(400);
    expect((await api().post('/api/v1/customers/list').set(as(workshop)).send({ offset: 0, limit: 10 })).status).toBe(200);
  });

  it('closes at once for the owner: no access, no new session, 30 days to be restored', async () => {
    const closed = await api().post('/api/v1/account/close').set(as(workshop)).send({ password, confirm_name: ` ${workshop.tenant.name.toLowerCase()} ` });
    expect(closed.status).toBe(200);
    const days = (new Date(closed.body.purge_after).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);

    expect((await api().post('/api/v1/customers/list').set(as(workshop)).send({ offset: 0, limit: 10 })).status).toBe(401);
    const login = await api().post('/api/v1/auth/login').send({ email: workshop.email, password });
    expect(login.status).toBe(403);
    expect(login.body.error.code).toBe('ACCOUNT_CLOSED');
    expect((await api().post('/api/v1/auth/refresh').send({ refresh_token: workshop.refresh_token })).status).toBe(401);
  });

  it('shows the closed workshop to the manager, who can restore it', async () => {
    const closedList = await api().get('/api/v1/admin/subscriptions').query({ scope: 'closed', search: prefix }).set(as(manager));
    expect(closedList.status).toBe(200);
    const row = closedList.body.items.find((item: { id: string }) => item.id === workshop.tenant.id);
    expect(row).toMatchObject({ closed_by: 'owner' });
    expect(row.closed_at).toBeTruthy();
    expect(row.purge_after).toBeTruthy();
    const activeList = await api().get('/api/v1/admin/subscriptions').query({ search: prefix }).set(as(manager));
    expect(activeList.body.items.some((item: { id: string }) => item.id === workshop.tenant.id)).toBe(false);

    expect((await api().post(`/api/v1/admin/subscriptions/${workshop.tenant.id}/restore`).set(as(workshop))).status).toBe(401);
    const restored = await api().post(`/api/v1/admin/subscriptions/${workshop.tenant.id}/restore`).set(as(manager));
    expect(restored.status).toBe(200);
    const login = await api().post('/api/v1/auth/login').send({ email: workshop.email, password });
    expect(login.status).toBe(200);
    workshop = { ...workshop, access_token: login.body.access_token, refresh_token: login.body.refresh_token };
    expect((await api().post('/api/v1/customers/list').set(as(workshop)).send({ offset: 0, limit: 10 })).status).toBe(200);
  });

  it('lets only the manager close and erase, and erases only after a close and the typed name', async () => {
    expect((await api().post(`/api/v1/admin/subscriptions/${workshop.tenant.id}/close`).set(as(workshop)).send({})).status).toBe(403);
    expect((await api().post(`/api/v1/admin/subscriptions/${workshop.tenant.id}/purge`).set(as(manager)).send({ confirm_name: workshop.tenant.name })).status).toBe(404);

    expect((await api().post(`/api/v1/admin/subscriptions/${workshop.tenant.id}/close`).set(as(manager)).send({ reason: 'Pedido por e-mail' })).status).toBe(200);
    const row = (await api().get('/api/v1/admin/subscriptions').query({ scope: 'closed', search: prefix }).set(as(manager))).body.items.find((item: { id: string }) => item.id === workshop.tenant.id);
    expect(row).toMatchObject({ closed_by: 'saas_admin', closure_reason: 'Pedido por e-mail' });

    expect((await api().post(`/api/v1/admin/subscriptions/${workshop.tenant.id}/purge`).set(as(manager)).send({ confirm_name: 'Outro nome' })).status).toBe(400);
    expect(await prisma.unscoped.customer.count({ where: { tenantId: workshop.tenant.id } })).toBe(1);

    const purged = await api().post(`/api/v1/admin/subscriptions/${workshop.tenant.id}/purge`).set(as(manager)).send({ confirm_name: workshop.tenant.name });
    expect(purged.status).toBe(200);
    const where = { tenantId: workshop.tenant.id };
    expect(await prisma.unscoped.tenant.count({ where: { id: workshop.tenant.id } })).toBe(0);
    expect(await prisma.unscoped.user.count({ where })).toBe(0);
    expect(await prisma.unscoped.customer.count({ where })).toBe(0);
    expect(await prisma.unscoped.vehicle.count({ where })).toBe(0);
    expect(await prisma.unscoped.auditLog.count({ where })).toBe(0);
    expect(await prisma.unscoped.accountClosure.findUnique({ where })).toMatchObject({ closedBy: 'saas_admin' });
  });

  it('leaves the other workshops alone', async () => {
    expect(await prisma.unscoped.user.count({ where: { tenantId: manager.tenant.id } })).toBe(1);
    expect((await api().post('/api/v1/customers/list').set(as(manager)).send({ offset: 0, limit: 10 })).status).toBe(200);
  });
});
