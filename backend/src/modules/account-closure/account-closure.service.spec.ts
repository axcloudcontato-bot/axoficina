import { ConfigService } from '@nestjs/config';
import { UnprocessableEntityException } from '@nestjs/common';
import { AccountClosureService, orderTables, sameName } from './account-closure.service';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const owner = { userId: 'u1', tenantId: TENANT_ID, role: 'ADMIN' as const };
const manager = { userId: 'saas-1', tenantId: 'other', role: 'ADMIN' as const };

function build(options: { tenant?: Record<string, unknown> | null; closed?: Record<string, unknown> | null; stripeEnabled?: boolean; password?: boolean } = {}) {
  const activeTenant = options.tenant === undefined ? { id: TENANT_ID, name: 'Oficina Boa', billingSubscriptionId: null } : options.tenant;
  const closedTenant = options.closed === undefined ? { id: TENANT_ID, name: 'Oficina Boa', closedBy: 'owner', deletedAt: new Date('2026-10-01T12:00:00Z') } : options.closed;
  const raw: string[] = [];
  const params: unknown[] = [];
  const tx = {
    tenant: { update: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]) },
    refreshToken: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
    accountClosure: { create: jest.fn() },
    $executeRawUnsafe: jest.fn(async (sql: string, parameter?: unknown) => { raw.push(sql); params.push(parameter); return 1; }),
  };
  const db = {
    tenant: {
      findFirst: jest.fn(async (args: { where: { deletedAt?: unknown } }) => (args.where.deletedAt === null ? activeTenant : closedTenant)),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: { findFirst: jest.fn().mockResolvedValue({ passwordHash: 'hash' }) },
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    $queryRawUnsafe: jest.fn().mockResolvedValue([{ table_name: 'customers' }, { table_name: 'financial_entries' }, { table_name: 'financial_entry_payments' }, { table_name: 'users' }, { table_name: 'billing_invoices' }]),
  };
  const stripe = { enabled: options.stripeEnabled ?? true, cancelNow: jest.fn() };
  const entitlements = { forget: jest.fn() };
  const passwords = { verify: jest.fn().mockResolvedValue(options.password ?? true) };
  const service = new AccountClosureService({ unscoped: db } as never, new ConfigService({ UPLOAD_DIR: '/tmp/ofix-test-uploads' }), stripe as never, entitlements as never, passwords as never);
  return { service, db, tx, raw, params, stripe, entitlements, passwords };
}

describe('helpers', () => {
  it('compares the typed name without caring about case or the spaces around it', () => {
    expect(sameName('Oficina Boa', '  oficina boa ')).toBe(true);
    expect(sameName('Oficina Boa', 'Oficina Boa 2')).toBe(false);
  });

  it('deletes what points at financial entries before the entries themselves, then everything else in a stable order', () => {
    expect(orderTables(['vehicles', 'financial_entries', 'customers', 'financial_entry_payments', 'financial_entry_attachments'])).toEqual(['financial_entry_payments', 'financial_entry_attachments', 'customers', 'financial_entries', 'vehicles']);
  });
});

describe('AccountClosureService: closing', () => {
  it('needs the administrator password and the workshop name, and changes nothing without them', async () => {
    const wrongPassword = build({ password: false });
    await expect(wrongPassword.service.closeAsOwner(owner, { password: 'x', confirmName: 'Oficina Boa' })).rejects.toThrow('Confirme sua senha');
    expect(wrongPassword.tx.tenant.update).not.toHaveBeenCalled();
    const wrongName = build();
    await expect(wrongName.service.closeAsOwner(owner, { password: 'ok', confirmName: 'Outra Oficina' })).rejects.toThrow('nome digitado não confere');
    expect(wrongName.tx.tenant.update).not.toHaveBeenCalled();
    expect(wrongName.stripe.cancelNow).not.toHaveBeenCalled();
  });

  it('ends the access, keeps the data for 30 days and signs everyone out', async () => {
    const { service, tx, entitlements } = build();
    const before = Date.now();
    const result = await service.closeAsOwner(owner, { password: 'ok', confirmName: ' oficina boa ' });
    const days = (new Date(result.purgeAfter).getTime() - before) / 86_400_000;
    expect(days).toBeGreaterThan(29.99);
    expect(days).toBeLessThan(30.01);
    expect(tx.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: expect.objectContaining({ closedBy: 'owner', closureReason: null, subscriptionStatus: 'canceled', billingSubscriptionId: null, pendingPlan: null, deletedAt: expect.any(Date), purgeAfter: expect.any(Date) }) });
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: { in: ['u1', 'u2'] } } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'account.closed', userId: 'u1', metadata: { closedBy: 'owner' } }) });
    expect(entitlements.forget).toHaveBeenCalledWith(TENANT_ID);
  });

  it('stops the Stripe subscription before closing, so a closed account is never charged again', async () => {
    const { service, stripe, tx } = build({ tenant: { id: TENANT_ID, name: 'Oficina Boa', billingSubscriptionId: 'sub_1' } });
    await service.closeAsOwner(owner, { password: 'ok', confirmName: 'Oficina Boa' });
    expect(stripe.cancelNow).toHaveBeenCalledWith('sub_1');
    expect(stripe.cancelNow.mock.invocationCallOrder[0]).toBeLessThan(tx.tenant.update.mock.invocationCallOrder[0]);
  });

  it('does not close when Stripe cannot stop the subscription, but goes on when it is already gone', async () => {
    const failing = build({ tenant: { id: TENANT_ID, name: 'Oficina Boa', billingSubscriptionId: 'sub_1' } });
    failing.stripe.cancelNow.mockRejectedValue(new UnprocessableEntityException('Erro qualquer do Stripe'));
    await expect(failing.service.closeAsOwner(owner, { password: 'ok', confirmName: 'Oficina Boa' })).rejects.toThrow('Erro qualquer do Stripe');
    expect(failing.tx.tenant.update).not.toHaveBeenCalled();

    const gone = build({ tenant: { id: TENANT_ID, name: 'Oficina Boa', billingSubscriptionId: 'sub_1' } });
    gone.stripe.cancelNow.mockRejectedValue(new UnprocessableEntityException("No such subscription: 'sub_1'"));
    await expect(gone.service.closeAsOwner(owner, { password: 'ok', confirmName: 'Oficina Boa' })).resolves.toHaveProperty('purgeAfter');
    expect(gone.tx.tenant.update).toHaveBeenCalled();
  });

  it('refuses to close a workshop that has a subscription while billing is unavailable', async () => {
    const { service, tx } = build({ tenant: { id: TENANT_ID, name: 'Oficina Boa', billingSubscriptionId: 'sub_1' }, stripeEnabled: false });
    await expect(service.closeAsOwner(owner, { password: 'ok', confirmName: 'Oficina Boa' })).rejects.toThrow('Cancele a assinatura no painel do Stripe');
    expect(tx.tenant.update).not.toHaveBeenCalled();
  });

  it('lets the manager close any workshop with a reason and no password', async () => {
    const { service, tx, db } = build();
    await service.closeAsManager(TENANT_ID, '  Pediu para sair  ', manager);
    expect(db.user.findFirst).not.toHaveBeenCalled();
    expect(tx.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: expect.objectContaining({ closedBy: 'saas_admin', closureReason: 'Pediu para sair' }) });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'saas-1', metadata: { closedBy: 'saas_admin' } }) });
  });

  it('says so when the workshop does not exist or is already closed', async () => {
    const { service } = build({ tenant: null });
    await expect(service.closeAsManager(TENANT_ID, null, manager)).rejects.toThrow('Oficina não encontrada');
  });
});

