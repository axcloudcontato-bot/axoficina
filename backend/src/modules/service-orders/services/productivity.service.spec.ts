import type { PrismaClient, ServiceOrder } from '@oficina/database';
import { ProductivityService } from './productivity.service';
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
      serviceOrderWorkSession: { findFirst: jest.fn().mockResolvedValue({ id: 'already-open' }), create: jest.fn() },
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
});
