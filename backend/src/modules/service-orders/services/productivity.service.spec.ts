import type { PrismaClient, ServiceOrder } from '@oficina/database';
import { availableMinutes, countedMinutes, ProductivityService, sessionCutoff } from './productivity.service';
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
      serviceOrderWarrantyReturn: { findMany: jest.fn().mockResolvedValue([]) }, technicianIdleSession: { findMany: jest.fn().mockResolvedValue([]) },
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
    const query = jest.fn().mockResolvedValue([{ id: 'order', orderNumber: 8, deliveredAt: new Date('2026-07-05T12:00:00Z'), laborCents: 5000, workedMinutes: 90, estimated: false, total: 35n, standardMinutes: 60, orderWorkedMinutes: 120n }]);
    const service = new ProductivityService({ client: { $queryRaw: query } } as unknown as PrismaService);
    const result = await service.orders({ startAt: '2026-07-01T03:00:00Z', endAt: '2026-08-01T03:00:00Z', technicianId: 'tech', offset: 20, limit: 20 }, 'tenant');
    expect(result).toEqual({ items: [{ id: 'order', orderNumber: 8, deliveredAt: '2026-07-05T12:00:00.000Z', laborCents: 5000, workedMinutes: 90, estimated: false, standardMinutes: 60, orderWorkedMinutes: 120 }], total: 35, offset: 20, limit: 20 });
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
      technicianIdleSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
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
    const service = new ProductivityService({ client: { technicianIdleSession: { findFirst: jest.fn().mockResolvedValue(null) } } } as unknown as PrismaService);
    jest.spyOn(service, 'report').mockResolvedValue({ startAt: '', endAt: '', totals: {} as never, items: [{ technicianId: 'me', technicianName: 'Eu', completedCount: 3, workedMinutes: 600, activeOrders: 1, estimatedCount: 0, laborRevenueCents: 90000, target: { completedCount: 10, workedMinutes: 9000, laborRevenueCents: 500000 } } as never] });
    const mine = await service.mine({ startAt: '', endAt: '' }, { userId: 'me', tenantId: 'tenant' } as never, false);
    expect(mine).toEqual({ completedCount: 3, workedMinutes: 600, activeOrders: 1, estimatedCount: 0, target: { completedCount: 10, workedMinutes: 9000 }, efficiencyPercent: undefined, reworkCount: undefined, idleMinutes: undefined, idle: null });
    expect(JSON.stringify(mine)).not.toContain('Cents');
  });

  it('counts the open hours of the work days in a period', () => {
    // October 2026 in São Paulo: Monday to Saturday, 8h to 18h -> 27 days of 10 hours
    expect(availableMinutes(new Date('2026-10-01T03:00:00Z'), new Date('2026-11-01T03:00:00Z'), { openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5, 6] })).toBe(27 * 600);
    expect(availableMinutes(new Date('2026-10-01T03:00:00Z'), new Date('2026-10-02T03:00:00Z'), { openHour: 8, closeHour: 18, workDays: [4] })).toBe(600);
  });

  it('measures efficiency, value per hour and occupancy from recorded time and the catalog standard time', async () => {
    const deliveredAt = new Date('2026-10-05T15:00:00Z');
    const client = {
      serviceOrder: { findMany: jest.fn().mockResolvedValueOnce([{ id: 'o1', orderNumber: 1, technicianId: 'a', closedAt: deliveredAt, discountCents: 0 }, { id: 'o2', orderNumber: 2, technicianId: 'a', closedAt: deliveredAt, discountCents: 0 }]).mockResolvedValueOnce([]) },
      serviceOrderProductivityShare: { findMany: jest.fn().mockResolvedValue([
        { serviceOrderId: 'o1', technicianId: 'a', laborCents: 12000, workedMinutes: 60, basis: 'RECORDED', deliveredAt },
        { serviceOrderId: 'o1', technicianId: 'b', laborCents: 12000, workedMinutes: 60, basis: 'RECORDED', deliveredAt },
        { serviceOrderId: 'o2', technicianId: 'a', laborCents: 6000, workedMinutes: 40, basis: 'RECORDED', deliveredAt },
      ]) },
      role: { findMany: jest.fn().mockResolvedValue([]) },
      technicianProductivityTarget: { findMany: jest.fn().mockResolvedValue([]) },
      // o1 has 3 hours of standard labor; o2 has a labor line without standard time, so it stays out of efficiency
      serviceOrderItem: { findMany: jest.fn().mockResolvedValue([
        { serviceOrderId: 'o1', quantity: 1, catalogItemId: 'c1' }, { serviceOrderId: 'o1', quantity: 2, catalogItemId: 'c2' },
        { serviceOrderId: 'o2', quantity: 1, catalogItemId: 'c1' }, { serviceOrderId: 'o2', quantity: 1, catalogItemId: null },
      ]) },
      catalogItem: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', standardMinutes: 60 }, { id: 'c2', standardMinutes: 60 }]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bruno' }]) },
      serviceOrderWorkSession: { findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([
        { technicianId: 'a', startedAt: new Date('2026-10-05T12:00:00Z'), endedAt: new Date('2026-10-05T14:00:00Z') },
      ]) },
      serviceOrderWarrantyReturn: { findMany: jest.fn().mockResolvedValue([]) }, technicianIdleSession: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const unscoped = { tenant: { findFirst: jest.fn().mockResolvedValue({ agendaOpenHour: 8, agendaCloseHour: 18, agendaWorkDays: [1, 2, 3, 4, 5, 6], laborRateCents: 10000 }) } };
    const service = new ProductivityService({ client, unscoped } as unknown as PrismaService);
    const report = await service.report({ startAt: '2026-10-01T03:00:00Z', endAt: '2026-11-01T03:00:00Z' }, 'tenant', new Date('2026-12-01T12:00:00Z'));
    const ana = report.items.find(item => item.technicianId === 'a');
    // half of o1's 180 standard minutes in 60 recorded minutes
    expect(ana).toMatchObject({ soldMinutes: 90, efficiencyBaseMinutes: 60, efficiencyPercent: 150, valuePerHourCents: 10800, sessionMinutes: 120, occupancyPercent: 1 });
    expect(report.items.find(item => item.technicianId === 'b')).toMatchObject({ efficiencyPercent: 150, sessionMinutes: 0, occupancyPercent: 0 });
    expect(report).toMatchObject({ availableMinutes: 27 * 600, laborRateCents: 10000, totals: { soldMinutes: 180, efficiencyBaseMinutes: 120, efficiencyPercent: 150 } });
  });

  it('returns six months of team totals, filling the empty ones', async () => {
    const query = jest.fn().mockResolvedValue([{ month: '2026-09', completedCount: 4n, laborCents: 50000n, workedMinutes: 300n }]);
    const service = new ProductivityService({ client: { $queryRaw: query } } as unknown as PrismaService);
    const result = await service.trend({ month: '2026-10' }, 'tenant');
    expect(result.months.map(month => month.month)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(result.months[4]).toEqual({ month: '2026-09', completedCount: 4, laborRevenueCents: 50000, workedMinutes: 300 });
    expect(result.months[5]).toEqual({ month: '2026-10', completedCount: 0, laborRevenueCents: 0, workedMinutes: 0 });
    expect(query.mock.calls[0].slice(1)).toContain('tenant');
  });

  it('puts a warranty return on every technician of the original order', async () => {
    const client = {
      serviceOrderProductivityShare: { findMany: jest.fn().mockResolvedValue([{ serviceOrderId: 'o1', technicianId: 'a' }, { serviceOrderId: 'o1', technicianId: 'b' }]) },
      serviceOrder: { findMany: jest.fn().mockResolvedValue([{ id: 'o1', technicianId: 'a' }, { id: 'o2', technicianId: 'c' }]) },
    };
    const service = new ProductivityService({ client } as unknown as PrismaService);
    const rework = await (service as unknown as { reworkByTechnician: (ids: string[]) => Promise<Map<string, number>> }).reworkByTechnician(['o1', 'o2', 'o1']);
    expect(Object.fromEntries(rework)).toEqual({ a: 2, b: 2, c: 1 });
  });

  it('offers only delivered orders of the vehicle still under warranty when this one was opened', async () => {
    const opened = new Date('2026-10-20T12:00:00Z');
    const client = {
      serviceOrder: {
        findFirst: jest.fn().mockResolvedValue({ id: 'new', vehicleId: 'v1', createdAt: opened }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'covered', orderNumber: 7, closedAt: new Date('2026-10-01T12:00:00Z'), warrantyDays: 90, technicianId: 'a' },
          { id: 'expired', orderNumber: 3, closedAt: new Date('2026-06-01T12:00:00Z'), warrantyDays: 30, technicianId: 'a' },
        ]),
      },
      serviceOrderWarrantyReturn: { findFirst: jest.fn().mockResolvedValue(null), deleteMany: jest.fn(), create: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 'a', name: 'Ana' }]) },
    };
    const service = new ProductivityService({ client, transaction: (fn: (arg: unknown) => Promise<unknown>) => fn(client) } as unknown as PrismaService);
    const result = await service.warrantyReturn('new');
    expect(result.candidates).toEqual([{ id: 'covered', orderNumber: 7, deliveredAt: '2026-10-01T12:00:00.000Z', warrantyDays: 90, technicianName: 'Ana' }]);
    await expect(service.markWarrantyReturn({ serviceOrderId: 'new', originalOrderId: 'expired' }, { userId: 'm', tenantId: 'tenant' } as never)).rejects.toThrow('ainda estava na garantia');
    await service.markWarrantyReturn({ serviceOrderId: 'new', originalOrderId: 'covered', reason: ' Barulho voltou ' }, { userId: 'm', tenantId: 'tenant' } as never);
    expect(client.serviceOrderWarrantyReturn.create).toHaveBeenCalledWith({ data: { tenantId: 'tenant', serviceOrderId: 'new', originalOrderId: 'covered', reason: 'Barulho voltou', createdBy: 'm' } });
  });

  it('pays the commission on labor with the bonus only when the labor target is reached', async () => {
    const client = { technicianCommissionRule: { findMany: jest.fn().mockResolvedValue([{ technicianId: 'a', laborPercentBp: 1000, bonusPercentBp: 500 }, { technicianId: 'b', laborPercentBp: 1000, bonusPercentBp: 500 }]) } };
    const service = new ProductivityService({ client } as unknown as PrismaService);
    const item = (id: string, labor: number, target: number) => ({ technicianId: id, technicianName: id, laborRevenueCents: labor, reworkCount: 0, target: { completedCount: 0, workedMinutes: 0, laborRevenueCents: target } });
    jest.spyOn(service, 'report').mockResolvedValue({ items: [item('a', 100000, 80000), item('b', 100000, 150000), item('c', 50000, 0)] } as never);
    const result = await service.commissions({ startAt: '2026-10-01T03:00:00Z', endAt: '2026-11-01T03:00:00Z' }, 'tenant');
    expect(result.month).toBe('2026-10');
    expect(result.items.map(entry => [entry.technicianId, entry.commissionCents, entry.targetReached])).toEqual([['a', 15000, true], ['b', 10000, false], ['c', 0, false]]);
    expect(result.items[2].laborPercentBp).toBeNull();
    expect(result.totalCents).toBe(25000);
  });

  it('does not let a technician log idle time while working on an order', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      serviceOrderWorkSession: { findFirst: jest.fn().mockResolvedValue({ id: 'w', serviceOrderId: 'o', startedAt: new Date('2026-10-29T12:00:00Z') }), updateMany: jest.fn() },
      serviceOrder: { findFirst: jest.fn().mockResolvedValue({ orderNumber: 41 }) },
      technicianIdleSession: { updateMany: jest.fn(), create: jest.fn() },
      tenant: { findFirst: jest.fn().mockResolvedValue({ agendaCloseHour: 18 }) },
    };
    const service = new ProductivityService({ unscoped: tx, transaction: (fn: (arg: unknown) => Promise<unknown>) => fn(tx) } as unknown as PrismaService);
    await expect(service.startIdle({ reason: 'CLEANING' }, { userId: 'tech', tenantId: 'tenant' } as never, new Date('2026-10-29T13:00:00Z'))).rejects.toThrow('OS #41');
    expect(tx.technicianIdleSession.create).not.toHaveBeenCalled();
  });

  it('switches the idle reason by closing the open one and counts today', async () => {
    const now = new Date('2026-10-29T15:00:00Z');
    const tx = {
      $executeRaw: jest.fn(),
      serviceOrderWorkSession: { findFirst: jest.fn().mockResolvedValue(null) },
      technicianIdleSession: { updateMany: jest.fn(), create: jest.fn() },
    };
    const client = { technicianIdleSession: { findMany: jest.fn().mockResolvedValue([
      { id: 'i2', reason: 'WAITING_PARTS', note: null, startedAt: now, endedAt: null },
      { id: 'i1', reason: 'CLEANING', note: null, startedAt: new Date('2026-10-29T14:30:00Z'), endedAt: now },
    ]) } };
    const unscoped = { tenant: { findFirst: jest.fn().mockResolvedValue({ agendaCloseHour: 18 }) } };
    const service = new ProductivityService({ client, unscoped, transaction: (fn: (arg: unknown) => Promise<unknown>) => fn(tx) } as unknown as PrismaService);
    const result = await service.startIdle({ reason: 'WAITING_PARTS' }, { userId: 'tech', tenantId: 'tenant' } as never, now);
    expect(tx.technicianIdleSession.updateMany).toHaveBeenCalledWith({ where: { technicianId: 'tech', endedAt: null }, data: { endedAt: now } });
    expect(tx.technicianIdleSession.create).toHaveBeenCalledWith({ data: { tenantId: 'tenant', technicianId: 'tech', reason: 'WAITING_PARTS', note: null, startedAt: now } });
    expect(result.open).toMatchObject({ id: 'i2', minutes: 0 });
    expect(result.today.map(entry => [entry.id, entry.minutes])).toEqual([['i2', 0], ['i1', 30]]);
  });

  it('stops a Saturday timer at noon and leaves holidays out of the open hours', () => {
    const agenda = { openHour: 8, closeHour: 18, workDays: [1, 2, 3, 4, 5, 6], dayHours: { '6': { openHour: 8, closeHour: 12 } }, closedDates: ['2026-10-02'] };
    // Saturday 31/10 at 09:00 in São Paulo: counts until 12:00
    expect(sessionCutoff(new Date('2026-10-31T12:00:00Z'), agenda)).toEqual(new Date('2026-10-31T15:00:00Z'));
    // Friday 30/10: the usual 18:00
    expect(sessionCutoff(new Date('2026-10-30T12:00:00Z'), agenda)).toEqual(new Date('2026-10-30T21:00:00Z'));
    // 1 to 3 October: Thursday 10 h, Friday closed (holiday), Saturday 4 h
    expect(availableMinutes(new Date('2026-10-01T03:00:00Z'), new Date('2026-10-04T03:00:00Z'), agenda)).toBe(14 * 60);
  });
});
