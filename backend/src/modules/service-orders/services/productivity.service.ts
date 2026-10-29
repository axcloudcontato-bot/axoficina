import { HttpStatus, Injectable } from '@nestjs/common';
import type { PrismaClient, ServiceOrder } from '@oficina/database';
import type { TechnicianProductivityRequest, TechnicianProductivityResponse, TechnicianProductivityOrdersRequest, TechnicianProductivityOrdersResponse } from '@oficina/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AppException } from '../../../shared/errors/app-exception';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';

const minutesBetween = (start: Date, end: Date) => Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));

@Injectable()
export class ProductivityService {
  constructor(private readonly prisma: PrismaService, private readonly auditLog?: AuditLogService) {}

  private async order(id: string) {
    const order = await this.prisma.client.serviceOrder.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
    return order;
  }

  async sessions(serviceOrderId: string) {
    await this.order(serviceOrderId);
    const rows = await this.prisma.client.serviceOrderWorkSession.findMany({ where: { serviceOrderId }, orderBy: { startedAt: 'desc' } });
    const users = await this.prisma.client.user.findMany({ where: { id: { in: [...new Set(rows.map(row => row.technicianId))] } }, select: { id: true, name: true } });
    const names = new Map(users.map(user => [user.id, user.name]));
    return { sessions: rows.map(row => ({ id: row.id, technicianId: row.technicianId, technicianName: names.get(row.technicianId) ?? 'Técnico removido', startedAt: row.startedAt.toISOString(), endedAt: row.endedAt?.toISOString() ?? null, workedMinutes: minutesBetween(row.startedAt, row.endedAt ?? new Date()) })) };
  }

  async start(serviceOrderId: string, actor: AuthenticatedUser) {
    const user = await this.prisma.client.user.findFirst({ where: { id: actor.userId, status: 'active', deletedAt: null } });
    const role = user ? await this.prisma.client.role.findFirst({ where: { id: user.roleId, deletedAt: null } }) : null;
    if (role?.baseRole !== 'MECHANIC') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Apenas técnicos podem registrar tempo de trabalho.', HttpStatus.FORBIDDEN);
    await this.prisma.transaction(async tx => {
      // Serializa tentativas simultâneas do mesmo técnico, inclusive em OS diferentes.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.userId}))`;
      // A transição de status também atualiza a linha da OS. O lock evita iniciar
      // trabalho depois da entrega ou da pausa em uma corrida entre requisições.
      await tx.$queryRaw`SELECT id FROM service_orders WHERE id = ${serviceOrderId}::uuid AND tenant_id = ${actor.tenantId}::uuid FOR UPDATE`;
      const order = await tx.serviceOrder.findFirst({ where: { id: serviceOrderId, deletedAt: null } });
      if (!order) throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço não encontrada.', HttpStatus.NOT_FOUND);
      if (order.status !== 'IN_PROGRESS') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Inicie a OS antes de registrar tempo de trabalho.', HttpStatus.BAD_REQUEST);
      const existing = await tx.serviceOrderWorkSession.findFirst({ where: { technicianId: actor.userId, endedAt: null } });
      if (existing) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Encerre seu trabalho em outra OS antes de iniciar esta.', HttpStatus.CONFLICT);
      await tx.serviceOrderWorkSession.create({ data: { tenantId: order.tenantId, serviceOrderId, technicianId: actor.userId, startedAt: new Date() } });
    });
    return this.sessions(serviceOrderId);
  }

  async stop(serviceOrderId: string, actor: AuthenticatedUser) {
    await this.order(serviceOrderId);
    const result = await this.prisma.client.serviceOrderWorkSession.updateMany({ where: { serviceOrderId, technicianId: actor.userId, endedAt: null }, data: { endedAt: new Date() } });
    if (!result.count) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Você não tem uma sessão ativa nesta OS.', HttpStatus.CONFLICT);
    return this.sessions(serviceOrderId);
  }

  async closeSessions(tx: PrismaClient, serviceOrderId: string, endedAt: Date) {
    await tx.serviceOrderWorkSession.updateMany({ where: { serviceOrderId, endedAt: null }, data: { endedAt } });
  }

