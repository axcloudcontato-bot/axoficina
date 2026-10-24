import { LEGAL_VERSION } from '@oficina/contracts';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/shared/prisma/prisma.service';
import { FipeClientService } from '../src/modules/fipe/services/fipe-client.service';
import { generateValidCpf } from './utils/generate-cpf';

describe('Fipe (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdTenantIds: string[] = [];
  const createdBrandIds: string[] = [];

  beforeAll(async () => {
    // Redundante com a guarda NODE_ENV=test dentro do próprio
    // FipeClientService (ver comentário lá) — mantido aqui como reforço
    // explícito específico desta suíte, que é a única que chama
    // POST /fipe/sync de verdade.
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(FipeClientService)
      .useValue({ fetchBrands: async () => [], fetchModels: async () => [] })
      .compile();
    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => {
    (app.get(ThrottlerStorage) as ThrottlerStorageService).storage.clear();
  });

  afterAll(async () => {
    if (createdBrandIds.length > 0) {
      await prisma.unscoped.fipeModel.deleteMany({ where: { brandId: { in: createdBrandIds } } });
      await prisma.unscoped.fipeBrand.deleteMany({ where: { id: { in: createdBrandIds } } });
    }
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
        tenant_name: `Oficina Fipe E2E ${suffix}`,
        tenant_document: generateValidCpf(),
        admin_name: 'Admin E2E',
        admin_email: `admin-fipe-${suffix}@e2e-test.com`,
        password: 'supersecret1',
      });
    createdTenantIds.push(response.body.tenant.id);
    return response.body as { access_token: string; tenant: { id: string } };
  }

  async function inviteFrontDesk(adminToken: string, suffix: string): Promise<string> {
    const invite = await request(app.getHttpServer())
      .post('/api/v1/users/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: `frontdesk-fipe-${suffix}@e2e-test.com`, name: 'Recepção', role: 'FRONT_DESK' });
    const inviteToken = invite.body.invite_link.split('/invite/')[1];

    const accept = await request(app.getHttpServer())
      .post('/api/v1/users/accept-invite')
      .send({ accepted_terms: true, legal_version: LEGAL_VERSION, invite_token: inviteToken, password: 'supersecret1' });
    return accept.body.access_token as string;
  }

  // Seed direto no banco — nunca chama a API real da FIPE nos testes.
  async function seedBrandWithModels(suffix: string) {
    const brand = await prisma.unscoped.fipeBrand.create({
      data: { category: 'CAR', fipeCode: `test-${suffix}`, name: `Marca Teste ${suffix}`, syncedAt: new Date() },
    });
    createdBrandIds.push(brand.id);
    await prisma.unscoped.fipeModel.createMany({
      data: [
        { brandId: brand.id, fipeCode: `model-a-${suffix}`, name: 'Modelo A', syncedAt: new Date() },
        { brandId: brand.id, fipeCode: `model-b-${suffix}`, name: 'Modelo B', syncedAt: new Date() },
      ],
    });
    return brand;
  }

  it('lists brands scoped to the requested category', async () => {
    const suffix = `brands-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const brand = await seedBrandWithModels(suffix);

    const response = await request(app.getHttpServer())
      .get('/api/v1/fipe/brands?category=CAR')
      .set('Authorization', `Bearer ${admin.access_token}`);

    expect(response.status).toBe(200);
    expect(response.body.brands.some((item: { id: string }) => item.id === brand.id)).toBe(true);
  });

  it('rejects an invalid category with 400', async () => {
    const admin = await signupAdmin(`badcategory-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .get('/api/v1/fipe/brands?category=SPACESHIP')
      .set('Authorization', `Bearer ${admin.access_token}`);

    expect(response.status).toBe(400);
  });

  it('lists models scoped to the requested brand', async () => {
    const suffix = `models-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const brand = await seedBrandWithModels(suffix);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/fipe/models?brand_id=${brand.id}`)
      .set('Authorization', `Bearer ${admin.access_token}`);

    expect(response.status).toBe(200);
    expect(response.body.models).toHaveLength(2);
    expect(response.body.models.map((item: { name: string }) => item.name).sort()).toEqual(['Modelo A', 'Modelo B']);
  });

  it('returns an empty list for a non-existent brand_id, not an error (Edge Case 5)', async () => {
    const admin = await signupAdmin(`missingbrand-${Date.now()}`);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/fipe/models?brand_id=${randomUUID()}`)
      .set('Authorization', `Bearer ${admin.access_token}`);

    expect(response.status).toBe(200);
    expect(response.body.models).toEqual([]);
  });

  it('all 4 roles can list brands/models', async () => {
    const suffix = `roles-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const frontDeskToken = await inviteFrontDesk(admin.access_token, suffix);

    const response = await request(app.getHttpServer())
      .get('/api/v1/fipe/brands?category=CAR')
      .set('Authorization', `Bearer ${frontDeskToken}`);

    expect(response.status).toBe(200);
  });

  it('rejects POST /fipe/sync from a non-ADMIN role with 403 (Edge Case 6)', async () => {
    const suffix = `syncauth-${Date.now()}`;
    const admin = await signupAdmin(suffix);
    const frontDeskToken = await inviteFrontDesk(admin.access_token, suffix);

    const response = await request(app.getHttpServer()).post('/api/v1/fipe/sync').set('Authorization', `Bearer ${frontDeskToken}`);

    expect(response.status).toBe(403);
  });

  it('accepts POST /fipe/sync from ADMIN and responds immediately without waiting for the job', async () => {
    const admin = await signupAdmin(`syncok-${Date.now()}`);

    const response = await request(app.getHttpServer()).post('/api/v1/fipe/sync').set('Authorization', `Bearer ${admin.access_token}`);

    expect(response.status).toBe(202);
  });
});
