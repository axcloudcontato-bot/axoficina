import { HttpStatus, Injectable } from '@nestjs/common';
import type { PrismaClient, ServiceOrder } from '@oficina/database';
import type { CommissionsResponse, MarkWarrantyReturnRequest, MyIdleResponse, SetCommissionRuleRequest, StartIdleRequest, WarrantyReturnResponse, ProductivityTrendRequest, ProductivityTrendResponse, CopyProductivityTargetsRequest, CorrectWorkSessionRequest, MyProductivityResponse, OpenWorkSession, TechnicianProductivityRequest, TechnicianProductivityResponse, TechnicianProductivityOrdersRequest, TechnicianProductivityOrdersResponse } from '@oficina/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { AppException } from '../../../shared/errors/app-exception';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';

const minutesBetween = (start: Date, end: Date) => Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
const DEFAULT_CLOSE_HOUR = 18;
const MAX_SESSION_MINUTES = 16 * 60;

// A timer counts until the workshop closes on the day it started (São Paulo time, UTC-3 all year). Started after
// closing time, it counts until midnight. So a timer left running overnight never turns the night into work.
export function sessionCutoff(startedAt: Date, closeHour: number): Date {
  const local = new Date(startedAt.getTime() - 3 * 3_600_000);
  const [year, month, day] = [local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()];
  const closing = new Date(Date.UTC(year, month, day, closeHour + 3));
  return startedAt < closing ? closing : new Date(Date.UTC(year, month, day + 1, 3));
}

// Open minutes of one technician between start and end: work days times the agenda's open hours (São Paulo time).
export function availableMinutes(start: Date, end: Date, workshop: { openHour: number; closeHour: number; workDays: number[] }): number {
  const perDay = Math.max(0, workshop.closeHour - workshop.openHour) * 60;
  let total = 0;
  for (let day = new Date(start.getTime() - 3 * 3_600_000); day.getTime() + 3 * 3_600_000 < end.getTime(); day = new Date(day.getTime() + 86_400_000)) {
    if (workshop.workDays.includes(day.getUTCDay())) total += perDay;
  }
  return total;
}

const percent = (part: number, whole: number) => whole > 0 ? Math.round(part * 100 / whole) : null;