  async setTarget(input: { technicianId: string; month: string; completedCount: number; laborRevenueCents: number; workedMinutes: number }, actor: AuthenticatedUser) {
    const technician = await this.prisma.client.user.findFirst({ where: { id: input.technicianId, deletedAt: null } });
    const role = technician ? await this.prisma.client.role.findFirst({ where: { id: technician.roleId, deletedAt: null } }) : null;
    if (role?.baseRole !== 'MECHANIC') throw new AppException(AppErrorCode.SERVICE_ORDER_TECHNICIAN_NOT_FOUND, 'Técnico não encontrado.', HttpStatus.NOT_FOUND);
    await this.prisma.client.technicianProductivityTarget.upsert({
      where: { tenantId_technicianId_month: { tenantId: actor.tenantId, technicianId: input.technicianId, month: input.month } },
      create: { tenantId: actor.tenantId, technicianId: input.technicianId, month: input.month, completedTarget: input.completedCount, laborCentsTarget: input.laborRevenueCents, workedMinutesTarget: input.workedMinutes },
      update: { completedTarget: input.completedCount, laborCentsTarget: input.laborRevenueCents, workedMinutesTarget: input.workedMinutes },
    });
    await this.auditLog?.record({ tenantId: actor.tenantId, userId: actor.userId, action: 'productivity.target_set', entity: 'technician_productivity_target', entityId: input.technicianId, metadata: { technicianId: input.technicianId, month: input.month, completedTarget: input.completedCount, laborCentsTarget: input.laborRevenueCents, workedMinutesTarget: input.workedMinutes } });
    return { success: true as const };
  }

