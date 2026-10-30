import { accessStatus } from '@oficina/contracts';
import { monthStart, PlanUsageService } from './plan-usage.service';

const essencial = { plan: 'essencial', planName: 'Essencial', modules: [], limits: { users: 3, ordersPerMonth: 150, photoStorageMb: 5120 }, access: { state: 'active', daysLeft: null, reason: null } };

function build(entitlements: Record<string, unknown>, counts: { users?: number; orders?: number; photoBytes?: number } = {}) {
  const prisma = { unscoped: {
    user: { count: jest.fn().mockResolvedValue(counts.users ?? 0) },
    serviceOrder: { count: jest.fn().mockResolvedValue(counts.orders ?? 0) },
    serviceOrderPhoto: { aggregate: jest.fn().mockResolvedValue({ _sum: { sizeBytes: counts.photoBytes ?? 0 } }) },
  } };
  return { service: new PlanUsageService(prisma as never, { forTenant: jest.fn().mockResolvedValue(entitlements) } as never), prisma };
}

describe('PlanUsageService', () => {
  it('restarts the monthly count at midnight of the 1st in São Paulo', () => {
    expect(monthStart(new Date('2026-10-30T12:00:00Z')).toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(monthStart(new Date('2026-11-01T01:00:00Z')).toISOString()).toBe('2026-10-01T03:00:00.000Z');
  });

  it('measures users, orders of the month and photo storage', async () => {
    const { service } = build(essencial, { users: 2, orders: 40, photoBytes: 3 * 1_048_576 });
    await expect(service.usage('t1')).resolves.toEqual({ users: 2, ordersThisMonth: 40, photoStorageMb: 3 });
  });

  it('refuses a fourth user on the Essencial plan and says why', async () => {
    const { service } = build(essencial, { users: 3 });
    await expect(service.assertCanAdd('t1', 'users')).rejects.toThrow('O plano Essencial permite até 3 usuários');
  });

  it('lets the last order of the month in and refuses the next one', async () => {
    await expect(build(essencial, { orders: 149 }).service.assertCanAdd('t1', 'orders')).resolves.toBeUndefined();
    await expect(build(essencial, { orders: 150 }).service.assertCanAdd('t1', 'orders')).rejects.toThrow('150 ordens de serviço por mês');
  });

  it('refuses photos once the storage is full', async () => {
    await expect(build(essencial, { photoBytes: 5120 * 1_048_576 }).service.assertCanAdd('t1', 'photos')).rejects.toThrow('5 GB de fotos');
  });

  it('does not count anything for an unlimited plan', async () => {
    const { service, prisma } = build({ ...essencial, limits: { users: null, ordersPerMonth: null, photoStorageMb: null } });
    await expect(service.assertCanAdd('t1', 'users')).resolves.toBeUndefined();
    expect(prisma.unscoped.user.count).not.toHaveBeenCalled();
  });

  it('refuses anything new while the account is view-only, with or without a limit', async () => {
    const suspended = { ...essencial, access: { state: 'suspended', daysLeft: null, reason: 'past_due' } };
    await expect(build(suspended).service.assertCanAdd('t1', 'write')).rejects.toThrow('só para consulta');
    await expect(build(suspended).service.assertCanAdd('t1', 'orders')).rejects.toThrow('só para consulta');
  });
});

describe('accessStatus', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  it('keeps paying and not-yet-due accounts fully open', () => {
    expect(accessStatus({ status: 'active', dueAt: null }, now).state).toBe('active');
    expect(accessStatus({ status: 'unconfigured', dueAt: null }, now).state).toBe('active');
    expect(accessStatus({ status: 'trial', dueAt: '2026-11-05T12:00:00Z' }, now).state).toBe('active');
    expect(accessStatus({ status: 'trial', dueAt: null }, now).state).toBe('active');
  });
  it('gives a week of grace after the due date, then goes view-only', () => {
    expect(accessStatus({ status: 'past_due', dueAt: '2026-10-28T12:00:00Z' }, now)).toEqual({ state: 'grace', daysLeft: 5, reason: 'past_due' });
    expect(accessStatus({ status: 'trial', dueAt: '2026-10-29T12:00:00Z' }, now)).toEqual({ state: 'grace', daysLeft: 6, reason: 'trial_ended' });
    expect(accessStatus({ status: 'past_due', dueAt: '2026-10-23T12:00:00Z' }, now).state).toBe('suspended');
  });
  it('suspends a canceled account and warns a late one without a date', () => {
    expect(accessStatus({ status: 'canceled', dueAt: null }, now)).toEqual({ state: 'suspended', daysLeft: null, reason: 'canceled' });
    expect(accessStatus({ status: 'past_due', dueAt: null }, now).state).toBe('grace');
  });
});