describe('AccountClosureService: restoring and erasing', () => {
  it('brings a closed workshop back, without reviving its subscription', async () => {
    const { service, tx, entitlements } = build();
    await service.restore(TENANT_ID, manager);
    expect(tx.tenant.update).toHaveBeenCalledWith({ where: { id: TENANT_ID }, data: { deletedAt: null, closedBy: null, closureReason: null, purgeAfter: null } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'account.restored' }) });
    expect(entitlements.forget).toHaveBeenCalledWith(TENANT_ID);
    await expect(build({ closed: null }).service.restore(TENANT_ID, manager)).rejects.toThrow('Não há oficina encerrada');
  });

  it('erases only a closed workshop, and only when its name is typed', async () => {
    const wrongName = build();
    await expect(wrongName.service.purgeAsManager(TENANT_ID, 'Outro')).rejects.toThrow('nome digitado não confere');
    expect(wrongName.raw).toEqual([]);
    await expect(build({ closed: null }).service.purgeAsManager(TENANT_ID, 'Oficina Boa')).rejects.toThrow('Não há oficina encerrada');
  });

  it('erases the rows in a safe order, leaves a record with no personal data, and removes the tenant last', async () => {
    const { service, raw, params, tx, entitlements } = build();
    await service.purgeAsManager(TENANT_ID, 'oficina boa');
    expect(raw[0]).toContain('"service_order_items"');
    expect(raw.slice(0, 3).join(' ')).toContain('service_order_status_history');
    const index = (needle: string) => raw.findIndex((sql) => sql.includes(needle));
    expect(index('"financial_entry_payments" WHERE tenant_id')).toBeLessThan(index('"financial_entries" WHERE tenant_id'));
    expect(index('"billing_invoices" WHERE tenant_id')).toBeGreaterThan(-1);
    expect(index('FROM "users" WHERE tenant_id')).toBeLessThan(index('FROM "tenants"'));
    expect(raw[raw.length - 1]).toBe('DELETE FROM "tenants" WHERE id = $1::uuid');
    // users and tenants are handled on their own, never twice
    expect(raw.filter((sql) => sql.includes('DELETE FROM "users" WHERE tenant_id')).length).toBe(1);
    expect(tx.accountClosure.create).toHaveBeenCalledWith({ data: { tenantId: TENANT_ID, closedBy: 'owner', closedAt: new Date('2026-10-01T12:00:00Z') } });
    expect(entitlements.forget).toHaveBeenCalledWith(TENANT_ID);
    // every statement is bound to this workshop's id
    expect(params.length).toBe(raw.length);
    expect(params.every((parameter) => parameter === TENANT_ID)).toBe(true);
  });

  it('erases the workshops whose 30 days are over and keeps going if one of them fails', async () => {
    const { service, db } = build();
    db.tenant.findMany.mockResolvedValue([{ id: TENANT_ID }, { id: '22222222-2222-4222-8222-222222222222' }]);
    const purge = jest.spyOn(service as unknown as { purge: (id: string) => Promise<void> }, 'purge')
      .mockRejectedValueOnce(new Error('falhou'))
      .mockResolvedValueOnce(undefined);
    await expect(service.purgeDue(new Date('2026-11-05T05:00:00Z'))).resolves.toBe(1);
    expect(purge).toHaveBeenCalledTimes(2);
    expect(db.tenant.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: { not: null }, purgeAfter: { lte: new Date('2026-11-05T05:00:00Z') } } }));
  });
});
