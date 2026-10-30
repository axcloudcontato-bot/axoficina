import { csvCell, WorkshopAccountService } from './workshop-account.service';

const admin = { userId: 'admin-1', tenantId: 'tenant-1', role: 'ADMIN' } as never;

describe('csvCell', () => {
  it('keeps spreadsheets from running a cell as a formula', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+55 11 99999-0000')).toBe("'+55 11 99999-0000");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('-1')).toBe("'-1");
  });

  it('quotes separators and line breaks and leaves empty values empty', () => {
    expect(csvCell('Silva; Filho')).toBe('"Silva; Filho"');
    expect(csvCell('linha 1\nlinha 2')).toBe('"linha 1\nlinha 2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(42)).toBe('42');
  });
});

describe('WorkshopAccountService', () => {
  it('exports customers as a spreadsheet and records who took the data', async () => {
    const client = { customer: { findMany: jest.fn().mockResolvedValue([
      { id: 'c1', name: '=Cliente', type: 'PF', document: '11144477735', email: null, phone: '11999990000', birthDate: new Date('1990-05-01T12:00:00Z'), careMessagesEnabled: true, address: { street: 'Rua A', city: 'São Paulo' }, notes: null, createdAt: new Date('2026-01-02T12:00:00Z'), deletedAt: null },
    ]) } };
    const audit = { record: jest.fn() };
    const service = new WorkshopAccountService({ client } as never, audit as never);
    const file = await service.export('customers', admin);
    expect(file.filename).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(file.content.startsWith('﻿Nome;Tipo;')).toBe(true);
    expect(file.content).toContain("'=Cliente;Pessoa física;11144477735;;11999990000;1990-05-01;Sim;Rua A, São Paulo");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', userId: 'admin-1', action: 'settings.data_exported', metadata: expect.objectContaining({ category: 'customers' }) }));
  });

  it('totals an order from its items minus the discount', async () => {
    const client = {
      serviceOrder: { findMany: jest.fn().mockResolvedValue([{ id: 'o1', orderNumber: 7, status: 'DELIVERED', customerId: 'c1', vehicleId: 'v1', openedAt: new Date('2026-10-01T12:00:00Z'), expectedDeliveryAt: null, closedAt: null, customerComplaint: 'Barulho', diagnosis: null, warrantyDays: 90, discountCents: 1000, paymentMethod: 'PIX', deletedAt: null }]) },
      customer: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', name: 'Ana' }]) },
      vehicle: { findMany: jest.fn().mockResolvedValue([{ id: 'v1', plate: 'ABC1D23', brand: 'VW', model: 'Gol' }]) },
      serviceOrderItem: { findMany: jest.fn().mockResolvedValue([{ serviceOrderId: 'o1', quantity: 2, unitPriceCents: 5000 }, { serviceOrderId: 'o1', quantity: 1, unitPriceCents: 3000 }]) },
    };
    const service = new WorkshopAccountService({ client } as never, { record: jest.fn() } as never);
    const file = await service.export('service-orders', admin);
    expect(file.content).toContain('7;DELIVERED;Ana;ABC1D23;VW Gol;2026-10-01;;;Barulho;;90;10,00;120,00;PIX;');
  });

  it('lists the history of this workshop only, with the name of who acted', async () => {
    const client = {
      auditLog: { findMany: jest.fn().mockResolvedValue([{ id: 'a1', action: 'settings.company_updated', entity: 'tenant', entityId: 't', userId: 'u1', metadata: {}, createdAt: new Date('2026-10-30T12:00:00Z') }, { id: 'a2', action: 'auth.login', entity: 'user', entityId: 'u9', userId: null, metadata: {}, createdAt: new Date('2026-10-30T11:00:00Z') }]), count: jest.fn().mockResolvedValue(2) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1', name: 'Ana' }]) },
    };
    const service = new WorkshopAccountService({ client } as never, { record: jest.fn() } as never);
    const result = await service.history({ offset: 0, limit: 30, actionPrefix: 'settings.' }, admin);
    expect(client.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1', action: { startsWith: 'settings.' } }), take: 30 }));
    expect(result.items.map(item => item.userName)).toEqual(['Ana', null]);
    expect(result.total).toBe(2);
  });

  it('shows the plan without the internal notes', async () => {
    const unscoped = { tenant: { findFirst: jest.fn().mockResolvedValue({ plan: 'pro', subscriptionStatus: 'active', subscriptionAmountCents: 19900, subscriptionCycle: 'monthly', subscriptionDueAt: new Date('2026-11-10T12:00:00Z'), createdAt: new Date('2026-07-24T12:00:00Z') }) } };
    const service = new WorkshopAccountService({ unscoped } as never, { record: jest.fn() } as never);
    const result = await service.subscription(admin);
    expect(result).toEqual({ plan: 'pro', status: 'active', amountCents: 19900, cycle: 'monthly', dueAt: '2026-11-10T12:00:00.000Z', customerSince: '2026-07-24T12:00:00.000Z' });
    expect(unscoped.tenant.findFirst).toHaveBeenCalledWith(expect.objectContaining({ select: expect.not.objectContaining({ subscriptionNotes: true }) }));
  });
});
