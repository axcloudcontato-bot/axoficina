import { LEGAL_VERSION } from '@oficina/contracts';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { generateValidCpf } from './utils/generate-cpf';

// E2E real — mesma exigência de infra do auth.e2e-spec.ts.
describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // Ver comentário equivalente em auth.e2e-spec.ts.
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (createdTenantIds.length > 0) {
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
        tenant_name: `Oficina Users E2E ${suffix}`,
        // Documento único por chamada — ver comentário equivalente em auth.e2e-spec.ts.
        tenant_document: generateValidCpf(),
        admin_name: 'Admin E2E',
        admin_email: `admin-users-${suffix}@e2e-test.com`,
        password: 'supersecret1',
      });
    createdTenantIds.push(response.body.tenant.id);
    return response.body as { access_token: string; tenant: { id: string } };
  }

  it('an authenticated Admin can invite a user and get an invite link back', async () => {
    const admin = await signupAdmin(`invite-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ email: `mechanic-${Date.now()}@e2e-test.com`, name: 'Mecânico', role: 'MECHANIC' });

    expect(response.status).toBe(201);
    expect(response.body.invite_link).toContain('/convite/');
    expect(response.body.user.status).toBe('invited');
  });

  it('rejects an unauthenticated invite attempt with 401', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .send({ email: `nobody-${Date.now()}@e2e-test.com`, name: 'X', role: 'MECHANIC' });

    expect(response.status).toBe(401);
  });

  it('full invite -> accept -> login flow, then RolesGuard blocks the invitee from inviting others', async () => {
    const admin = await signupAdmin(`flow-${Date.now()}`);
    const mechanicEmail = `mechanic-flow-${Date.now()}@e2e-test.com`;

    const invite = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ email: mechanicEmail, name: 'Mecânico Flow', role: 'MECHANIC' });

    const inviteToken = invite.body.invite_link.split('/convite/')[1];

    const accept = await request(app.getHttpServer())
      .post('/api/v1/users/accept-invite')
      .send({ accepted_terms: true, legal_version: LEGAL_VERSION, invite_token: inviteToken, password: 'supersecret1' });

    expect(accept.status).toBe(200);
    expect(accept.body.user.status).toBe('active');
    expect(accept.body.user.role).toBe('MECHANIC');

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: mechanicEmail, password: 'supersecret1' });
    expect(login.status).toBe(200);

    // Edge Case / RBAC: MECHANIC não tem permissão para convidar.
    const forbidden = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${login.body.access_token}`)
      .send({ email: `someone-else-${Date.now()}@e2e-test.com`, name: 'X', role: 'FRONT_DESK' });

    expect(forbidden.status).toBe(403);
  });

  it('rejects accept-invite with an expired or unknown token', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/users/accept-invite')
      .send({ accepted_terms: true, legal_version: LEGAL_VERSION, invite_token: 'this-token-does-not-exist', password: 'supersecret1' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVITE_TOKEN_INVALID');
  });

  it('rejects a duplicate invite email with 409 (global uniqueness)', async () => {
    const admin = await signupAdmin(`dupinvite-${Date.now()}`);
    const email = `dup-invite-${Date.now()}@e2e-test.com`;

    const first = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ email, name: 'First', role: 'MECHANIC' });
    expect(first.status).toBe(201);

    const second = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ email, name: 'Second', role: 'FRONT_DESK' });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('lists only users belonging to the requesting tenant', async () => {
    const admin = await signupAdmin(`list-${Date.now()}`);
    await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ email: `list-mechanic-${Date.now()}@e2e-test.com`, name: 'List Mechanic', role: 'MECHANIC' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/users/list')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ offset: 0, limit: 10 });

    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(2); // admin + o convidado
    expect(response.body.items.every((item: { tenant_id: string }) => item.tenant_id === admin.tenant.id)).toBe(true);
  });

  it('rejects inviting a new ADMIN (privilege escalation guard)', async () => {
    const admin = await signupAdmin(`noadmin-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${admin.access_token}`)
      .send({ email: `wannabe-admin-${Date.now()}@e2e-test.com`, name: 'X', role: 'ADMIN' });

    expect(response.status).toBe(400);
  });
});
