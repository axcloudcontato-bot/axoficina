import { DEFAULT_CATALOG } from '../default-catalog';
import { CatalogManager } from './catalog.manager';

const user = { tenantId: 'tenant-1', userId: 'user-1' } as never;
const row = (over: Record<string, unknown> = {}) => ({ id: 'item-1', type: 'PART', name: 'Filtro de óleo', category: null, unitPriceCents: 0, costCents: null, code: null, brand: null, unit: 'un', supplierId: null, standardMinutes: null, careServiceKey: null, trackStock: false, stockQuantity: 0, minStock: null, ...over });

function setup() {
  const repository = { adjustStock: jest.fn(), importRows: jest.fn(), reportLines: jest.fn().mockResolvedValue([]), listPackages: jest.fn().mockResolvedValue([]), packageById: jest.fn(), packageByName: jest.fn().mockResolvedValue(null), packageLines: jest.fn().mockResolvedValue([]), existingItemIds: jest.fn(), savePackage: jest.fn(), removePackage: jest.fn(), supplierExists: jest.fn().mockResolvedValue(true), list: jest.fn().mockResolvedValue([]), byId: jest.fn(), findByName: jest.fn().mockResolvedValue(null), create: jest.fn(), createMany: jest.fn().mockResolvedValue({ count: 0 }), update: jest.fn(), remove: jest.fn() };
  const audit = { record: jest.fn() };
  return { repository, audit, manager: new CatalogManager(repository as never, audit as never) };
}