export function countedMinutes(startedAt: Date, endedAt: Date | null, now: Date, closeHour: number): { minutes: number; capped: boolean } {
  const cutoff = sessionCutoff(startedAt, closeHour);
  const stop = endedAt ?? now;
  return { minutes: minutesBetween(startedAt, stop < cutoff ? stop : cutoff), capped: stop > cutoff };
}

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
    const closeHour = await this.closeHour(rows[0]?.tenantId);
    const now = new Date();
    return { sessions: rows.map(row => { const counted = countedMinutes(row.startedAt, row.endedAt, now, closeHour); return { id: row.id, technicianId: row.technicianId, technicianName: names.get(row.technicianId) ?? 'Técnico removido', startedAt: row.startedAt.toISOString(), endedAt: row.endedAt?.toISOString() ?? null, workedMinutes: counted.minutes, capped: counted.capped }; }) };
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
      const forgotten = existing && countedMinutes(existing.startedAt, null, new Date(), await this.closeHour(order.tenantId, tx)).capped;
      if (existing && forgotten) await tx.serviceOrderWorkSession.updateMany({ where: { id: existing.id, endedAt: null }, data: { endedAt: sessionCutoff(existing.startedAt, await this.closeHour(order.tenantId, tx)) } });
      else if (existing) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Encerre seu trabalho em outra OS antes de iniciar esta.', HttpStatus.CONFLICT);
      await tx.technicianIdleSession.updateMany({ where: { technicianId: actor.userId, endedAt: null }, data: { endedAt: new Date() } });
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

  private async workshop(tenantId: string | undefined) {
    const tenant = tenantId ? await this.prisma.unscoped.tenant.findFirst({ where: { id: tenantId }, select: { agendaOpenHour: true, agendaCloseHour: true, agendaWorkDays: true, laborRateCents: true } }) : null;
    return { openHour: tenant?.agendaOpenHour ?? 8, closeHour: tenant?.agendaCloseHour ?? DEFAULT_CLOSE_HOUR, workDays: tenant?.agendaWorkDays ?? [1, 2, 3, 4, 5, 6], laborRateCents: tenant?.laborRateCents ?? null };
  }

  // Standard minutes per order from the catalog, only when every labor line has one.
  private async standardMinutes(orderIds: string[]): Promise<Map<string, number>> {
    if (!orderIds.length) return new Map();
    const labor = await this.prisma.client.serviceOrderItem.findMany({ where: { serviceOrderId: { in: orderIds }, deletedAt: null, type: 'LABOR' }, select: { serviceOrderId: true, quantity: true, catalogItemId: true } });
    const catalogIds = [...new Set(labor.map(item => item.catalogItemId).filter((id): id is string => Boolean(id)))];
    const catalog = catalogIds.length ? await this.prisma.client.catalogItem.findMany({ where: { id: { in: catalogIds } }, select: { id: true, standardMinutes: true } }) : [];
    const standard = new Map(catalog.map(item => [item.id, item.standardMinutes]));
    const result = new Map<string, number>(), incomplete = new Set<string>();
    for (const item of labor) {
      const minutes = item.catalogItemId ? standard.get(item.catalogItemId) : null;
      if (!minutes) { incomplete.add(item.serviceOrderId); continue; }
      result.set(item.serviceOrderId, (result.get(item.serviceOrderId) ?? 0) + Math.round(Number(item.quantity) * minutes));
    }
    for (const id of incomplete) result.delete(id);
    return result;
  }

  // Team totals of the six months ending in the chosen one. Orders delivered before the timer existed count with
  // their estimated labor and no time.
  async trend(request: ProductivityTrendRequest, tenantId: string): Promise<ProductivityTrendResponse> {
    const [year, month] = request.month.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 6, 1, 3)), end = new Date(Date.UTC(year, month, 1, 3));
    const rows = await this.prisma.client.$queryRaw<Array<{ month: string; completedCount: bigint; laborCents: bigint | null; workedMinutes: bigint | null }>>`
      SELECT to_char(so.closed_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') AS month, COUNT(*) AS "completedCount",
        SUM(COALESCE(sh.labor, GREATEST(0, COALESCE(amounts.labor, 0) -
          CASE WHEN COALESCE(amounts.gross, 0) > 0 THEN ROUND(LEAST(so.discount_cents, amounts.gross) * amounts.labor / amounts.gross) ELSE 0 END))) AS "laborCents",
        SUM(COALESCE(sh.minutes, 0)) AS "workedMinutes"
      FROM service_orders so
      LEFT JOIN LATERAL (
        SELECT SUM(s.labor_cents) AS labor, SUM(s.worked_minutes) AS minutes FROM service_order_productivity_shares s
        WHERE s.tenant_id = so.tenant_id AND s.service_order_id = so.id
      ) sh ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(ROUND(i.quantity * i.unit_price_cents)), 0) AS gross,
          COALESCE(SUM(CASE WHEN i.type = 'LABOR' THEN ROUND(i.quantity * i.unit_price_cents) ELSE 0 END), 0) AS labor
        FROM service_order_items i WHERE i.service_order_id = so.id AND i.deleted_at IS NULL
      ) amounts ON true
      WHERE so.tenant_id = ${tenantId}::uuid AND so.status = 'DELIVERED' AND so.deleted_at IS NULL
        AND so.closed_at >= ${start} AND so.closed_at < ${end}
      GROUP BY 1 ORDER BY 1
    `;
    const byMonth = new Map(rows.map(row => [row.month, row]));
    const months = Array.from({ length: 6 }, (_, index) => { const date = new Date(Date.UTC(year, month - 6 + index, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`; });
    return { months: months.map(key => { const row = byMonth.get(key); return { month: key, completedCount: Number(row?.completedCount ?? 0), laborRevenueCents: Number(row?.laborCents ?? 0), workedMinutes: Number(row?.workedMinutes ?? 0) }; }) };
  }

  private async closeHour(tenantId: string | undefined, client: { tenant: PrismaClient['tenant'] } = this.prisma.unscoped): Promise<number> {
    if (!tenantId) return DEFAULT_CLOSE_HOUR;
    const tenant = await client.tenant.findFirst({ where: { id: tenantId }, select: { agendaCloseHour: true } });
    return tenant?.agendaCloseHour ?? DEFAULT_CLOSE_HOUR;
  }

  // A manager fixes a timer (new times, or removes it). On a delivered order, the labor already frozen for it is split
  // again by the corrected minutes: the total stays, only who gets how much changes.
  async correctSession(input: CorrectWorkSessionRequest, actor: AuthenticatedUser, now = new Date()) {
    const reason = input.reason.trim();
    if (reason.length < 5) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Explique a correção (mínimo 5 caracteres).', HttpStatus.BAD_REQUEST);
    const session = await this.prisma.client.serviceOrderWorkSession.findFirst({ where: { id: input.sessionId, tenantId: actor.tenantId } });
    if (!session) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Registro de tempo não encontrado.', HttpStatus.NOT_FOUND);
    const startedAt = input.startedAt ? new Date(input.startedAt) : session.startedAt;
    const endedAt = input.endedAt ? new Date(input.endedAt) : session.endedAt;
    if (!input.remove) {
      if (!endedAt) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe a hora em que o trabalho terminou.', HttpStatus.BAD_REQUEST);
      if (!(startedAt < endedAt) || endedAt > now) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'O fim precisa ser depois do início e não pode estar no futuro.', HttpStatus.BAD_REQUEST);
      if (minutesBetween(startedAt, endedAt) > MAX_SESSION_MINUTES) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Um registro não pode passar de 16 horas. Divida em mais de um, se for o caso.', HttpStatus.BAD_REQUEST);
    }
    await this.prisma.transaction(async tx => {
      if (input.remove) await tx.serviceOrderWorkSession.deleteMany({ where: { id: session.id, tenantId: actor.tenantId } });
      else await tx.serviceOrderWorkSession.updateMany({ where: { id: session.id, tenantId: actor.tenantId }, data: { startedAt, endedAt } });
      await this.reallocate(tx, session.serviceOrderId, actor.tenantId);
    });
    await this.auditLog?.record({ tenantId: actor.tenantId, userId: actor.userId, action: input.remove ? 'productivity.session_removed' : 'productivity.session_corrected', entity: 'service_order_work_session', entityId: session.id, metadata: { reason } });
    return this.sessions(session.serviceOrderId);
  }

  // Splits the labor already frozen for a delivered order again, by each technician's counted minutes.
  private async reallocate(tx: PrismaClient, serviceOrderId: string, tenantId: string) {
    const shares = await tx.serviceOrderProductivityShare.findMany({ where: { serviceOrderId, tenantId }, orderBy: { id: 'asc' } });
    if (!shares.length) return;
    const order = await tx.serviceOrder.findFirst({ where: { id: serviceOrderId, tenantId } });
    if (!order) return;
    const total = shares.reduce((sum, share) => sum + share.laborCents, 0);
    const deliveredAt = shares[0].deliveredAt;
    const closeHour = await this.closeHour(tenantId, tx);
    const sessions = await tx.serviceOrderWorkSession.findMany({ where: { serviceOrderId, tenantId } });
    const byTechnician = new Map<string, number>();
    for (const session of sessions) byTechnician.set(session.technicianId, (byTechnician.get(session.technicianId) ?? 0) + countedMinutes(session.startedAt, session.endedAt ?? deliveredAt, deliveredAt, closeHour).minutes);
    const entries = [...byTechnician].filter(([, minutes]) => minutes > 0).sort(([a], [b]) => a.localeCompare(b));
    await tx.serviceOrderProductivityShare.deleteMany({ where: { serviceOrderId, tenantId } });
    if (!entries.length) {
      await tx.serviceOrderProductivityShare.create({ data: { tenantId, serviceOrderId, technicianId: order.technicianId, laborCents: total, workedMinutes: 0, basis: order.technicianId ? 'ASSIGNED' : 'UNASSIGNED', deliveredAt } });
      return;
    }
    const totalMinutes = entries.reduce((sum, [, minutes]) => sum + minutes, 0);
    let allocated = 0;
    for (const [index, [technicianId, workedMinutes]] of entries.entries()) {
      const laborCents = index === entries.length - 1 ? total - allocated : Math.floor(total * workedMinutes / totalMinutes);
      allocated += laborCents;
      await tx.serviceOrderProductivityShare.create({ data: { tenantId, serviceOrderId, technicianId, laborCents, workedMinutes, basis: 'RECORDED', deliveredAt } });
    }
  }

  // Targets are per month: this repeats last month's for the technicians who have none yet, so nobody starts a month without one.
  async copyTargets(input: CopyProductivityTargetsRequest, actor: AuthenticatedUser) {
    if (input.fromMonth === input.toMonth) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Escolha meses diferentes.', HttpStatus.BAD_REQUEST);
    const [from, to] = await Promise.all([
      this.prisma.client.technicianProductivityTarget.findMany({ where: { tenantId: actor.tenantId, month: input.fromMonth } }),
      this.prisma.client.technicianProductivityTarget.findMany({ where: { tenantId: actor.tenantId, month: input.toMonth }, select: { technicianId: true } }),
    ]);
    const taken = new Set(to.map(target => target.technicianId));
    const missing = from.filter(target => !taken.has(target.technicianId));
    if (missing.length) {
      await this.prisma.client.technicianProductivityTarget.createMany({ data: missing.map(target => ({ tenantId: actor.tenantId, technicianId: target.technicianId, month: input.toMonth, completedTarget: target.completedTarget, laborCentsTarget: target.laborCentsTarget, workedMinutesTarget: target.workedMinutesTarget })), skipDuplicates: true });
      await this.auditLog?.record({ tenantId: actor.tenantId, userId: actor.userId, action: 'productivity.targets_copied', entity: 'technician_productivity_target', entityId: actor.tenantId, metadata: { month: input.toMonth } });
    }
    return { copied: missing.length };
  }

  // A technician's own month. Money only when the person may see prices.
  async mine(request: TechnicianProductivityRequest, actor: AuthenticatedUser, canViewPrices: boolean): Promise<MyProductivityResponse> {
    const report = await this.report(request, actor.tenantId);
    const item = report.items.find(entry => entry.technicianId === actor.userId);
    const idle = await this.prisma.client.technicianIdleSession.findFirst({ where: { technicianId: actor.userId, endedAt: null } });
    const open = idle ? { id: idle.id, reason: idle.reason, startedAt: idle.startedAt.toISOString() } : null;
    if (!item) return { completedCount: 0, workedMinutes: 0, activeOrders: 0, estimatedCount: 0, ...(canViewPrices ? { laborRevenueCents: 0 } : {}), target: null, efficiencyPercent: null, reworkCount: 0, idleMinutes: 0, idle: open };
    return {
      efficiencyPercent: item.efficiencyPercent, reworkCount: item.reworkCount, idleMinutes: item.idleMinutes, idle: open,
      completedCount: item.completedCount, workedMinutes: item.workedMinutes, activeOrders: item.activeOrders, estimatedCount: item.estimatedCount,
      ...(canViewPrices ? { laborRevenueCents: item.laborRevenueCents } : {}),
      target: item.target ? { completedCount: item.target.completedCount, workedMinutes: item.target.workedMinutes, ...(canViewPrices ? { laborRevenueCents: item.target.laborRevenueCents } : {}) } : null,
    };
  }

  // Each return counts once for every technician of the original order: who recorded time on it, or who it was assigned to.
  private async reworkByTechnician(originalOrderIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!originalOrderIds.length) return result;
    const ids = [...new Set(originalOrderIds)];
    const [shares, orders] = await Promise.all([
      this.prisma.client.serviceOrderProductivityShare.findMany({ where: { serviceOrderId: { in: ids } }, select: { serviceOrderId: true, technicianId: true } }),
      this.prisma.client.serviceOrder.findMany({ where: { id: { in: ids } }, select: { id: true, technicianId: true } }),
    ]);
    const technicians = new Map<string, Set<string>>();
    for (const share of shares) if (share.technicianId) technicians.set(share.serviceOrderId, (technicians.get(share.serviceOrderId) ?? new Set()).add(share.technicianId));
    for (const order of orders) if (!technicians.has(order.id) && order.technicianId) technicians.set(order.id, new Set([order.technicianId]));
    for (const id of originalOrderIds) for (const technicianId of technicians.get(id) ?? []) result.set(technicianId, (result.get(technicianId) ?? 0) + 1);
    return result;
  }

  // Delivered orders of the same vehicle whose warranty still covered the day this order was opened.
  async warrantyReturn(serviceOrderId: string): Promise<WarrantyReturnResponse> {
    const order = await this.order(serviceOrderId);
    const [delivered, current] = await Promise.all([
      this.prisma.client.serviceOrder.findMany({ where: { vehicleId: order.vehicleId, status: 'DELIVERED', deletedAt: null, id: { not: order.id }, warrantyDays: { gt: 0 }, closedAt: { not: null, lte: order.createdAt } }, orderBy: { closedAt: 'desc' }, take: 20, select: { id: true, orderNumber: true, closedAt: true, warrantyDays: true, technicianId: true } }),
      this.prisma.client.serviceOrderWarrantyReturn.findFirst({ where: { serviceOrderId } }),
    ]);
    const candidates = delivered.filter(entry => entry.closedAt && entry.warrantyDays && entry.closedAt.getTime() + entry.warrantyDays * 86_400_000 >= order.createdAt.getTime());
    const original = current ? await this.prisma.client.serviceOrder.findFirst({ where: { id: current.originalOrderId }, select: { orderNumber: true } }) : null;
    const technicianIds = [...new Set(candidates.map(entry => entry.technicianId).filter((id): id is string => Boolean(id)))];
    const users = technicianIds.length ? await this.prisma.client.user.findMany({ where: { id: { in: technicianIds } }, select: { id: true, name: true } }) : [];
    const names = new Map(users.map(user => [user.id, user.name]));
    return {
      current: current ? { originalOrderId: current.originalOrderId, orderNumber: original?.orderNumber ?? 0, reason: current.reason } : null,
      candidates: candidates.map(entry => ({ id: entry.id, orderNumber: entry.orderNumber, deliveredAt: entry.closedAt!.toISOString(), warrantyDays: entry.warrantyDays!, technicianName: entry.technicianId ? names.get(entry.technicianId) ?? null : null })),
    };
  }

  async markWarrantyReturn(input: MarkWarrantyReturnRequest, actor: AuthenticatedUser): Promise<WarrantyReturnResponse> {
    const options = await this.warrantyReturn(input.serviceOrderId);
    if (input.originalOrderId && !options.candidates.some(entry => entry.id === input.originalOrderId)) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Escolha uma OS entregue deste veículo que ainda estava na garantia quando esta foi aberta.', HttpStatus.BAD_REQUEST);
    await this.prisma.transaction(async tx => {
      await tx.serviceOrderWarrantyReturn.deleteMany({ where: { serviceOrderId: input.serviceOrderId, tenantId: actor.tenantId } });
      if (input.originalOrderId) await tx.serviceOrderWarrantyReturn.create({ data: { tenantId: actor.tenantId, serviceOrderId: input.serviceOrderId, originalOrderId: input.originalOrderId, reason: input.reason?.trim() || null, createdBy: actor.userId } });
    });
    await this.auditLog?.record({ tenantId: actor.tenantId, userId: actor.userId, action: input.originalOrderId ? 'productivity.warranty_return_marked' : 'productivity.warranty_return_cleared', entity: 'service_order', entityId: input.serviceOrderId, metadata: input.originalOrderId ? { originalOrderId: input.originalOrderId } : {} });
    return this.warrantyReturn(input.serviceOrderId);
  }

  // The month's commission per technician: labor times their percentage, plus the bonus when the labor target is reached.
  async commissions(request: TechnicianProductivityRequest, tenantId: string): Promise<CommissionsResponse> {
    const [report, rules] = await Promise.all([this.report(request, tenantId), this.prisma.client.technicianCommissionRule.findMany()]);
    const byTechnician = new Map(rules.map(rule => [rule.technicianId, rule]));
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date(request.startAt));
    const items = report.items.map(item => {
      const rule = byTechnician.get(item.technicianId);
      const targetReached = Boolean(item.target && item.target.laborRevenueCents > 0 && item.laborRevenueCents >= item.target.laborRevenueCents);
      const percentBp = rule ? rule.laborPercentBp + (targetReached ? rule.bonusPercentBp : 0) : 0;
      return { technicianId: item.technicianId, technicianName: item.technicianName, laborRevenueCents: item.laborRevenueCents, laborPercentBp: rule?.laborPercentBp ?? null, bonusPercentBp: rule?.bonusPercentBp ?? 0, targetReached, commissionCents: Math.round(item.laborRevenueCents * percentBp / 10_000), reworkCount: item.reworkCount };
    });
    return { month, items, totalCents: items.reduce((sum, item) => sum + item.commissionCents, 0) };
  }

  async setCommissionRule(input: SetCommissionRuleRequest, actor: AuthenticatedUser) {
    const technician = await this.prisma.client.user.findFirst({ where: { id: input.technicianId, deletedAt: null } });
    if (!technician) throw new AppException(AppErrorCode.SERVICE_ORDER_TECHNICIAN_NOT_FOUND, 'Técnico não encontrado.', HttpStatus.NOT_FOUND);
    await this.prisma.client.technicianCommissionRule.upsert({
      where: { tenantId_technicianId: { tenantId: actor.tenantId, technicianId: input.technicianId } },
      create: { tenantId: actor.tenantId, technicianId: input.technicianId, laborPercentBp: input.laborPercentBp, bonusPercentBp: input.bonusPercentBp },
      update: { laborPercentBp: input.laborPercentBp, bonusPercentBp: input.bonusPercentBp },
    });
    await this.auditLog?.record({ tenantId: actor.tenantId, userId: actor.userId, action: 'productivity.commission_rule_set', entity: 'user', entityId: input.technicianId, metadata: { laborPercentBp: input.laborPercentBp, bonusPercentBp: input.bonusPercentBp } });
    return { success: true as const };
  }

  // Time not on an order. One timer at a time: it cannot run while the technician is on an order.
  async startIdle(input: StartIdleRequest, actor: AuthenticatedUser, now = new Date()): Promise<MyIdleResponse> {
    await this.prisma.transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.userId}))`;
      const working = await tx.serviceOrderWorkSession.findFirst({ where: { technicianId: actor.userId, endedAt: null } });
      if (working && !countedMinutes(working.startedAt, null, now, await this.closeHour(actor.tenantId, tx)).capped) {
        const order = await tx.serviceOrder.findFirst({ where: { id: working.serviceOrderId }, select: { orderNumber: true } });
        throw new AppException(AppErrorCode.VALIDATION_ERROR, `Encerre seu trabalho na OS #${order?.orderNumber ?? ''} antes de registrar tempo parado.`, HttpStatus.CONFLICT);
      }
      if (working) await tx.serviceOrderWorkSession.updateMany({ where: { id: working.id, endedAt: null }, data: { endedAt: sessionCutoff(working.startedAt, await this.closeHour(actor.tenantId, tx)) } });
      await tx.technicianIdleSession.updateMany({ where: { technicianId: actor.userId, endedAt: null }, data: { endedAt: now } });
      await tx.technicianIdleSession.create({ data: { tenantId: actor.tenantId, technicianId: actor.userId, reason: input.reason, note: input.note?.trim() || null, startedAt: now } });
    });
    return this.myIdle(actor, now);
  }

  async stopIdle(actor: AuthenticatedUser, now = new Date()): Promise<MyIdleResponse> {
    const result = await this.prisma.client.technicianIdleSession.updateMany({ where: { technicianId: actor.userId, endedAt: null }, data: { endedAt: now } });
    if (!result.count) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Não há tempo parado em andamento.', HttpStatus.CONFLICT);
    return this.myIdle(actor, now);
  }

  async myIdle(actor: AuthenticatedUser, now = new Date()): Promise<MyIdleResponse> {
    const local = new Date(now.getTime() - 3 * 3_600_000);
    const dayStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3));
    const [rows, closeHour] = await Promise.all([
      this.prisma.client.technicianIdleSession.findMany({ where: { technicianId: actor.userId, OR: [{ startedAt: { gte: dayStart } }, { endedAt: null }] }, orderBy: { startedAt: 'desc' } }),
      this.closeHour(actor.tenantId),
    ]);
    const map = (row: (typeof rows)[number]) => ({ id: row.id, reason: row.reason, note: row.note, startedAt: row.startedAt.toISOString(), endedAt: row.endedAt?.toISOString() ?? null, minutes: countedMinutes(row.startedAt, row.endedAt, now, closeHour).minutes });
    const open = rows.find(row => !row.endedAt);
    return { open: open ? map(open) : null, today: rows.filter(row => row.startedAt >= dayStart).map(map) };
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
    const closeHour = await this.closeHour(order.tenantId, tx);
    const [sessions, lineItems] = await Promise.all([
      tx.serviceOrderWorkSession.findMany({ where: { serviceOrderId: order.id } }),
      tx.serviceOrderItem.findMany({ where: { serviceOrderId: order.id, deletedAt: null }, select: { type: true, quantity: true, unitPriceCents: true } }),
    ]);
    const gross = lineItems.reduce((sum, item) => sum + Math.round(Number(item.quantity) * item.unitPriceCents), 0);
    const labor = lineItems.filter(item => item.type === 'LABOR').reduce((sum, item) => sum + Math.round(Number(item.quantity) * item.unitPriceCents), 0);
    const netLabor = gross ? Math.max(0, labor - Math.round(Math.min(order.discountCents, gross) * labor / gross)) : 0;
    const byTechnician = new Map<string, number>();
    for (const session of sessions) byTechnician.set(session.technicianId, (byTechnician.get(session.technicianId) ?? 0) + countedMinutes(session.startedAt, session.endedAt ?? deliveredAt, deliveredAt, closeHour).minutes);
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
    const rows = await this.prisma.client.$queryRaw<Array<{ id: string; orderNumber: number; deliveredAt: Date; laborCents: number; workedMinutes: number; estimated: boolean; total: bigint; standardMinutes: number | null; orderWorkedMinutes: bigint | null }>>`
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
      SELECT e.id, e.order_number AS "orderNumber", e.closed_at AS "deliveredAt", e.labor_cents AS "laborCents",
        e.worked_minutes AS "workedMinutes", e.estimated, COUNT(*) OVER() AS total,
        std.minutes::integer AS "standardMinutes", spent.minutes AS "orderWorkedMinutes"
      FROM entries e
      LEFT JOIN LATERAL (
        SELECT CASE WHEN COUNT(*) > 0 AND COUNT(*) FILTER (WHERE c.standard_minutes IS NULL) = 0 THEN SUM(ROUND(i.quantity * c.standard_minutes)) END AS minutes
        FROM service_order_items i LEFT JOIN catalog_items c ON c.id = i.catalog_item_id AND c.tenant_id = ${tenantId}::uuid
        WHERE i.service_order_id = e.id AND i.deleted_at IS NULL AND i.type = 'LABOR'
      ) std ON true
      LEFT JOIN LATERAL (
        SELECT SUM(s.worked_minutes) AS minutes FROM service_order_productivity_shares s WHERE s.tenant_id = ${tenantId}::uuid AND s.service_order_id = e.id
      ) spent ON true
      ORDER BY e.closed_at DESC, e.id DESC LIMIT ${request.limit} OFFSET ${request.offset}
    `;
    return { items: rows.map(row => ({ id: row.id, orderNumber: row.orderNumber, deliveredAt: row.deliveredAt.toISOString(), laborCents: row.laborCents, workedMinutes: row.workedMinutes, estimated: row.estimated, standardMinutes: row.standardMinutes ?? null, orderWorkedMinutes: Number(row.orderWorkedMinutes ?? 0) })), total: rows.length ? Number(rows[0].total) : 0, offset: request.offset, limit: request.limit };
  }

  async report(request: TechnicianProductivityRequest, tenantId?: string, now = new Date()): Promise<TechnicianProductivityResponse> {
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
    const recordedOrders = [...new Set(shares.filter(share => share.basis === 'RECORDED').map(share => share.serviceOrderId))];
    const [running, workshop, monthSessions, standard, returns, idleSessions] = await Promise.all([
      this.prisma.client.serviceOrderWorkSession.findMany({ where: { endedAt: null }, orderBy: { startedAt: 'asc' } }),
      this.workshop(tenantId),
      this.prisma.client.serviceOrderWorkSession.findMany({ where: { startedAt: { gte: start, lt: end } } }),
      this.standardMinutes(recordedOrders),
      this.prisma.client.serviceOrderWarrantyReturn.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { originalOrderId: true } }),
      this.prisma.client.technicianIdleSession.findMany({ where: { startedAt: { gte: start, lt: end } } }),
    ]);
    const rework = await this.reworkByTechnician(returns.map(entry => entry.originalOrderId));
    const idleMinutes = new Map<string, number>();
    for (const session of idleSessions) idleMinutes.set(session.technicianId, (idleMinutes.get(session.technicianId) ?? 0) + countedMinutes(session.startedAt, session.endedAt, now, workshop.closeHour).minutes);
    const closeHour = workshop.closeHour;
    const minutesByOrder = new Map<string, number>();
    for (const share of shares) if (share.basis === 'RECORDED') minutesByOrder.set(share.serviceOrderId, (minutesByOrder.get(share.serviceOrderId) ?? 0) + share.workedMinutes);
    const sessionMinutes = new Map<string, number>();
    for (const session of monthSessions) sessionMinutes.set(session.technicianId, (sessionMinutes.get(session.technicianId) ?? 0) + countedMinutes(session.startedAt, session.endedAt, now, closeHour).minutes);
    const available = availableMinutes(start, end < now ? end : now, workshop);
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
    const technicianIds = [...new Set([...shares.map(share => share.technicianId), ...legacy.map(order => order.technicianId), ...active.map(order => order.technicianId), ...running.map(session => session.technicianId), ...monthSessions.map(session => session.technicianId), ...rework.keys(), ...idleMinutes.keys()].filter((id): id is string => Boolean(id)))];
    const users = await this.prisma.client.user.findMany({ where: { OR: [{ id: { in: technicianIds } }, { roleId: { in: roles.map(role => role.id) }, status: 'active', deletedAt: null }] }, select: { id: true, name: true } });
    const names = new Map(users.map(user => [user.id, user.name]));
    const targetsByTechnician = new Map(targets.map(target => [target.technicianId, target]));
    const orderById = new Map(delivered.map(order => [order.id, order]));
    type Bucket = { completedCount: number; activeOrders: number; workedMinutes: number; estimatedCount: number; laborRevenueCents: number; soldMinutes: number; efficiencyBaseMinutes: number; recordedLaborCents: number; recordedMinutes: number };
    const buckets = new Map<string, Bucket>();
    const bucketFor = (id: string) => { if (!buckets.has(id)) buckets.set(id, { completedCount: 0, activeOrders: 0, workedMinutes: 0, estimatedCount: 0, laborRevenueCents: 0, soldMinutes: 0, efficiencyBaseMinutes: 0, recordedLaborCents: 0, recordedMinutes: 0 }); return buckets.get(id)!; };
    for (const id of names.keys()) bucketFor(id);
    let unassignedCount = 0, unassignedLabor = 0;
    const add = (id: string | null, orderId: string, laborCents: number, workedMinutes: number, estimated: boolean) => {
      const order = orderById.get(orderId); if (!order?.closedAt) return;
      if (!id) { unassignedCount += 1; unassignedLabor += laborCents; return; }
      const bucket = bucketFor(id);
      bucket.completedCount += 1;
      bucket.laborRevenueCents += laborCents; bucket.workedMinutes += workedMinutes; if (estimated) bucket.estimatedCount += 1;
    };
    for (const share of shares) {
      add(share.technicianId, share.serviceOrderId, share.laborCents, share.workedMinutes, share.basis !== 'RECORDED');
      if (!share.technicianId || share.basis !== 'RECORDED' || !orderById.get(share.serviceOrderId)?.closedAt) continue;
      const bucket = bucketFor(share.technicianId);
      bucket.recordedLaborCents += share.laborCents; bucket.recordedMinutes += share.workedMinutes;
      // The order's standard time is split between technicians by their share of the recorded time.
      const sold = standard.get(share.serviceOrderId), orderMinutes = minutesByOrder.get(share.serviceOrderId) ?? 0;
      if (sold !== undefined && orderMinutes > 0) { bucket.soldMinutes += sold * share.workedMinutes / orderMinutes; bucket.efficiencyBaseMinutes += share.workedMinutes; }
    }
    for (const order of legacy) {
      const { gross, labor } = totalsByOrder.get(order.id) ?? { gross: 0, labor: 0 };
      add(order.technicianId, order.id, gross ? Math.max(0, labor - Math.round(Math.min(order.discountCents, gross) * labor / gross)) : 0, 0, true);
    }
    for (const order of active) if (order.technicianId) bucketFor(order.technicianId).activeOrders += 1;
    const items = [...buckets].map(([technicianId, bucket]) => {
      const target = targetsByTechnician.get(technicianId);
      const worked = sessionMinutes.get(technicianId) ?? 0;
      return { technicianId, technicianName: names.get(technicianId) ?? 'Técnico removido', completedCount: bucket.completedCount, laborRevenueCents: bucket.laborRevenueCents, activeOrders: bucket.activeOrders, workedMinutes: bucket.workedMinutes, estimatedCount: bucket.estimatedCount,
        soldMinutes: Math.round(bucket.soldMinutes), efficiencyBaseMinutes: bucket.efficiencyBaseMinutes, efficiencyPercent: percent(bucket.soldMinutes, bucket.efficiencyBaseMinutes), valuePerHourCents: bucket.recordedMinutes > 0 ? Math.round(bucket.recordedLaborCents * 60 / bucket.recordedMinutes) : null, sessionMinutes: worked, occupancyPercent: percent(worked, available), reworkCount: rework.get(technicianId) ?? 0, idleMinutes: idleMinutes.get(technicianId) ?? 0,
        target: target ? { completedCount: target.completedTarget, laborRevenueCents: target.laborCentsTarget, workedMinutes: target.workedMinutesTarget } : null };
    }).sort((a, b) => b.laborRevenueCents - a.laborRevenueCents || b.completedCount - a.completedCount);
    const runningOrders = running.length ? await this.prisma.client.serviceOrder.findMany({ where: { id: { in: running.map(session => session.serviceOrderId) } }, select: { id: true, orderNumber: true } }) : [];
    const orderNumbers = new Map(runningOrders.map(order => [order.id, order.orderNumber]));
    const openSessions: OpenWorkSession[] = running.map(session => { const counted = countedMinutes(session.startedAt, null, now, closeHour); return { id: session.id, technicianId: session.technicianId, technicianName: names.get(session.technicianId) ?? 'Técnico removido', serviceOrderId: session.serviceOrderId, orderNumber: orderNumbers.get(session.serviceOrderId) ?? 0, startedAt: session.startedAt.toISOString(), workedMinutes: counted.minutes, capped: counted.capped }; });
    const sum = (pick: (bucket: Bucket) => number) => [...buckets.values()].reduce((total, bucket) => total + pick(bucket), 0);
    const teamSold = sum(bucket => bucket.soldMinutes), teamBase = sum(bucket => bucket.efficiencyBaseMinutes), teamRecorded = sum(bucket => bucket.recordedMinutes);
    return { openSessions, availableMinutes: available, laborRateCents: workshop.laborRateCents, startAt: request.startAt, endAt: request.endAt, items, totals: { soldMinutes: Math.round(teamSold), efficiencyBaseMinutes: teamBase, efficiencyPercent: percent(teamSold, teamBase), valuePerHourCents: teamRecorded > 0 ? Math.round(sum(bucket => bucket.recordedLaborCents) * 60 / teamRecorded) : null, sessionMinutes: items.reduce((total, item) => total + item.sessionMinutes, 0), reworkCount: returns.length, idleMinutes: items.reduce((total, item) => total + item.idleMinutes, 0), completedCount: delivered.length, laborRevenueCents: items.reduce((sum, item) => sum + item.laborRevenueCents, unassignedLabor), workedMinutes: items.reduce((sum, item) => sum + item.workedMinutes, 0), unassignedCount, estimatedCount: items.reduce((sum, item) => sum + item.estimatedCount, 0) + legacy.filter(order => !order.technicianId).length } };
  }
}
