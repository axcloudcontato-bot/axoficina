import { PrismaService } from '../../src/shared/prisma/prisma.service';
import { TenantContextService } from '../../src/shared/tenant-context/tenant-context.service';
import { TenantRepository } from '../../src/modules/iam/repositories/tenant.repository';

// Integração real com Postgres — precisa de `docker compose up postgres`
// (ou do stack completo) e DATABASE_URL apontando para ele. Roda via
// `pnpm run test:e2e`, não pelo `pnpm test` padrão (sem infra).
describe('TenantRepository (integration)', () => {
  let prisma: PrismaService;
  let repository: TenantRepository;
  const createdIds: string[] = [];

  beforeAll(async () => {
    prisma = new PrismaService(new TenantContextService());
    await prisma.onModuleInit();
    repository = new TenantRepository(prisma);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.unscoped.tenant.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.onModuleDestroy();
  });

  it('inserts a tenant and finds it by id', async () => {
    const tenant = await repository.insert({ name: 'Oficina Teste', document: `doc-${Date.now()}-a` });
    createdIds.push(tenant.id);

    const found = await repository.byId(tenant.id);
    expect(found?.name).toBe('Oficina Teste');
    expect(found?.plan).toBe('completo');
    // A new workshop starts on the 14-day free trial.
    expect(found?.subscriptionStatus).toBe('trial');
    const days = ((found?.subscriptionDueAt?.getTime() ?? 0) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);
    expect(found?.status).toBe('active');
  });

  it('finds a tenant by document', async () => {
    const document = `doc-${Date.now()}-b`;
    const tenant = await repository.insert({ name: 'Oficina B', document });
    createdIds.push(tenant.id);

    const found = await repository.byDocument(document);
    expect(found?.id).toBe(tenant.id);
  });

  it('does not return a soft-deleted tenant', async () => {
    const tenant = await repository.insert({ name: 'Oficina Deletada', document: `doc-${Date.now()}-c` });
    createdIds.push(tenant.id);
    await prisma.unscoped.tenant.update({ where: { id: tenant.id }, data: { deletedAt: new Date() } });

    expect(await repository.byId(tenant.id)).toBeNull();
    expect(await repository.byDocument(tenant.document)).toBeNull();
  });

  it('returns null for a non-existent tenant', async () => {
    expect(await repository.byId('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
