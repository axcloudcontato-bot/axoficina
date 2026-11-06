import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { LEGAL_VERSION } from '@oficina/contracts';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { EntitlementsService } from '../src/shared/plan/entitlements.service';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { generateValidCpf } from './utils/generate-cpf';
import { uniquePlate } from './utils/unique-plate';

// Rules that only hold when the guards, the managers and the database work together.
describe('Who sees money, the financial profile and the view-only account (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tenants: string[] = [];
  const api = () => request(app.getHttpServer());
  const post = (path: string, token: string, body: Record<string, unknown> = {}) => api().post(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`).send(body);
  const get = (path: string, token: string) => api().get(`/api/v1/${path}`).set('Authorization', `Bearer ${token}`);

  async function signup(suffix: string) {
    const response = await api().post('/api/v1/auth/signup').send({
      accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: `Regras ${suffix}`, tenant_document: generateValidCpf(),
      admin_name: 'Dona', admin_email: `regras-${suffix}-${Date.now()}@example.invalid`, password: 'regras-qa-password',
    });
    expect(response.status).toBe(201);
    tenants.push(response.body.tenant.id);
    await prisma.unscoped.tenant.update({ where: { id: response.body.tenant.id }, data: { photoRequireEntry: false, photoRequireExit: false, photoRequireItems: false } });
    return response.body as { access_token: string; user: { id: string }; tenant: { id: string } };
  }

  async function invite(adminToken: string, role: string, suffix: string) {
    const invited = await post('users/invite', adminToken, { email: `${role.toLowerCase()}-${suffix}-${Date.now()}@example.invalid`, name: `Pessoa ${role}`, role });
    expect(invited.status).toBe(201);
    const token = String(invited.body.invite_link).split('/convite/')[1];
    const accepted = await api().post('/api/v1/users/accept-invite').send({ accepted_terms: true, legal_version: LEGAL_VERSION, invite_token: token, password: 'regras-qa-password' });
    expect(accepted.status).toBe(200);
    return accepted.body as { access_token: string; refresh_token: string };
  }

  async function orderWithItem(token: string, suffix: string) {
    const customer = await post('customers', token, { type: 'PF', name: `Cliente ${suffix}`, phone: '11999998888', document: generateValidCpf() });
    expect(customer.status).toBe(201);
    const vehicle = await post('vehicles', token, { customer_id: customer.body.customer.id, brand: 'Fiat', model: 'Uno', plate: uniquePlate(), year: 2015 });
    expect(vehicle.status).toBe(201);
    const order = await post('service-orders', token, { vehicle_id: vehicle.body.vehicle.id });
    expect(order.status).toBe(201);
    const item = await post('service-orders/items', token, { service_order_id: order.body.service_order.id, type: 'LABOR', description: 'Troca de óleo', quantity: 1, unit_price_cents: 12000 });
    expect(item.status).toBe(201);
    return { id: order.body.service_order.id as string, customerId: customer.body.customer.id as string };
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => { (app.get(ThrottlerStorage) as ThrottlerStorageService).storage.clear(); });

  afterAll(async () => {
    for (const id of tenants) await prisma.unscoped.$executeRawUnsafe('DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE tenant_id = $1::uuid)', id);
    await app?.close();
  });

  it('a mechanic works the order without receiving any amount, on every route that returns it', async () => {
    const owner = await signup('mecanico');
    const mechanic = await invite(owner.access_token, 'MECHANIC', 'mecanico');
    const order = await orderWithItem(owner.access_token, 'mecanico');

    const seen = await get(`service-order?id=${order.id}`, owner.access_token);
    expect(seen.body.service_order.total_amount_cents).toBe(12000);

    const single = await get(`service-order?id=${order.id}`, mechanic.access_token);
    expect(single.status).toBe(200);
    expect(single.body.service_order).toMatchObject({ amounts_hidden: true, total_amount_cents: 0, outstanding_amount_cents: 0 });
    expect(single.body.service_order.items[0]).toMatchObject({ description: 'Troca de óleo', unit_price_cents: 0, line_total_cents: 0 });

    const list = await post('service-orders/list', mechanic.access_token, { offset: 0, limit: 10 });
    expect(list.status).toBe(200);
    expect(list.body.items[0]).toMatchObject({ amounts_hidden: true, total_amount_cents: 0 });

    const update = await post('service-orders/update', mechanic.access_token, { id: order.id, diagnosis: 'Óleo vencido' });
    expect(update.status).toBe(200);
    expect(update.body.service_order.total_amount_cents).toBe(0);

    const today = await get('dashboard/today', mechanic.access_token);
    expect(today.status).toBe(200);
    expect(JSON.stringify(today.body)).not.toContain('12000');
  });

  it('the financial profile is invited, signs in and reaches what its permissions promise, and nothing more', async () => {
    const owner = await signup('financeiro');
    const finance = await invite(owner.access_token, 'FINANCE', 'financeiro');
    const order = await orderWithItem(owner.access_token, 'financeiro');

    expect((await get('financial/categories', finance.access_token)).status).toBe(200);
    expect((await post('customers/list', finance.access_token, { offset: 0, limit: 10 })).status).toBe(200);
    expect((await get('dashboard/today', finance.access_token)).status).toBe(200);
    expect((await get('settings/branding', finance.access_token)).status).toBe(200);

    const seen = await get(`service-order?id=${order.id}`, finance.access_token);
    expect(seen.status).toBe(200);
    expect(seen.body.service_order.total_amount_cents).toBe(12000);

    expect((await post('service-orders/payment/configure', finance.access_token, { service_order_id: order.id, method: 'PIX', installments: 1, anticipated: true })).status).toBe(200);

    expect((await post('service-orders/update', finance.access_token, { id: order.id, diagnosis: 'x' })).status).toBe(403);
    expect((await post('customers', finance.access_token, { type: 'PF', name: 'Não pode', phone: '11999998888' })).status).toBe(403);
    expect((await post('users/invite', finance.access_token, { email: `x-${Date.now()}@example.invalid`, name: 'Não', role: 'MECHANIC' })).status).toBe(403);
  });

  it('reception and mechanics can assign a colleague without seeing the team list', async () => {
    const owner = await signup('equipe');
    const mechanic = await invite(owner.access_token, 'MECHANIC', 'equipe');
    const reception = await invite(owner.access_token, 'FRONT_DESK', 'equipe');
    for (const token of [mechanic.access_token, reception.access_token]) {
      const names = await get('users/team-members', token);
      expect(names.status).toBe(200);
      expect(names.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Pessoa MECHANIC' })]));
      expect(Object.keys(names.body.items[0]).sort()).toEqual(['id', 'name']);
      expect((await post('users/list', token, { offset: 0, limit: 10 })).status).toBe(403);
    }
  });

  it('whoever accepts an invite stays signed in past the first token', async () => {
    const owner = await signup('convite');
    const accepted = await invite(owner.access_token, 'FRONT_DESK', 'convite');
    const renewed = await api().post('/api/v1/auth/refresh').send({ refresh_token: accepted.refresh_token });
    expect(renewed.status).toBe(200);
    expect(renewed.body.access_token).toBeTruthy();
  });

  it('after a workshop personalizes a fixed profile, inviting to it keeps the team list working', async () => {
    const owner = await signup('perfil');
    const profiles = await get('access-profiles', owner.access_token);
    const mechanicProfile = profiles.body.items.find((profile: { name: string }) => profile.name === 'Mecânico');
    const updated = await post('access-profiles/update', owner.access_token, { id: mechanicProfile.id, name: 'Mecânico', permissions: ['dashboard.view', 'service_orders.view'] });
    expect(updated.status).toBe(200);
    const personalized = updated.body.profile.id as string;

    await post('users/invite', owner.access_token, { email: `novo-${Date.now()}@example.invalid`, name: 'Novo mecânico', role: 'MECHANIC' }).expect(201);
    const team = await post('users/list', owner.access_token, { offset: 0, limit: 50 });
    expect(team.status).toBe(200);
    expect(team.body.items.find((user: { name: string }) => user.name === 'Novo mecânico').profile_id).toBe(personalized);
  });

  it('a view-only account refuses every change, but keeps reading, paying and removing people', async () => {
    const owner = await signup('consulta');
    const colleague = await invite(owner.access_token, 'FRONT_DESK', 'consulta');
    const order = await orderWithItem(owner.access_token, 'consulta');
    const colleagueId = (await post('users/list', owner.access_token, { offset: 0, limit: 50 })).body.items.find((user: { name: string }) => user.name === 'Pessoa FRONT_DESK').id;

    await prisma.unscoped.tenant.update({ where: { id: owner.tenant.id }, data: { subscriptionStatus: 'trial', subscriptionDueAt: new Date(Date.now() - 86_400_000) } });
    app.get(EntitlementsService).forget(owner.tenant.id);

    const refused: Array<[string, Record<string, unknown>]> = [
      ['service-orders/update', { id: order.id, diagnosis: 'Depois do fim do teste' }],
      ['service-orders/transition', { id: order.id, to_status: 'IN_PROGRESS' }],
      ['service-orders/items', { service_order_id: order.id, type: 'LABOR', description: 'Mais um', quantity: 1, unit_price_cents: 100 }],
      ['service-orders/receipts', { service_order_id: order.id, method: 'PIX', amount_cents: 100 }],
      ['customers/update', { id: order.customerId, name: 'Outro nome' }],
      ['financial/categories', { name: 'Nova', type: 'EXPENSE' }],
      ['settings/agenda-hours', { open_hour: 8, close_hour: 18, work_days: [1] }],
    ];
    for (const [path, body] of refused) {
      const response = await post(path, owner.access_token, body);
      expect([path, response.status]).toEqual([path, 403]);
      expect(response.body.error.message).toContain('só para consulta');
    }

    expect((await get(`service-order?id=${order.id}`, owner.access_token)).status).toBe(200);
    expect((await post('service-orders/list', owner.access_token, { offset: 0, limit: 10 })).status).toBe(200);
    expect((await get('billing', owner.access_token)).status).toBe(200);
    expect((await post('users/disable', owner.access_token, { id: colleagueId })).status).toBe(200);
    expect((await get('plan', colleague.access_token)).status).toBe(401);
  });

  it('money stays consistent: reversing reopens the installment and a cancelled order leaves the receivables', async () => {
    const owner = await signup('parcelas');
    const order = await orderWithItem(owner.access_token, 'parcelas');
    const firstDue = new Date(Date.now() + 86_400_000).toISOString();
    const configured = await post('service-orders/payment/configure', owner.access_token, { service_order_id: order.id, method: 'CREDIT_CARD', installments: 3, anticipated: false, first_due_at: firstDue });
    expect(configured.status).toBe(200);
    expect(configured.body.service_order.installments.map((item: { amount_cents: number }) => item.amount_cents)).toEqual([4000, 4000, 4000]);

    const first = configured.body.service_order.installments[0];
    expect((await post('service-orders/installments/confirm', owner.access_token, { id: first.id })).status).toBe(200);
    const paid = await get(`service-order?id=${order.id}`, owner.access_token);
    expect(paid.body.service_order.received_amount_cents).toBe(4000);
    const receipt = paid.body.service_order.receipts[0];

    // New item: what is still open follows the new total.
    await post('service-orders/items', owner.access_token, { service_order_id: order.id, type: 'LABOR', description: 'Alinhamento', quantity: 1, unit_price_cents: 3000 }).expect(201);
    const grown = await get(`service-order?id=${order.id}`, owner.access_token);
    expect(grown.body.service_order.installments.filter((item: { status: string }) => item.status === 'PENDING').map((item: { amount_cents: number }) => item.amount_cents)).toEqual([5500, 5500]);

    // Cancelling with money in the till is refused until it is reversed.
    expect((await post('service-orders/transition', owner.access_token, { id: order.id, to_status: 'CANCELLED', reason: 'Cliente desistiu' })).status).toBe(409);
    expect((await post('service-orders/receipts/delete', owner.access_token, { id: receipt.id })).status).toBe(200);
    const reversed = await get(`service-order?id=${order.id}`, owner.access_token);
    expect(reversed.body.service_order.received_amount_cents).toBe(0);
    expect(reversed.body.service_order.installments.every((item: { status: string }) => item.status === 'PENDING')).toBe(true);
    expect(reversed.body.service_order.installments.reduce((sum: number, item: { amount_cents: number }) => sum + item.amount_cents, 0)).toBe(15000);

    expect((await post('service-orders/transition', owner.access_token, { id: order.id, to_status: 'CANCELLED', reason: 'Cliente desistiu' })).status).toBe(200);
    const due = await post('service-orders/installments/due', owner.access_token, { limit: 20 });
    expect(due.status).toBe(200);
    expect(due.body.total).toBe(0);
    const cash = await post('financial/cash-flow', owner.access_token, { start_at: new Date(Date.now() - 86_400_000).toISOString(), end_at: new Date(Date.now() + 200 * 86_400_000).toISOString() });
    expect(cash.status).toBe(200);
    expect(cash.body.projected_income_cents).toBe(0);
    expect((await post('service-orders/receipts', owner.access_token, { service_order_id: order.id, method: 'PIX', amount_cents: 100 })).status).toBe(400);
  });

  it('an appointment outside the opening hours asks for confirmation, and starting one counts against the plan', async () => {
    const owner = await signup('agenda');
    const customer = await post('customers', owner.access_token, { type: 'PF', name: 'Cliente agenda', phone: '11999998888', document: generateValidCpf() });
    const vehicle = await post('vehicles', owner.access_token, { customer_id: customer.body.customer.id, brand: 'Fiat', model: 'Uno', plate: uniquePlate(), year: 2015 });
    await post('settings/agenda-hours', owner.access_token, { open_hour: 8, close_hour: 18, work_days: [1, 2, 3, 4, 5, 6, 0] }).expect(200);
    const base = { customer_id: customer.body.customer.id, vehicle_id: vehicle.body.vehicle.id, service_description: 'Revisão' };
    const outside = { ...base, starts_at: '2027-03-10T01:00:00.000Z', ends_at: '2027-03-10T02:00:00.000Z' };
    const refused = await post('appointments', owner.access_token, outside);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('APPOINTMENT_CONFLICT');
    const confirmed = await post('appointments', owner.access_token, { ...outside, confirm_conflict: true });
    expect(confirmed.status).toBe(201);

    await prisma.unscoped.tenant.update({ where: { id: owner.tenant.id }, data: { subscriptionStatus: 'trial', subscriptionDueAt: new Date(Date.now() - 86_400_000) } });
    app.get(EntitlementsService).forget(owner.tenant.id);
    expect((await post('appointments/start', owner.access_token, { id: confirmed.body.appointment.id })).status).toBe(403);
  });

  it('a wrong password does not reveal that an account exists but is blocked', async () => {
    const owner = await signup('login');
    const email = `bloqueado-${Date.now()}@example.invalid`;
    const invited = await post('users/invite', owner.access_token, { email, name: 'Bloqueado', role: 'MECHANIC' });
    await api().post('/api/v1/users/accept-invite').send({ accepted_terms: true, legal_version: LEGAL_VERSION, invite_token: String(invited.body.invite_link).split('/convite/')[1], password: 'regras-qa-password' }).expect(200);
    await post('users/disable', owner.access_token, { id: invited.body.user.id }).expect(200);

    const wrong = await api().post('/api/v1/auth/login').send({ email, password: 'senha-errada-12345' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    const right = await api().post('/api/v1/auth/login').send({ email, password: 'regras-qa-password' });
    expect(right.status).toBe(403);
  });
});
