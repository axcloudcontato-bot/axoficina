import { HttpStatus } from '@nestjs/common';
import { FinancialManager } from './financial.manager';

const user = { userId: 'user-1', tenantId: 'tenant-1', role: 'ADMIN' as const };

function buildManager() {
  const repository = {
    categories: jest.fn().mockResolvedValue([]),
    cashBaseline: jest.fn().mockResolvedValue(null),
    saveCashBaseline: jest.fn(),
    ensureDefaultCategories: jest.fn(),
    categoryById: jest.fn(),
    createCategory: jest.fn(),
    deleteCategory: jest.fn(),
    createEntry: jest.fn(),
    createRecurringEntries: jest.fn(),
    entryById: jest.fn(),
    entries: jest.fn().mockResolvedValue([]),
    settleEntry: jest.fn(),
    addPayment: jest.fn(),
    reversePayment: jest.fn(),
    payments: jest.fn().mockResolvedValue([]),
    entriesByIds: jest.fn().mockResolvedValue([]),
    reconciliations: jest.fn().mockResolvedValue([]),
    movementExists: jest.fn(),
    reconcile: jest.fn(),
    createAttachment: jest.fn(),
    attachments: jest.fn().mockResolvedValue([]),
    attachment: jest.fn(),
    updateEntry: jest.fn(),
    deleteEntry: jest.fn(),
    receipts: jest.fn().mockResolvedValue([]),
    pendingInstallments: jest.fn().mockResolvedValue([]),
    suppliersByIds: jest.fn().mockResolvedValue([]),
    supplierById: jest.fn(),
    suppliers: jest.fn().mockResolvedValue([]),
    customersByIds: jest.fn().mockResolvedValue([]),
    ordersByIds: jest.fn().mockResolvedValue([]),
    vehiclesByIds: jest.fn().mockResolvedValue([]),
    customerById: jest.fn(),
    createSupplier: jest.fn(),
    updateSupplier: jest.fn(),
    deleteSupplier: jest.fn(),
  };
  const audit = { record: jest.fn() };
  return { manager: new FinancialManager(repository as never, audit as never), repository, audit };
}

