import { Prisma } from '@oficina/database';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { tenantIsolationExtension, TENANT_SCOPED_MODELS, UNSCOPED_TENANT_MODELS } from './tenant-isolation.middleware';

const modelsWithTenantId = Prisma.dmmf.datamodel.models.filter((model) => model.fields.some((field) => field.name === 'tenantId')).map((model) => model.name);

describe('tenant isolation coverage', () => {
  it('every model with a tenantId column is filtered or explicitly listed as unscoped', () => {
    const missing = modelsWithTenantId.filter((name) => !TENANT_SCOPED_MODELS.has(name) && !(name in UNSCOPED_TENANT_MODELS));
    // A model left out of both lists is never filtered: one workshop could read or change another's rows.
    expect(missing).toEqual([]);
  });

  it('every filtered model really has a tenantId column (the filter would fail at runtime otherwise)', () => {
    const orphans = [...TENANT_SCOPED_MODELS].filter((name) => !modelsWithTenantId.includes(name));
    expect(orphans).toEqual([]);
  });

  it('a model is never both filtered and listed as unscoped, and every unscoped model has a reason', () => {
    expect(Object.keys(UNSCOPED_TENANT_MODELS).filter((name) => TENANT_SCOPED_MODELS.has(name))).toEqual([]);
    expect(Object.entries(UNSCOPED_TENANT_MODELS).filter(([, reason]) => reason.trim().length < 20)).toEqual([]);
    expect(Object.keys(UNSCOPED_TENANT_MODELS).filter((name) => !modelsWithTenantId.includes(name))).toEqual([]);
  });
});

// Runs the extension against a fake query, so what reaches Prisma is visible without a database.
async function run(model: string, operation: string, args: Record<string, unknown>, tenantId?: string) {
  const context = new TenantContextService();
  const extension = tenantIsolationExtension(context);
  const query = jest.fn(async (received: Record<string, unknown>) => received);
  const call = () => extension.query.$allModels.$allOperations({ model, operation, args, query });
  const result = tenantId ? await context.run({ tenantId } as never, call) : await call();
  return { result: result as Record<string, unknown>, query };
}

describe.each([...TENANT_SCOPED_MODELS])('tenant isolation on %s', (model) => {
  it.each(['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany', 'findUnique', 'findUniqueOrThrow', 'update', 'delete'])(
    '%s only reaches rows of the active workshop',
    async (operation) => {
      const { result } = await run(model, operation, { where: { id: 'row-1', tenantId: 'other-workshop' } }, 'workshop-a');
      expect(result.where).toEqual({ id: 'row-1', tenantId: 'workshop-a' });
    },
  );

  it('create writes into the active workshop even if the caller names another', async () => {
    const { result } = await run(model, 'create', { data: { name: 'x', tenantId: 'other-workshop' } }, 'workshop-a');
    expect(result.data).toEqual({ name: 'x', tenantId: 'workshop-a' });
  });

  it.each(['createMany', 'createManyAndReturn'])('%s forces every row into the active workshop', async (operation) => {
    const { result } = await run(model, operation, { data: [{ name: 'a' }, { name: 'b', tenantId: 'other-workshop' }] }, 'workshop-a');
    expect(result.data).toEqual([{ name: 'a', tenantId: 'workshop-a' }, { name: 'b', tenantId: 'workshop-a' }]);
  });

  it.each(['findMany', 'count', 'aggregate', 'groupBy'])('%s without an active workshop refuses to run instead of listing everyone', async (operation) => {
    await expect(run(model, operation, { where: {} })).rejects.toThrow('tenant-isolation');
  });
});

describe('models outside the filter', () => {
  it('pass through untouched', async () => {
    const { result } = await run('Tenant', 'findMany', { where: { id: 'x' } }, 'workshop-a');
    expect(result.where).toEqual({ id: 'x' });
  });
});
