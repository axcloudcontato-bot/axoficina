import { LEGAL_VERSION } from '@oficina/contracts';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { generateValidCpf } from './utils/generate-cpf';

// E2E real (stack HTTP completa) — precisa do banco migrado + seed dos
// papéis fixos rodados (o seed cria o role ADMIN que o signup depende de
// encontrar). Ver README/CI para os comandos.
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // bodyParser: false + configureApp() precisam espelhar exatamente o
    // bootstrap de src/main.ts — senão os payloads snake_case destes testes
    // (o formato real que o frontend envia) nunca passam pelo
    // snakeToCamelMiddleware e os testes exercitam um caminho que a app
    // real não tem.
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    // Keep the listener alive for concurrent requests; Supertest otherwise
    // closes its temporary server when the first response completes.
    await app.listen(0, '127.0.0.1');
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    // AUTH_THROTTLE (5 req/60s) é por rota, mas todo request de teste vem do
    // mesmo IP — sem isso, testes anteriores que chamam signup/login
    // "gastam" o mesmo orçamento do endpoint e o próximo teste esbarra em
    // 429 mesmo sem ter nada a ver com o teste de rate limit dedicado.
    (app.get(ThrottlerStorage) as ThrottlerStorageService).storage.clear();
  });

  afterAll(async () => {
    if (createdTenantIds.length > 0) {
      await prisma.unscoped.user.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
    }
    await app.close();
  });

  function signupPayload(suffix: string) {
    return {
      accepted_terms: true, legal_version: LEGAL_VERSION,
        tenant_name: `Oficina E2E ${suffix}`,
      // Documento único por chamada — um valor fixo colide (unique
      // constraint) assim que mais de um teste da suíte faz signup.
      tenant_document: generateValidCpf(),
      admin_name: 'Admin E2E',
      admin_email: `admin-${suffix}@e2e-test.com`,
      password: 'supersecret1',
    };
  }

  it('signup creates a tenant + admin and returns tokens', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/signup').send(signupPayload(`ok-${Date.now()}`));

    expect(response.status).toBe(201);
    expect(response.body.access_token).toBeDefined();
    expect(response.body.refresh_token).toBeDefined();
    expect(response.body.tenant.id).toBeDefined();
    expect(response.body.user.email).toContain('@e2e-test.com');

    createdTenantIds.push(response.body.tenant.id);
  });

  it('signup rejects a password shorter than 8 characters with 400', async () => {
    const payload = signupPayload(`short-${Date.now()}`);
    payload.password = 'short';

    const response = await request(app.getHttpServer()).post('/api/v1/auth/signup').send(payload);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBeDefined();
  });

  it('signup rejects a duplicate document with 409', async () => {
    const payload = signupPayload(`dup-${Date.now()}`);
    const first = await request(app.getHttpServer()).post('/api/v1/auth/signup').send(payload);
    createdTenantIds.push(first.body.tenant.id);

    const second = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({ ...payload, admin_email: `other-${Date.now()}@e2e-test.com` });

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DOCUMENT_ALREADY_EXISTS');
  });

  it('login → refresh → logout works end to end', async () => {
    const payload = signupPayload(`flow-${Date.now()}`);
    const signup = await request(app.getHttpServer()).post('/api/v1/auth/signup').send(payload);
    createdTenantIds.push(signup.body.tenant.id);

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.admin_email, password: payload.password });
    expect(login.status).toBe(200);

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: login.body.refresh_token });
    expect(refresh.status).toBe(200);
    expect(refresh.body.access_token).toBeDefined();

    // Edge Case 2: o refresh token antigo (já rotacionado) não pode ser reutilizado.
    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: login.body.refresh_token });
    expect(reuse.status).toBe(401);

    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refresh_token: refresh.body.refresh_token });
    expect(logout.status).toBe(204);
  });

  it('login rejects invalid credentials with 401', async () => {
    const payload = signupPayload(`badlogin-${Date.now()}`);
    const signup = await request(app.getHttpServer()).post('/api/v1/auth/signup').send(payload);
    createdTenantIds.push(signup.body.tenant.id);

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: payload.admin_email, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rate limits repeated login attempts (Edge Case 5)', async () => {
    const email = `ratelimit-${Date.now()}@e2e-test.com`;
    const attempts = Array.from({ length: 6 }, () =>
      request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: 'whatever1' }),
    );

    const responses = await Promise.all(attempts);
    expect(responses.filter((response) => response.status === 401)).toHaveLength(5);
    const blocked = responses.filter((response) => response.status === 429);
    expect(blocked).toHaveLength(1);
    expect(blocked[0].body.error.code).toBe('RATE_LIMITED');
  });
});
