import type { PrismaClient, ServiceOrder } from '@oficina/database';
import { countedMinutes, ProductivityService, sessionCutoff } from './productivity.service';
import { PrismaService } from '../../../shared/prisma/prisma.service';

describe('ProductivityService', () => {
  it('freezes discounted labor by recorded time when an order is delivered', async () => {
    const create = jest.fn().mockResolvedValue({});
    const tx = {
      serviceOrderWorkSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([
          { technicianId: 'a', startedAt: new Date('2026-07-01T10:00:00Z'), endedAt: new Date('2026-07-01T11:00:00Z') },
          { technicianId: 'b', startedAt: new Date('2026-07-01T11:00:00Z'), endedAt: new Date('2026-07-01T11:30:00Z') },
        ]),
      },
      serviceOrderItem: { findMany: jest.fn().mockResolvedValue([
        { type: 'LABOR', quantity: 1, unitPriceCents: 9000 },
        { type: 'PART', quantity: 1, unitPriceCents: 1000 },
      ]) },
      serviceOrderProductivityShare: { create },
      tenant: { findFirst: jest.fn().mockResolvedValue({ agendaCloseHour: 18 }) },
    };
    const service = new ProductivityService({} as PrismaService);
    await service.captureDelivery(tx as unknown as PrismaClient, { id: 'order', tenantId: 'tenant', discountCents: 1000 } as ServiceOrder, new Date('2026-07-01T12:00:00Z'));
    expect(create.mock.calls.map(([input]) => input.data)).toEqual([
      expect.objectContaining({ technicianId: 'a', laborCents: 5400, workedMinutes: 60, basis: 'RECORDED' }),
      expect.objectContaining({ technicianId: 'b', laborCents: 2700, workedMinutes: 30, basis: 'RECORDED' }),
    ]);
  });

  it('keeps historical disabled technicians and unassigned orders in the totals', async () => {
    const client = {
      serviceOrder: { findMany: jest.fn().mockResolvedValueOnce([
        { id: 'old', orderNumber: 1, technicianId: 'disabled', closedAt: new Date('2026-07-05T12:00:00Z'), discountCents: 0 },
        { id: 'none', orderNumber: 2, technicianId: null, closedAt: new Date('2026-07-05T13:00:00Z'), discountCents: 0 },
      ]).mockResolvedValueOnce([]) },
      serviceOrderProductivityShare: { findMany: jest.fn().mockResolvedValue([]) },
      role: { findMany: jest.fn().mockResolvedValue([]) },
      technicianProductivityTarget: { findMany: jest.fn().mockResolvedValue([]) },
      serviceOrderItem: { findMany: jest.fn().mockResolvedValue([{ serviceOrderId: 'old', type: 'LABOR', quantity: 1, unitPriceCents: 5000 }]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'disabled', name: 'Técnico antigo' }]) },
      serviceOrderWorkSession: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ProductivityService({ client } as unknown as PrismaService);
    const report = await service.report({ startAt: '2026-07-01T03:00:00Z', endAt: '2026-08-01T03:00:00Z' });
    expect(report.items[0]).toMatchObject({ technicianName: 'Técnico antigo', completedCount: 1, estimatedCount: 1, laborRevenueCents: 5000 });
    expect(report.totals).toMatchObject({ completedCount: 2, unassignedCount: 1, laborRevenueCents: 5000, estimatedCount: 2 });
  });

  it('serializes starting work and rejects a second active session', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1), $queryRaw: jest.fn().mockResolvedValue([{ id: 'order' }]),
      serviceOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'order', tenantId: 'tenant', status: 'IN_PROGRESS' }) },
      serviceOrderWorkSession: { findFirst: jest.fn().mockResolvedValue({ id: 'already-open', startedAt: new Date() }), create: jest.fn(), updateMany: jest.fn() },
      tenant: { findFirst: jest.fn().mockResolvedValue({ agendaCloseHour: 18 }) },
    };
    const client = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'mechanic', roleId: 'role' }) }, role: { findFirst: jest.fn().mockResolvedValue({ baseRole: 'MECHANIC' }) } };
    const service = new ProductivityService({ client, transaction: (fn: (arg: PrismaClient) => Promise<unknown>) => fn(tx as unknown as PrismaClient) } as unknown as PrismaService);
    await expect(service.start('order', { userId: 'mechanic', tenantId: 'tenant' } as never)).rejects.toThrow('Encerre seu trabalho');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.serviceOrderWorkSession.create).not.toHaveBeenCalled();
  });

  it('reconciles corrected labor while preserving technician shares and recorded time', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'order' }]),
      serviceOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'order', status: 'DELIVERED', discountCents: 1000 }) },
      serviceOrderProductivityShare: { findMany: jest.fn().mockResolvedValue([
        { id: 'a-share', laborCents: 4000, workedMinutes: 60 },
        { id: 'b-share', laborCents: 2000, workedMinutes: 30 },
      ]), updateMany },
      serviceOrderItem: { findMany: jest.fn().mockResolvedValue([
        { type: 'LABOR', quantity: 1, unitPriceCents: 9000 },
        { type: 'PART', quantity: 1, unitPriceCents: 1000 },
      ]) },
    };
    const service = new ProductivityService({ transaction: (fn: (arg: PrismaClient) => Promise<unknown>) => fn(tx as unknown as PrismaClient) } as unknown as PrismaService);
    await expect(service.withDeliveredItemCorrection('order', 'tenant', async () => 'updated')).resolves.toEqual({ result: 'updated', adjustment: { beforeCents: 6000, afterCents: 8100 } });
    expect(updateMany.mock.calls.map(([arg]) => arg)).toEqual([
      { where: { id: 'a-share' }, data: { laborCents: 5400 } },
      { where: { id: 'b-share' }, data: { laborCents: 2700 } },
    ]);
  });

  it('returns one bounded details page with its total', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'order', orderNumber: 8, deliveredAt: new Date('2026-07-05T12:00:00Z'), laborCents: 5000, workedMinutes: 90, estimated: false, total: 35n }]);
    const service = new ProductivityService({ client: { $queryRaw: query } } as unknown as PrismaService);
    const result = await service.orders({ startAt: '2026-07-01T03:00:00Z', endAt: '2026-08-01T03:00:00Z', technicianId: 'tech', offset: 20, limit: 20 }, 'tenant');
    expect(result).toEqual({ items: [{ id: 'order', orderNumber: 8, deliveredAt: '2026-07-05T12:00:00.000Z', laborCents: 5000, workedMinutes: 90, estimated: false }], total: 35, offset: 20, limit: 20 });
    expect(query.mock.calls[0].slice(1)).toContain('tenant');
    expect(query.mock.calls[0].slice(1)).toContain('tech');
    expect(query.mock.calls[0].slice(1)).toContain(20);
  });

  it('stops counting a timer at closing time on the day it started', () => {
    // 09:00 in São Paulo, closing at 18:00 local (21:00 UTC)
    expect(sessionCutoff(new Date('2026-07-01T12:00:00Z'), 18)).toEqual(new Date('2026-07-01T21:00:00Z'));
    // started after closing: counts until local midnight
    expect(sessionCutoff(new Date('2026-07-01T22:00:00Z'), 18)).toEqual(new Date('2026-07-02T03:00:00Z'));
    // forgotten overnight: 9 hours, not 23
    expect(countedMinutes(new Date('2026-07-01T12:00:00Z'), null, new Date('2026-07-02T11:00:00Z'), 18)).toEqual({ minutes: 540, capped: true });
    expect(countedMinutes(new Date('2026-07-01T12:00:00Z'), new Date('2026-07-01T13:30:00Z'), new Date('2026-07-02T11:00:00Z'), 18)).toEqual({ minutes: 90, capped: false });
  });

  it('closes a timer forgotten on a previous day at closing time instead of blocking the technician', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const create = jest.fn().mockResolvedValue({ id: 'new' });
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1), $queryRaw: jest.fn().mockResolvedValue([{ id: 'order' }]),
      serviceOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'order', tenantId: 'tenant', status: 'IN_PROGRESS' }) },
      serviceOrderWorkSession: { findFirst: jest.fn().mockResolvedValue({ id: 'forgotten', startedAt: new Date('2026-07-01T12:00:00Z') }), create, updateMany, findMany: jest.fn().mockResolvedValue([]) },
      tenant: { findFirst: jest.fn().mockResolvedValue({ agendaCloseHour: 18 }) },
    };
    const client = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'mechanic', roleId: 'role' }), findMany: jest.fn().mockResolvedValue([]) }, role: { findFirst: jest.fn().mockResolvedValue({ baseRole: 'MECHANIC' }) }, serviceOrderWorkSession: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new ProductivityService({ client, unscoped: tx, transaction: (fn: (arg: PrismaClient) => Promise<unknown>) => fn(tx as unknown as PrismaClient) } as unknown as PrismaService);
    await service.start('order', { userId: 'mechanic', tenantId: 'tenant' } as never).catch(() => undefined);
    expect(updateMany).toHaveBeenCalledWith({ where: { id: 'forgotten', endedAt: null }, data: { endedAt: new Date('2026-07-01T21:00:00Z') } });
    expect(create).toHaveBeenCalled();
  });

  it('lets a manager fix a timer and splits the frozen labor again by the corrected minutes', async () => {
    const created: unknown[] = [];
    const tx = {
      serviceOrderWorkSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([
          { technicianId: 'a', startedAt: new Date('2026-07-01T12:00:00Z'), endedAt: new Date('2026-07-01T13:00:00Z') },
          { technicianId: 'b', startedAt: new Date('2026-07-01T13:00:00Z'), endedAt: new Date('2026-07-01T16:00:00Z') },
        ]),
      },
      serviceOrderProductivityShare: {
        findMany: jest.fn().mockResolvedValue([{ id: 's1', laborCents: 6000, deliveredAt: new Date('2026-07-01T20:00:00Z') }, { id: 's2', laborCents: 2000, deliveredAt: new Date('2026-07-01T20:00:00Z') }]),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        create: jest.fn(async ({ data }) => { created.push(data); return data; }),
      },
      serviceOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'order', technicianId: 'a' }) },
      tenant: { findFirst: jest.fn().mockResolvedValue({ agendaCloseHour: 18 }) },
    };
    const record = jest.fn();
    const client = {
      serviceOrderWorkSession: { findFirst: jest.fn().mockResolvedValue({ id: 'sb', serviceOrderId: 'order', tenantId: 'tenant', startedAt: new Date('2026-07-01T13:00:00Z'), endedAt: new Date('2026-07-02T11:00:00Z') }), findMany: jest.fn().mockResolvedValue([]) }, serviceOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'order' }) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ProductivityService({ client, unscoped: tx, transaction: (fn: (arg: PrismaClient) => Promise<unknown>) => fn(tx as unknown as PrismaClient) } as unknown as PrismaService, { record } as never);
    const actor = { userId: 'manager', tenantId: 'tenant' } as never;
    await expect(service.correctSession({ sessionId: 'sb', endedAt: '2026-07-01T16:00:00Z', reason: 'ok' }, actor)).rejects.toThrow('Explique');
    await expect(service.correctSession({ sessionId: 'sb', endedAt: '2026-07-01T12:00:00Z', reason: 'Esqueceu ligado' }, actor)).rejects.toThrow('depois do início');
    await service.correctSession({ sessionId: 'sb', endedAt: '2026-07-01T16:00:00Z', reason: 'Esqueceu ligado' }, actor, new Date('2026-07-02T12:00:00Z'));
    expect(tx.serviceOrderWorkSession.updateMany).toHaveBeenCalledWith({ where: { id: 'sb', tenantId: 'tenant' }, data: { startedAt: new Date('2026-07-01T13:00:00Z'), endedAt: new Date('2026-07-01T16:00:00Z') } });
    // 8000 split 60 / 180 minutes: the total is kept
    expect(created).toEqual([
      expect.objectContaining({ technicianId: 'a', laborCents: 2000, workedMinutes: 60, basis: 'RECORDED' }),
      expect.objectContaining({ technicianId: 'b', laborCents: 6000, workedMinutes: 180, basis: 'RECORDED' }),
    ]);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ action: 'productivity.session_corrected', metadata: { reason: 'Esqueceu ligado' } }));
  });

  it('copies last month targets only to technicians who have none yet', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const client = { technicianProductivityTarget: {
      findMany: jest.fn().mockResolvedValueOnce([{ technicianId: 'a', completedTarget: 10, laborCentsTarget: 500000, workedMinutesTarget: 9000 }, { technicianId: 'b', completedTarget: 5, laborCentsTarget: 100000, workedMinutesTarget: 4000 }]).mockResolvedValueOnce([{ technicianId: 'b' }]),
      createMany,
    } };
    const service = new ProductivityService({ client } as unknown as PrismaService);
    await expect(service.copyTargets({ fromMonth: '2026-09', toMonth: '2026-10' }, { userId: 'm', tenantId: 'tenant' } as never)).resolves.toEqual({ copied: 1 });
    expect(createMany.mock.calls[0][0].data).toEqual([{ tenantId: 'tenant', technicianId: 'a', month: '2026-10', completedTarget: 10, laborCentsTarget: 500000, workedMinutesTarget: 9000 }]);
  });

  it('shows a technician their own month without money when they may not see prices', async () => {
    const service = new ProductivityService({} as PrismaService);
    jest.spyOn(service, 'report').mockResolvedValue({ startAt: '', endAt: '', totals: {} as never, items: [{ technicianId: 'me', technicianName: 'Eu', completedCount: 3, workedMinutes: 600, activeOrders: 1, estimatedCount: 0, laborRevenueCents: 90000, target: { completedCount: 10, workedMinutes: 9000, laborRevenueCents: 500000 } } as never] });
    const mine = await service.mine({ startAt: '', endAt: '' }, { userId: 'me', tenantId: 'tenant' } as never, false);
    expect(mine).toEqual({ completedCount: 3, workedMinutes: 600, activeOrders: 1, estimatedCount: 0, target: { completedCount: 10, workedMinutes: 9000 } });
    expect(JSON.stringify(mine)).not.toContain('Cents');
  });
});