  async captureDelivery(tx: PrismaClient, order: ServiceOrder, deliveredAt: Date) {
    await this.closeSessions(tx, order.id, deliveredAt);
    const [sessions, lineItems] = await Promise.all([
      tx.serviceOrderWorkSession.findMany({ where: { serviceOrderId: order.id } }),
      tx.serviceOrderItem.findMany({ where: { serviceOrderId: order.id, deletedAt: null }, select: { type: true, quantity: true, unitPriceCents: true } }),
    ]);
    const gross = lineItems.reduce((sum, item) => sum + Math.round(Number(item.quantity) * item.unitPriceCents), 0);
    const labor = lineItems.filter(item => item.type === 'LABOR').reduce((sum, item) => sum + Math.round(Number(item.quantity) * item.unitPriceCents), 0);
    const netLabor = gross ? Math.max(0, labor - Math.round(Math.min(order.discountCents, gross) * labor / gross)) : 0;
    const byTechnician = new Map<string, number>();
    for (const session of sessions) byTechnician.set(session.technicianId, (byTechnician.get(session.technicianId) ?? 0) + minutesBetween(session.startedAt, session.endedAt ?? deliveredAt));
    const entries = [...byTechnician].filter(([, minutes]) => minutes > 0).sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length) {
      await tx.serviceOrderProductivityShare.create({ data: { tenantId: order.tenantId, serviceOrderId: order.id, technicianId: order.technicianId, laborCents: netLabor, workedMinutes: 0, basis: order.technicianId ? 'ASSIGNED' : 'UNASSIGNED', deliveredAt } });
      return;
    }
    const totalMinutes = entries.reduce((sum, [, minutes]) => sum + minutes, 0);
    let allocated = 0;
    for (const [index, [technicianId, workedMinutes]] of entries.entries()) {
      const laborCents = index === entries.length - 1 ? netLabor - allocated : Math.floor(netLabor * workedMinutes / totalMinutes);
      allocated += laborCents;
      await tx.serviceOrderProductivityShare.create({ data: { tenantId: order.tenantId, serviceOrderId: order.id, technicianId, laborCents, workedMinutes, basis: 'RECORDED', deliveredAt } });
    }
  }

  // Correções justificadas em itens de uma OS entregue atualizam apenas o valor:
  // os técnicos, minutos e a base de atribuição originais continuam congelados.
  async withDeliveredItemCorrection<T>(serviceOrderId: string, tenantId: string, change: (tx: PrismaClient) => Promise<T>): Promise<{ result: T; adjustment: { beforeCents: number; afterCents: number } | null }> {
    return this.prisma.transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM service_orders WHERE id = ${serviceOrderId}::uuid AND tenant_id = ${tenantId}::uuid FOR UPDATE`;
      const order = await tx.serviceOrder.findFirst({ where: { id: serviceOrderId, status: 'DELIVERED', deletedAt: null } });
      if (!order) throw new AppException(AppErrorCode.SERVICE_ORDER_NOT_FOUND, 'Ordem de serviço entregue não encontrada.', HttpStatus.CONFLICT);
      const result = await change(tx);
      const shares = await tx.serviceOrderProductivityShare.findMany({ where: { serviceOrderId }, orderBy: { id: 'asc' } });
      if (!shares.length) return { result, adjustment: null }; // OS antiga: continua identificada como estimativa.
      const lineItems = await tx.serviceOrderItem.findMany({ where: { serviceOrderId, deletedAt: null }, select: { type: true, quantity: true, unitPriceCents: true } });
      const gross = lineItems.reduce((sum, item) => sum + Math.round(Number(item.quantity) * item.unitPriceCents), 0);
      const labor = lineItems.filter(item => item.type === 'LABOR').reduce((sum, item) => sum + Math.round(Number(item.quantity) * item.unitPriceCents), 0);
      const afterCents = gross ? Math.max(0, labor - Math.round(Math.min(order.discountCents, gross) * labor / gross)) : 0;
      const beforeCents = shares.reduce((sum, share) => sum + share.laborCents, 0);
      const weights = shares.map(share => share.workedMinutes);
      const totalMinutes = weights.reduce((sum, value) => sum + value, 0);
      const totalOldCents = beforeCents;
      let allocated = 0;
      for (const [index, share] of shares.entries()) {
        const weight = totalMinutes > 0 ? weights[index] : totalOldCents > 0 ? share.laborCents : index === 0 ? 1 : 0;
        const totalWeight = totalMinutes || totalOldCents || 1;
        const laborCents = index === shares.length - 1 ? afterCents - allocated : Math.floor(afterCents * weight / totalWeight);
        allocated += laborCents;
        await tx.serviceOrderProductivityShare.updateMany({ where: { id: share.id }, data: { laborCents } });
      }
      return { result, adjustment: { beforeCents, afterCents } };
    });
  }

  async orders(request: TechnicianProductivityOrdersRequest, tenantId: string): Promise<TechnicianProductivityOrdersResponse> {
    const start = new Date(request.startAt), end = new Date(request.endAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 366 * 86_400_000) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe um período válido de até 366 dias.', HttpStatus.BAD_REQUEST);
    }
    // A consulta pagina no banco e mantém as OS antigas sem snapshot como estimativas.
    // Todo predicado de tenant é explícito: consultas SQL cruas não passam pela extensão Prisma.
    const rows = await this.prisma.client.$queryRaw<Array<{ id: string; orderNumber: number; deliveredAt: Date; laborCents: number; workedMinutes: number; estimated: boolean; total: bigint }>>`
      WITH entries AS (
        SELECT so.id, so.order_number, so.closed_at, s.labor_cents, s.worked_minutes,
          (s.basis <> 'RECORDED') AS estimated
        FROM service_order_productivity_shares s
        JOIN service_orders so ON so.id = s.service_order_id AND so.tenant_id = s.tenant_id
        WHERE s.tenant_id = ${tenantId}::uuid AND s.technician_id = ${request.technicianId}::uuid
          AND so.status = 'DELIVERED' AND so.deleted_at IS NULL
          AND so.closed_at >= ${start} AND so.closed_at < ${end}
        UNION ALL
        SELECT so.id, so.order_number, so.closed_at,
          GREATEST(0, COALESCE(amounts.labor, 0) -
            CASE WHEN COALESCE(amounts.gross, 0) > 0 THEN ROUND(LEAST(so.discount_cents, amounts.gross) * amounts.labor / amounts.gross) ELSE 0 END)::integer,
          0, true
        FROM service_orders so
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(ROUND(i.quantity * i.unit_price_cents)), 0) AS gross,
            COALESCE(SUM(CASE WHEN i.type = 'LABOR' THEN ROUND(i.quantity * i.unit_price_cents) ELSE 0 END), 0) AS labor
          FROM service_order_items i WHERE i.service_order_id = so.id AND i.deleted_at IS NULL
        ) amounts ON true
        WHERE so.tenant_id = ${tenantId}::uuid AND so.technician_id = ${request.technicianId}::uuid
          AND so.status = 'DELIVERED' AND so.deleted_at IS NULL
          AND so.closed_at >= ${start} AND so.closed_at < ${end}
          AND NOT EXISTS (SELECT 1 FROM service_order_productivity_shares s WHERE s.tenant_id = so.tenant_id AND s.service_order_id = so.id)
      )
      SELECT id, order_number AS "orderNumber", closed_at AS "deliveredAt", labor_cents AS "laborCents",
        worked_minutes AS "workedMinutes", estimated, COUNT(*) OVER() AS total
      FROM entries ORDER BY closed_at DESC, id DESC LIMIT ${request.limit} OFFSET ${request.offset}
    `;
    return { items: rows.map(row => ({ id: row.id, orderNumber: row.orderNumber, deliveredAt: row.deliveredAt.toISOString(), laborCents: row.laborCents, workedMinutes: row.workedMinutes, estimated: row.estimated })), total: rows.length ? Number(rows[0].total) : 0, offset: request.offset, limit: request.limit };
  }

  async report(request: TechnicianProductivityRequest): Promise<TechnicianProductivityResponse> {
    const start = new Date(request.startAt), end = new Date(request.endAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 366 * 86_400_000) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe um período válido de até 366 dias.', HttpStatus.BAD_REQUEST);
    }
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(start);
    const [delivered, active, shares, roles, targets] = await Promise.all([
      this.prisma.client.serviceOrder.findMany({ where: { status: 'DELIVERED', closedAt: { gte: start, lt: end }, deletedAt: null }, select: { id: true, orderNumber: true, technicianId: true, closedAt: true, discountCents: true } }),
      this.prisma.client.serviceOrder.findMany({ where: { status: { in: ['IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED'] }, deletedAt: null }, select: { technicianId: true } }),
      this.prisma.client.serviceOrderProductivityShare.findMany({ where: { deliveredAt: { gte: start, lt: end } } }),
      this.prisma.client.role.findMany({ where: { baseRole: 'MECHANIC', deletedAt: null }, select: { id: true } }),
      this.prisma.client.technicianProductivityTarget.findMany({ where: { month } }),
    ]);
    const covered = new Set(shares.map(share => share.serviceOrderId));
    const legacy = delivered.filter(order => !covered.has(order.id));
    const legacyItems = legacy.length ? await this.prisma.client.serviceOrderItem.findMany({ where: { serviceOrderId: { in: legacy.map(order => order.id) }, deletedAt: null }, select: { serviceOrderId: true, type: true, quantity: true, unitPriceCents: true } }) : [];
    const totalsByOrder = new Map<string, { gross: number; labor: number }>();
    for (const item of legacyItems) {
      const bucket = totalsByOrder.get(item.serviceOrderId) ?? { gross: 0, labor: 0 };
      const cents = Math.round(Number(item.quantity) * item.unitPriceCents);
      bucket.gross += cents; if (item.type === 'LABOR') bucket.labor += cents;
      totalsByOrder.set(item.serviceOrderId, bucket);
    }
    const technicianIds = [...new Set([...shares.map(share => share.technicianId), ...legacy.map(order => order.technicianId), ...active.map(order => order.technicianId)].filter((id): id is string => Boolean(id)))];
    const users = await this.prisma.client.user.findMany({ where: { OR: [{ id: { in: technicianIds } }, { roleId: { in: roles.map(role => role.id) }, status: 'active', deletedAt: null }] }, select: { id: true, name: true } });
    const names = new Map(users.map(user => [user.id, user.name]));
    const targetsByTechnician = new Map(targets.map(target => [target.technicianId, target]));
    const orderById = new Map(delivered.map(order => [order.id, order]));
    const buckets = new Map<string, { completedCount: number; activeOrders: number; workedMinutes: number; estimatedCount: number; laborRevenueCents: number }>();
    const bucketFor = (id: string) => { if (!buckets.has(id)) buckets.set(id, { completedCount: 0, activeOrders: 0, workedMinutes: 0, estimatedCount: 0, laborRevenueCents: 0 }); return buckets.get(id)!; };
    for (const id of names.keys()) bucketFor(id);
    let unassignedCount = 0, unassignedLabor = 0;
    const add = (id: string | null, orderId: string, laborCents: number, workedMinutes: number, estimated: boolean) => {
      const order = orderById.get(orderId); if (!order?.closedAt) return;
      if (!id) { unassignedCount += 1; unassignedLabor += laborCents; return; }
      const bucket = bucketFor(id);
      bucket.completedCount += 1;
      bucket.laborRevenueCents += laborCents; bucket.workedMinutes += workedMinutes; if (estimated) bucket.estimatedCount += 1;
    };
    for (const share of shares) add(share.technicianId, share.serviceOrderId, share.laborCents, share.workedMinutes, share.basis !== 'RECORDED');
    for (const order of legacy) {
      const { gross, labor } = totalsByOrder.get(order.id) ?? { gross: 0, labor: 0 };
      add(order.technicianId, order.id, gross ? Math.max(0, labor - Math.round(Math.min(order.discountCents, gross) * labor / gross)) : 0, 0, true);
    }
    for (const order of active) if (order.technicianId) bucketFor(order.technicianId).activeOrders += 1;
    const items = [...buckets].map(([technicianId, bucket]) => {
      const target = targetsByTechnician.get(technicianId);
      return { technicianId, technicianName: names.get(technicianId) ?? 'Técnico removido', completedCount: bucket.completedCount, laborRevenueCents: bucket.laborRevenueCents, activeOrders: bucket.activeOrders, workedMinutes: bucket.workedMinutes, estimatedCount: bucket.estimatedCount, target: target ? { completedCount: target.completedTarget, laborRevenueCents: target.laborCentsTarget, workedMinutes: target.workedMinutesTarget } : null };
    }).sort((a, b) => b.laborRevenueCents - a.laborRevenueCents || b.completedCount - a.completedCount);
    return { startAt: request.startAt, endAt: request.endAt, items, totals: { completedCount: delivered.length, laborRevenueCents: items.reduce((sum, item) => sum + item.laborRevenueCents, unassignedLabor), workedMinutes: items.reduce((sum, item) => sum + item.workedMinutes, 0), unassignedCount, estimatedCount: items.reduce((sum, item) => sum + item.estimatedCount, 0) + legacy.filter(order => !order.technicianId).length } };
  }
}