describe('CatalogManager', () => {
  it('creates an item trimming the name and rejecting duplicates of the same type', async () => {
    const { manager, repository } = setup();
    repository.create.mockResolvedValue(row({ name: 'Amortecedor', unitPriceCents: 25000 }));
    const result = await manager.create(user, { type: 'PART', name: '  Amortecedor ', unitPriceCents: 25000 });
    expect(repository.create).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ type: 'PART', name: 'Amortecedor', category: null, unitPriceCents: 25000, unit: 'un' }));
    expect(result.item).toMatchObject({ name: 'Amortecedor', unitPriceCents: 25000 });

    repository.findByName.mockResolvedValue(row());
    await expect(manager.create(user, { type: 'PART', name: 'Filtro de óleo', unitPriceCents: 0 })).rejects.toThrow('Já existe');
  });

  it('records who created an item and who changed its price, from how much to how much', async () => {
    const { manager, repository, audit } = setup();
    repository.create.mockResolvedValue(row({ id: 'item-9', name: 'Vela', unitPriceCents: 3000 }));
    await manager.create(user, { type: 'PART', name: 'Vela', unitPriceCents: 3000 });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'catalog.item_created', entityId: 'item-9', metadata: { itemAction: 'create', amountCents: 3000 } }));

    repository.byId.mockResolvedValue(row({ unitPriceCents: 3000 }));
    repository.update.mockResolvedValue(row({ unitPriceCents: 4500 }));
    await manager.update(user, { id: 'item-1', type: 'PART', name: 'Filtro de óleo', unitPriceCents: 4500 });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'catalog.item_updated', metadata: { itemAction: 'update', previousAmountCents: 3000, amountCents: 4500 } }));
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

  describe('cost and service details', () => {
    const request = { type: 'PART' as const, name: 'Pastilha', unitPriceCents: 18000, costCents: 9000, code: ' PF-123 ', brand: 'Cobreq', unit: 'jogo' as const };

    it('stores cost, code, brand and unit, and only shows the cost to people with finance access', async () => {
      const { manager, repository } = setup();
      repository.create.mockImplementation(async (_tenant: string, input: Record<string, unknown>) => row({ ...input, id: 'item-2' }));
      const withCost = await manager.create(user, request, { canSeeCost: true });
      expect(repository.create).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ costCents: 9000, code: 'PF-123', brand: 'Cobreq', unit: 'jogo' }));
      expect(withCost.item).toMatchObject({ costCents: 9000, code: 'PF-123', unit: 'jogo' });

      repository.create.mockClear();
      const withoutCost = await manager.create(user, { ...request, name: 'Outra' }, { canSeeCost: false });
      expect(repository.create).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ costCents: null }));
      expect(withoutCost.item).not.toHaveProperty('costCents');
    });

    it('keeps the stored cost when someone without finance access edits the item', async () => {
      const { manager, repository } = setup();
      repository.byId.mockResolvedValue(row({ costCents: 9000 }));
      repository.update.mockImplementation(async (_id: string, input: Record<string, unknown>) => row(input));
      const result = await manager.update(user, { id: 'item-1', ...request, costCents: 1 }, { canSeeCost: false });
      expect(repository.update).toHaveBeenCalledWith('item-1', expect.objectContaining({ costCents: 9000 }));
      expect(result.item).not.toHaveProperty('costCents');
    });

    it('keeps time and the scheduled care for services only, and refuses an unknown supplier', async () => {
      const { manager, repository } = setup();
      repository.create.mockImplementation(async (_tenant: string, input: Record<string, unknown>) => row(input));
      await manager.create(user, { type: 'LABOR', name: 'Troca de óleo', unitPriceCents: 8000, standardMinutes: 40, careServiceKey: 'OIL_CHANGE', supplierId: '00000000-0000-4000-8000-000000000001' }, { canSeeCost: true });
      expect(repository.create).toHaveBeenLastCalledWith('tenant-1', expect.objectContaining({ standardMinutes: 40, careServiceKey: 'OIL_CHANGE', supplierId: null, unit: 'h' }));

      await manager.create(user, { type: 'PART', name: 'Filtro', unitPriceCents: 3000, standardMinutes: 40, careServiceKey: 'OIL_CHANGE' }, { canSeeCost: true });
      expect(repository.create).toHaveBeenLastCalledWith('tenant-1', expect.objectContaining({ standardMinutes: null, careServiceKey: null }));

      repository.supplierExists.mockResolvedValue(false);
      await expect(manager.create(user, { type: 'PART', name: 'Vela', unitPriceCents: 3000, supplierId: '00000000-0000-4000-8000-000000000002' })).rejects.toThrow('Fornecedor não encontrado');
    });

    it('seeds default services already mapped to their customer-care campaign', async () => {
      const { manager, repository } = setup();
      await manager.seedDefaults(user);
      const [, batch] = repository.createMany.mock.calls[0];
      expect(batch.find((item: { name: string }) => item.name === 'Troca de óleo e filtro')).toMatchObject({ careServiceKey: 'OIL_CHANGE' });
      expect(batch.find((item: { name: string }) => item.name === 'Pastilha de freio dianteira')).toMatchObject({ careServiceKey: null });
    });
  });

  describe('stock', () => {
    it('tracks stock only for parts and products', async () => {
      const { manager, repository } = setup();
      repository.create.mockImplementation(async (_t: string, input: Record<string, unknown>) => row(input));
      await manager.create(user, { type: 'PART', name: 'Filtro', unitPriceCents: 3000, trackStock: true, minStock: 4 });
      expect(repository.create).toHaveBeenLastCalledWith('tenant-1', expect.objectContaining({ trackStock: true, minStock: 4 }));
      await manager.create(user, { type: 'LABOR', name: 'Troca', unitPriceCents: 3000, trackStock: true, minStock: 4 });
      expect(repository.create).toHaveBeenLastCalledWith('tenant-1', expect.objectContaining({ trackStock: false, minStock: null }));
    });

    it('refuses a movement on an item without stock control, and a zero purchase', async () => {
      const { manager, repository } = setup();
      repository.byId.mockResolvedValue(row());
      await expect(manager.adjustStock(user, { id: 'item-1', kind: 'PURCHASE', quantity: 5 })).rejects.toThrow('Ative o controle de estoque');
      repository.byId.mockResolvedValue(row({ trackStock: true }));
      await expect(manager.adjustStock(user, { id: 'item-1', kind: 'PURCHASE', quantity: 0 })).rejects.toThrow('maior que zero');
      expect(repository.adjustStock).not.toHaveBeenCalled();
    });

    it('records a purchase and a counted adjustment', async () => {
      const { manager, repository, audit } = setup();
      repository.byId.mockResolvedValue(row({ trackStock: true, stockQuantity: 2 }));
      repository.adjustStock.mockResolvedValue(row({ trackStock: true, stockQuantity: 12 }));
      const result = await manager.adjustStock(user, { id: 'item-1', kind: 'PURCHASE', quantity: 10, note: ' NF 123 ' });
      expect(repository.adjustStock).toHaveBeenCalledWith('tenant-1', 'item-1', 'user-1', 'PURCHASE', 10, 'NF 123');
      expect(result.item).toMatchObject({ trackStock: true, stockQuantity: 12 });
      expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'catalog.stock_adjusted' }));
    });
  });

  describe('spreadsheet import', () => {
    it('creates new items, updates the price of existing ones and keeps the rest of the row', async () => {
      const { manager, repository } = setup();
      repository.list.mockResolvedValue([row({ id: 'item-1', name: 'Filtro de óleo' })]);
      const result = await manager.importRows(user, { rows: [
        { type: 'PART', name: ' filtro de óleo ', unitPriceCents: 4500, costCents: 2000, code: 'F-1' },
        { type: 'PART', name: 'Vela', unitPriceCents: 3000 },
        { type: 'PART', name: 'Vela', unitPriceCents: 3200 },
      ] }, { canSeeCost: false });
      expect(result).toEqual({ created: 1, updated: 1 });
      const [, create, update] = repository.importRows.mock.calls[0];
      expect(create).toEqual([expect.objectContaining({ name: 'Vela', unitPriceCents: 3200, costCents: null })]);
      expect(update).toEqual([{ id: 'item-1', data: { unitPriceCents: 4500, code: 'F-1' } }]);
    });

    it('takes the cost from the sheet only for people who see the financial data', async () => {
      const { manager, repository } = setup();
      repository.list.mockResolvedValue([row({ id: 'item-1', name: 'Filtro de óleo' })]);
      await manager.importRows(user, { rows: [{ type: 'PART', name: 'Filtro de óleo', unitPriceCents: 4500, costCents: 2000 }, { type: 'PART', name: 'Vela', unitPriceCents: 3000, costCents: 1000 }] }, { canSeeCost: true });
      const [, create, update] = repository.importRows.mock.calls[0];
      expect(create[0]).toMatchObject({ costCents: 1000 });
      expect(update[0].data).toMatchObject({ costCents: 2000 });
    });
  });

  describe('packages', () => {
    it('merges repeated items, refuses unknown ones and duplicate names', async () => {
      const { manager, repository } = setup();
      repository.existingItemIds.mockResolvedValue(new Set(['a', 'b']));
      repository.savePackage.mockResolvedValue({ id: 'pack-1', name: 'Revisão' });
      const result = await manager.savePackage(user, { name: ' Revisão ', items: [{ catalogItemId: 'a', quantity: 1 }, { catalogItemId: 'a', quantity: 3 }, { catalogItemId: 'b', quantity: 1 }] });
      expect(repository.savePackage).toHaveBeenCalledWith('tenant-1', undefined, 'Revisão', [{ catalogItemId: 'a', quantity: 4 }, { catalogItemId: 'b', quantity: 1 }]);
      expect(result.package.items).toHaveLength(2);

      repository.existingItemIds.mockResolvedValue(new Set(['a']));
      await expect(manager.savePackage(user, { name: 'Outro', items: [{ catalogItemId: 'b', quantity: 1 }] })).rejects.toThrow('não existe mais');
      repository.packageByName.mockResolvedValue({ id: 'other', name: 'Revisão' });
      await expect(manager.savePackage(user, { name: 'Revisão', items: [{ catalogItemId: 'a', quantity: 1 }] })).rejects.toThrow('Já existe um pacote');
    });
  });

  describe('best sellers report', () => {
    const line = (over: Record<string, unknown>) => ({ serviceOrderId: 'so-1', catalogItemId: 'cat-1', type: 'PART', description: 'Filtro', quantity: 1, unitPriceCents: 5000, costCents: 2000, ...over });

    it('adds up lines by item, counts orders and sorts by revenue', async () => {
      const { manager, repository } = setup();
      repository.reportLines.mockResolvedValue([line({}), line({ serviceOrderId: 'so-2', quantity: 2 }), line({ catalogItemId: null, description: 'Lavagem', type: 'LABOR', unitPriceCents: 40000, costCents: null })]);
      const result = await manager.report(user, 90, { canSeeCost: true });
      expect(result.rows[0]).toMatchObject({ name: 'Lavagem', revenueCents: 40000, orders: 1 });
      expect(result.rows[0]).not.toHaveProperty('marginCents');
      expect(result.rows[1]).toMatchObject({ catalogItemId: 'cat-1', quantity: 3, orders: 2, revenueCents: 15000, costCents: 6000, marginCents: 9000 });
    });

    it('hides cost and margin from people without finance access', async () => {
      const { manager, repository } = setup();
      repository.reportLines.mockResolvedValue([line({})]);
      const result = await manager.report(user, 30);
      expect(result.rows[0]).not.toHaveProperty('costCents');
      expect(result.rows[0]).not.toHaveProperty('marginCents');
    });
  });
});