describe('FinancialManager', () => {
  it('creates a monthly series with month-end dates kept within each month', async () => {
    const { manager, repository } = buildManager();
    repository.categoryById.mockResolvedValue({ id: 'cat', name: 'Aluguel', type: 'EXPENSE' });
    repository.supplierById.mockResolvedValue({ id: 'supplier', name: 'Locador', status: 'ACTIVE' });
    repository.createRecurringEntries.mockResolvedValue({ id: 'first', categoryId: 'cat', type: 'EXPENSE', description: 'Aluguel (1/3)', amountCents: 1000, dueAt: new Date('2026-01-31T12:00:00Z'), status: 'PENDING', paidAt: null, notes: null });
    await manager.createEntry(user, { categoryId: 'cat', supplierId: 'supplier', type: 'EXPENSE', description: 'Aluguel', amountCents: 1000, dueAt: '2026-01-31T12:00:00Z', recurrenceMonths: 3 });
    const inputs = repository.createRecurringEntries.mock.calls[0][0];
    expect(inputs.map((item: { dueAt: Date }) => item.dueAt.toISOString().slice(0, 10))).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
  it('rejects a forged attachment before storing it', async () => {
    const { manager, repository } = buildManager();
    repository.entryById.mockResolvedValue({ id: 'e1' });
    await expect(manager.uploadAttachment(user, { entryId: 'e1', name: 'comprovante.pdf', mimeType: 'application/pdf', dataBase64: Buffer.from('not a PDF').toString('base64') })).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(repository.createAttachment).not.toHaveBeenCalled();
  });
  it('does not reconcile an unknown movement', async () => {
    const { manager, repository } = buildManager();
    repository.movementExists.mockResolvedValue(false);
    await expect(manager.reconcileMovement(user, { source: 'PAYMENT', sourceId: 'missing', bankReference: 'EXTRATO-1' })).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND });
    expect(repository.reconcile).not.toHaveBeenCalled();
  });
  it('keeps the unpaid balance after a partial payment and counts only the payment as cash', async () => {
    const { manager, repository } = buildManager();
    const dueAt = new Date('2026-10-20T12:00:00Z');
    repository.entries.mockResolvedValue([{ id: 'e1', categoryId: 'c1', type: 'EXPENSE', description: 'Aluguel', amountCents: 10000, paidCents: 4000, paymentManaged: true, dueAt, status: 'PENDING', paidAt: null, notes: null }]);
    repository.payments.mockResolvedValue([{ id: 'p1', entryId: 'e1', amountCents: 4000, paidAt: new Date('2026-10-22T12:00:00Z'), method: 'PIX' }]);
    repository.entriesByIds.mockResolvedValue([{ id: 'e1', categoryId: 'c1', type: 'EXPENSE', description: 'Aluguel', amountCents: 10000, paidCents: 4000, dueAt, status: 'PENDING', paidAt: null, notes: null }]);
    const result = await manager.cashFlow({ startAt: '2026-10-01T03:00:00Z', endAt: '2026-11-01T03:00:00Z' });
    expect(result.realizedExpenseCents).toBe(4000);
    expect(result.projectedExpenseCents).toBe(6000);
    expect(result.entries.find(entry => entry.id === 'p1')).toMatchObject({ source: 'PAYMENT', parentEntryId: 'e1', amountCents: 4000 });
  });

  it('rejects a payment above the remaining balance', async () => {
    const { manager, repository } = buildManager();
    repository.entryById.mockResolvedValue({ id: 'e1', amountCents: 10000, paidCents: 8000, status: 'PENDING' });
    await expect(manager.addPayment(user, { id: 'e1', amountCents: 3000, paidAt: '2026-10-20T12:00:00Z' })).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(repository.addPayment).not.toHaveBeenCalled();
  });
  it('does not settle an already realized entry again', async () => {
    const { manager, repository } = buildManager();
    repository.entryById.mockResolvedValue({ id: 'entry-1', status: 'PAID' });
    await expect(manager.settleEntry(user, 'entry-1')).rejects.toMatchObject({ status: HttpStatus.CONFLICT });
    expect(repository.settleEntry).not.toHaveBeenCalled();
  });

  it('requires a reason when reversing a realized entry', async () => {
    const { manager, repository } = buildManager();
    repository.entryById.mockResolvedValue({ id: 'entry-1', status: 'PAID', amountCents: 1000 });
    await expect(manager.deleteEntry(user, 'entry-1')).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(repository.deleteEntry).not.toHaveBeenCalled();
    await manager.deleteEntry(user, 'entry-1', 'Cobrança duplicada');
    expect(repository.deleteEntry).toHaveBeenCalledWith('entry-1');
  });
  it('rejects an entry whose category has a different nature', async () => {
    const { manager, repository } = buildManager();
    repository.categoryById.mockResolvedValue({ id: 'cat-1', type: 'EXPENSE' });
    await expect(manager.createEntry(user, {
      categoryId: 'cat-1', type: 'INCOME', description: 'Venda', amountCents: 1000, dueAt: '2026-07-30T12:00:00Z',
    })).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
  });

  it('requires an active supplier for accounts payable', async () => {
    const { manager, repository } = buildManager();
    repository.categoryById.mockResolvedValue({ id: 'cat-1', type: 'EXPENSE' });
    await expect(manager.createEntry(user, {
      categoryId: 'cat-1', type: 'EXPENSE', description: 'Compra de peças', amountCents: 1000, dueAt: '2026-07-30T12:00:00Z',
    })).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(repository.createEntry).not.toHaveBeenCalled();
  });

  it('requires an existing customer for accounts receivable', async () => {
    const { manager, repository } = buildManager();
    repository.categoryById.mockResolvedValue({ id: 'cat-1', type: 'INCOME' });
    await expect(manager.createEntry(user, {
      categoryId: 'cat-1', type: 'INCOME', description: 'Receita avulsa', amountCents: 1000, dueAt: '2026-07-30T12:00:00Z',
    })).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
    expect(repository.createEntry).not.toHaveBeenCalled();
  });

  it('calculates realized and projected cash without treating projections as cash', async () => {
    const { manager, repository } = buildManager();
    repository.entries.mockResolvedValue([
      { id: 'e1', categoryId: 'c1', type: 'EXPENSE', description: 'Aluguel', amountCents: 3000, dueAt: new Date(), status: 'PAID', paidAt: new Date(), notes: null },
      { id: 'e2', categoryId: 'c1', type: 'EXPENSE', description: 'Energia', amountCents: 1000, dueAt: new Date(), status: 'PENDING', paidAt: null, notes: null },
    ]);
    repository.categories.mockResolvedValue([{ id: 'c1', name: 'Estrutura', type: 'EXPENSE', group: 'Despesas fixas', color: null, isSystem: false }]);
    repository.receipts.mockResolvedValue([{ id: 'r1', serviceOrderId: 'so1', amountCents: 10000, receivedAt: new Date(), method: 'PIX', notes: 'Recebimento conferido' }]);
    repository.ordersByIds.mockResolvedValue([{ id: 'so1', orderNumber: 8, customerId: 'customer-1', vehicleId: 'vehicle-1' }]);
    repository.customersByIds.mockResolvedValue([{ id: 'customer-1', name: 'Maria' }]);
    repository.vehiclesByIds.mockResolvedValue([{ id: 'vehicle-1', plate: 'ABC1D23' }]);
    repository.pendingInstallments.mockResolvedValue([{ id: 'i1', serviceOrderId: 'so2', installmentNumber: 1, installmentCount: 2, amountCents: 5000, dueAt: new Date(), status: 'PENDING' }]);

    const result = await manager.cashFlow({ startAt: '2026-07-01T00:00:00Z', endAt: '2026-08-01T00:00:00Z' });
    expect(result.realizedBalanceCents).toBe(7000);
    expect(result.projectedBalanceCents).toBe(11000);
    expect(result.entries.find(entry => entry.id === 'r1')).toMatchObject({ serviceOrderNumber: 8, customerName: 'Maria', vehiclePlate: 'ABC1D23', paymentMethod: 'PIX', notes: 'Recebimento conferido' });
  });

  it('uses the realization basis without including pending installments and rejects conflicting or invalid periods', async () => {
    const { manager, repository } = buildManager();
    await manager.cashFlow({ startAt: '2026-10-01T03:00:00Z', endAt: '2026-11-01T03:00:00Z', dateField: 'PAID' });
    expect(repository.entries).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), expect.any(Object), 'PAID');
    expect(repository.pendingInstallments).not.toHaveBeenCalled();
    await expect(manager.cashFlow({ startAt: '2026-10-01T03:00:00Z', endAt: '2026-11-01T03:00:00Z', dateField: 'PAID', status: 'PENDING' })).rejects.toThrow('apenas pagamentos');
    await expect(manager.cashFlow({ startAt: '2026-11-01T03:00:00Z', endAt: '2026-10-01T03:00:00Z' })).rejects.toThrow('período financeiro válido');
  });
});
