import { DEFAULT_CATALOG } from '../default-catalog';
import { CatalogManager } from './catalog.manager';

const user = { tenantId: 'tenant-1', userId: 'user-1' } as never;
const row = (over: Partial<{ id: string; type: string; name: string; category: string | null; unitPriceCents: number }> = {}) => ({ id: 'item-1', type: 'PART', name: 'Filtro de óleo', category: null, unitPriceCents: 0, ...over });

function setup() {
  const repository = { list: jest.fn().mockResolvedValue([]), byId: jest.fn(), findByName: jest.fn().mockResolvedValue(null), create: jest.fn(), createMany: jest.fn().mockResolvedValue({ count: 0 }), update: jest.fn(), remove: jest.fn() };
  const audit = { record: jest.fn() };
  return { repository, audit, manager: new CatalogManager(repository as never, audit as never) };
}

describe('CatalogManager', () => {
  it('creates an item trimming the name and rejecting duplicates of the same type', async () => {
    const { manager, repository } = setup();
    repository.create.mockResolvedValue(row({ name: 'Amortecedor', unitPriceCents: 25000 }));
    const result = await manager.create(user, { type: 'PART', name: '  Amortecedor ', unitPriceCents: 25000 });
    expect(repository.create).toHaveBeenCalledWith('tenant-1', { type: 'PART', name: 'Amortecedor', category: null, unitPriceCents: 25000 });
    expect(result.item).toMatchObject({ name: 'Amortecedor', unitPriceCents: 25000 });

    repository.findByName.mockResolvedValue(row());
    await expect(manager.create(user, { type: 'PART', name: 'Filtro de óleo', unitPriceCents: 0 })).rejects.toThrow('Já existe');
  });

  it('allows updating an item to its own name but not to another item name', async () => {
    const { manager, repository } = setup();
    repository.byId.mockResolvedValue(row());
    repository.update.mockResolvedValue(row({ unitPriceCents: 5000 }));
    repository.findByName.mockResolvedValue(row({ id: 'item-1' }));
    await expect(manager.update(user, { id: 'item-1', type: 'PART', name: 'Filtro de óleo', unitPriceCents: 5000 })).resolves.toBeDefined();
    repository.findByName.mockResolvedValue(row({ id: 'other' }));
    await expect(manager.update(user, { id: 'item-1', type: 'PART', name: 'Filtro de óleo', unitPriceCents: 5000 })).rejects.toThrow('Já existe');
    repository.byId.mockResolvedValue(null);
    await expect(manager.update(user, { id: 'missing', type: 'PART', name: 'X', unitPriceCents: 0 })).rejects.toThrow('não encontrado');
  });

  it('seeds the defaults once and only the missing ones afterwards', async () => {
    const { manager, repository } = setup();
    await manager.seedDefaults(user);
    const [, firstBatch] = repository.createMany.mock.calls[0];
    expect(firstBatch).toHaveLength(DEFAULT_CATALOG.length);
    expect(firstBatch.every((item: { unitPriceCents: number }) => item.unitPriceCents === 0)).toBe(true);
    expect(new Set(firstBatch.map((item: { type: string; name: string }) => `${item.type}:${item.name.toLowerCase()}`)).size).toBe(DEFAULT_CATALOG.length);

    repository.createMany.mockClear();
    repository.list.mockResolvedValue(DEFAULT_CATALOG.map((item, index) => row({ id: String(index), type: item.type, name: item.name.toUpperCase() })));
    const again = await manager.seedDefaults(user);
    expect(again.created).toBe(0);
    expect(repository.createMany).not.toHaveBeenCalled();
  });

  it('covers the three kinds a workshop sells', () => {
    expect(new Set(DEFAULT_CATALOG.map((item) => item.type))).toEqual(new Set(['PART', 'PRODUCT', 'LABOR']));
  });
});
