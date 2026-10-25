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

describe('Global SaaS subscriptions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let owner: { access_token: string; user: { id: string }; tenant: { id: string } };
  let other: typeof owner;
  const admins = { isAdmin: jest.fn((id: string) => id === owner?.user.id) };
  const prefix = `Subscription QA ${Date.now()}`;
  const api = () => request(app.getHttpServer());
  const auth = () => `Bearer ${owner.access_token}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(SaasAdminService).useValue(admins).compile();
    app = module.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    async function signup(suffix: string) {
      const response = await api().post('/api/v1/auth/signup').send({
        accepted_terms: true, legal_version: LEGAL_VERSION, tenant_name: `${prefix} ${suffix}`,
        tenant_document: generateValidCpf(), admin_name: 'Subscription QA',
        admin_email: `subscription-${suffix}-${Date.now()}@example.invalid`, password: 'subscription-qa-password',
      });
      expect(response.status).toBe(201);
      return response.body;
    }
    owner = await signup('owner');
    other = await signup('other');
  });

  beforeEach(() => { (app.get(ThrottlerStorage) as ThrottlerStorageService).storage.clear(); });
  afterAll(async () => {
    if (prisma && owner && other) {
      const ids = [owner.tenant.id, other.tenant.id];
      await prisma.unscoped.refreshToken.deleteMany({ where: { userId: { in: [owner.user.id, other.user.id] } } });
      await prisma.unscoped.auditLog.deleteMany({ where: { tenantId: { in: ids } } });
      await prisma.unscoped.user.deleteMany({ where: { tenantId: { in: ids } } });
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
  });

  it('requires authentication and a separate global authorization for reads and writes', async () => {
    expect((await api().get('/api/v1/admin/subscriptions')).status).toBe(401);
    const otherAuth = `Bearer ${other.access_token}`;
    expect((await api().get('/api/v1/admin/access').set('Authorization', otherAuth)).body.allowed).toBe(false);
    expect((await api().get('/api/v1/admin/subscriptions').set('Authorization', otherAuth)).status).toBe(403);
    expect((await api().patch(`/api/v1/admin/subscriptions/${owner.tenant.id}`).set('Authorization', otherAuth).send({})).status).toBe(403);
    expect((await api().get('/api/v1/admin/access').set('Authorization', auth())).body.allowed).toBe(true);
  });

  it('lists across tenants without exposing SMTP or integration secrets, and validates filters', async () => {
    const response = await api().get('/api/v1/admin/subscriptions').query({ search: prefix, limit: 1 }).set('Authorization', auth());
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0].subscription_status).toBe('unconfigured');
    expect(response.body.items[0]).not.toHaveProperty('smtp_password');
    expect(response.body.items[0]).not.toHaveProperty('wa_akg_api_key');
    expect((await api().get('/api/v1/admin/subscriptions').query({ limit: 101 }).set('Authorization', auth())).status).toBe(400);
    expect((await api().get('/api/v1/admin/subscriptions').query({ status: 'unknown' }).set('Authorization', auth())).status).toBe(400);
  });

  it('persists another tenant subscription, records an atomic audit and normalizes annual MRR', async () => {
    const initial = await api().get('/api/v1/admin/subscriptions').query({ search: prefix }).set('Authorization', auth());
    const row = initial.body.items.find((item: { id: string }) => item.id === other.tenant.id);
    const payload = {
      plan: 'Profissional', subscription_status: 'active', subscription_amount_cents: 120000,
      subscription_cycle: 'yearly', subscription_due_at: '2027-10-25T12:00:00.000Z',
      subscription_notes: 'Condição interna de teste', expected_updated_at: row.updated_at,
    };
    const updated = await api().patch(`/api/v1/admin/subscriptions/${other.tenant.id}`).set('Authorization', auth()).send(payload);
    expect(updated.status).toBe(200);
    expect(updated.body.subscription_amount_cents).toBe(120000);
    expect(updated.body.subscription_notes).toBe('Condição interna de teste');
    expect(updated.body.subscription_due_at).toBe(payload.subscription_due_at);
    const filtered = await api().get('/api/v1/admin/subscriptions').query({ search: prefix, status: 'active' }).set('Authorization', auth());
    expect(filtered.body.total).toBe(1);
    expect(filtered.body.summary.mrr_cents - initial.body.summary.mrr_cents).toBe(10000);
    const audit = await prisma.unscoped.auditLog.findFirstOrThrow({ where: { tenantId: other.tenant.id, action: 'subscription.updated' } });
    expect(audit.userId).toBe(owner.user.id);
    expect(JSON.stringify(audit.metadata)).not.toContain(payload.subscription_notes);
    expect((await api().patch(`/api/v1/admin/subscriptions/${other.tenant.id}`).set('Authorization', auth()).send(payload)).status).toBe(409);
    expect((await api().patch(`/api/v1/admin/subscriptions/${other.tenant.id}`).set('Authorization', auth()).send({ ...payload, subscription_amount_cents: -1 })).status).toBe(400);
    const cleared = await api().patch(`/api/v1/admin/subscriptions/${other.tenant.id}`).set('Authorization', auth()).send({ ...payload, subscription_status: 'canceled', subscription_due_at: null, subscription_notes: null, expected_updated_at: updated.body.updated_at });
    expect(cleared.status).toBe(200);
    expect(cleared.body.subscription_due_at).toBeNull();
    const after = await api().get('/api/v1/admin/subscriptions').set('Authorization', auth());
    expect(after.body.summary.mrr_cents).toBe(initial.body.summary.mrr_cents);
  });
});
