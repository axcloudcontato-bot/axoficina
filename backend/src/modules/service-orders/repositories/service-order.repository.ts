import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient, ServiceOrder } from '@oficina/database';
import type { ServiceOrderStatus, ServiceOrderListRequest } from '@oficina/contracts';
import type { PaymentMethod } from '@oficina/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { TenantContextService } from '../../../shared/tenant-context/tenant-context.service';
import { serviceOrderPeriod } from '../service-order-period';

export interface CreateServiceOrderInput {
  // O Prisma Middleware sobrescreve isto com o tenant do contexto ativo em
  // runtime (ver CREATE_OPERATIONS em tenant-isolation.middleware.ts) — só
  // existe aqui para satisfazer o tipo `ServiceOrderCreateInput` do Prisma.
  tenantId: string;
  customerId: string;
  vehicleId: string;
  technicianId?: string;
  checklist?: Record<string, unknown>;
  diagnosis?: string;
  entryMileage?: number | null;
  customerComplaint?: string | null;
  receptionNotes?: string | null;
  recommendedService?: string | null;
  expectedDeliveryAt?: Date | null;
  paymentMethod?: PaymentMethod | null;
  paymentInstallments?: number | null;
  openedAt: Date;
}

export interface UpdateServiceOrderInput {
  technicianId?: string;
  checklist?: Record<string, unknown>;
  diagnosis?: string;
  entryMileage?: number | null;
  customerComplaint?: string | null;
  receptionNotes?: string | null;
  recommendedService?: string | null;
  expectedDeliveryAt?: Date | null;
  paymentMethod?: PaymentMethod | null;
  paymentInstallments?: number | null;
  discountCents?: number;
  warrantyDays?: number | null;
  exitMileage?: number | null;
}

@Injectable()
export class ServiceOrderRepository {
  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  // `this.prisma.client` (tenant-scoped): toda operação de ServiceOrder
  // roda dentro de uma requisição autenticada — o Prisma Middleware injeta
  // tenant_id automaticamente (ver TENANT_SCOPED_MODELS).
  async insert(input: CreateServiceOrderInput, tx?: PrismaClient) {
    const db = tx ?? this.prisma.client;
    // Serializa a alocação por tenant dentro da transação, evitando números
    // duplicados quando duas OS são abertas simultaneamente.
    await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.tenantId}))`;
    const latest = await db.serviceOrder.aggregate({ where: { tenantId: input.tenantId }, _max: { orderNumber: true } });
    const orderNumber = (latest._max.orderNumber ?? 0) + 1;
    return db.serviceOrder.create({
      data: {
        tenantId: input.tenantId,
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        technicianId: input.technicianId,
        checklist: input.checklist as Prisma.InputJsonValue | undefined,
        diagnosis: input.diagnosis,
        orderNumber,
        entryMileage: input.entryMileage,
        customerComplaint: input.customerComplaint,
        receptionNotes: input.receptionNotes,
        recommendedService: input.recommendedService,
        expectedDeliveryAt: input.expectedDeliveryAt,
        paymentMethod: input.paymentMethod,
        paymentInstallments: input.paymentInstallments,
        status: 'OPEN',
        openedAt: input.openedAt,
      },
    });
  }

  async byId(id: string) {
    return this.prisma.client.serviceOrder.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async update(id: string, patch: UpdateServiceOrderInput) {
    return this.prisma.client.serviceOrder.updateMany({
      where: { id, deletedAt: null },
      data: { ...patch, checklist: patch.checklist as Prisma.InputJsonValue | undefined },
    });
  }

  // Transição atômica: o WHERE checa `status: fromStatus`, não só `id` —
  // se outra requisição já mudou o status entre a validação do Manager e
  // esta chamada, `count` vem 0 e o Manager sabe que perdeu a corrida (ver
  // Edge Case 5 da spec e o Gotcha no plano). Sempre chamado dentro de uma
  // `prisma.transaction`, na mesma tx que grava o histórico.
  async transition(tx: PrismaClient, id: string, fromStatus: ServiceOrderStatus, toStatus: ServiceOrderStatus, closedAt?: Date) {
    return tx.serviceOrder.updateMany({
      where: { id, status: fromStatus, deletedAt: null },
      data: { status: toStatus, closedAt },
    });
  }

  async softDelete(id: string) {
    return this.prisma.client.serviceOrder.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  // `prisma.unscoped` de propósito: só chamado por
  // MaintenanceAlertScanProcessor (Feature Motor de Manutenção Preventiva),
  // que roda fora do AsyncLocalStorage de uma requisição — mesmo raciocínio
  // de VehicleRepository.listActiveForTenantUnscoped. Nunca usar isto num
  // Controller/Manager.
  async lastDeliveredClosedAtUnscoped(vehicleId: string): Promise<Date | null> {
    const order = await this.prisma.unscoped.serviceOrder.findFirst({
      where: { vehicleId, status: 'DELIVERED', deletedAt: null },
      orderBy: { closedAt: 'desc' },
      select: { closedAt: true },
    });
    return order?.closedAt ?? null;
  }

  async listByTenant(
    offset: number,
    limit: number,
    status?: ServiceOrderStatus,
    vehicleId?: string,
    technicianId?: string,
    customerId?: string,
    search?: { orderNumber?: number; matchingCustomerIds: string[]; matchingVehicleIds: string[] },
    filters: Pick<ServiceOrderListRequest, 'startDate' | 'endDate' | 'dateField' | 'attention' | 'includeMetrics'> = {},
  ) {
    const base: Prisma.ServiceOrderWhereInput = {
      deletedAt: null,
      ...(vehicleId ? { vehicleId } : {}),
      ...(technicianId ? { technicianId } : {}),
      ...(customerId ? { customerId } : {}),
      // Sem relação FK entre ServiceOrder e Customer/Vehicle — o casamento
      // por placa/nome do cliente é feito em duas etapas (ver
      // VehicleRepository.searchIdsByPlateOrModel e
      // CustomerRepository.searchIdsByNameOrDocument), OR'd aqui com o
      // número da OS quando o termo de busca é numérico.
      ...(search
        ? {
            OR: [
              // Prisma may discard an empty nested OR: keep an explicit false
              // predicate so a search with no matches never returns all orders.
              { id: { in: [] } },
              ...(search.orderNumber !== undefined ? [{ orderNumber: search.orderNumber }] : []),
              ...(search.matchingCustomerIds.length > 0 ? [{ customerId: { in: search.matchingCustomerIds } }] : []),
              ...(search.matchingVehicleIds.length > 0 ? [{ vehicleId: { in: search.matchingVehicleIds } }] : []),
            ],
          }
        : {}),
    };

    const period = serviceOrderPeriod(filters.startDate, filters.endDate);
    const periodWhere: Prisma.ServiceOrderWhereInput = filters.dateField === 'CLOSED'
      ? { closedAt: { not: null, ...period } }
      : filters.startDate || filters.endDate ? { openedAt: period } : {};
    const active = { notIn: ['DELIVERED', 'CANCELLED'] };
    const now = new Date();
    const conditions: Prisma.ServiceOrderWhereInput[] = [];
    if (status) conditions.push({ status });
    if (filters.attention === 'ACTIVE') conditions.push({ status: active });
    if (filters.attention === 'OVERDUE') conditions.push({ status: active, expectedDeliveryAt: { lt: now } });
    if (filters.attention === 'UNASSIGNED') conditions.push({ status: active, technicianId: null });
    if (filters.attention === 'PAYMENT_PENDING') {
      // Raw SQL does not use the tenant extension: scope both tables explicitly.
      const tenantId = this.tenantContext.getStore()?.tenantId;
      if (!tenantId) throw new Error('Payment filter requires a tenant context');
      const pending = await this.prisma.client.$queryRaw<{ id: string }[]>`
        SELECT so.id FROM service_orders so
        WHERE so.tenant_id = ${tenantId}::uuid AND so.deleted_at IS NULL
        AND COALESCE((SELECT SUM(ROUND(i.quantity * i.unit_price_cents)) FROM service_order_items i
          WHERE i.service_order_id = so.id AND i.deleted_at IS NULL), 0)
          - LEAST(so.discount_cents, COALESCE((SELECT SUM(ROUND(i2.quantity * i2.unit_price_cents)) FROM service_order_items i2 WHERE i2.service_order_id = so.id AND i2.deleted_at IS NULL), 0))
          > COALESCE((SELECT SUM(r.amount_cents) FROM service_order_receipts r
          WHERE r.service_order_id = so.id AND r.tenant_id = ${tenantId}::uuid AND r.deleted_at IS NULL), 0)`;
      conditions.push({ id: { in: pending.map((order) => order.id) } });
    }
    const where: Prisma.ServiceOrderWhereInput = { AND: [base, periodWhere, ...conditions] };

    const [items, total, metrics] = await Promise.all([
      this.prisma.client.serviceOrder.findMany({
        where,
        orderBy: [{ [filters.dateField === 'CLOSED' ? 'closedAt' : 'openedAt']: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: limit,
      }),
      this.prisma.client.serviceOrder.count({ where }),
      filters.includeMetrics ? this.listMetrics(base, periodWhere, period, now) : undefined,
    ]);

    return { items, total, metrics };
  }

  private async listMetrics(base: Prisma.ServiceOrderWhereInput, periodWhere: Prisma.ServiceOrderWhereInput, period: ReturnType<typeof serviceOrderPeriod>, now: Date) {
    const count = (condition: Prisma.ServiceOrderWhereInput) => this.prisma.client.serviceOrder.count({ where: { AND: [base, periodWhere, condition] } });
    const active = { notIn: ['DELIVERED', 'CANCELLED'] };
    const [activeCount, overdue, waitingParts, ready, delivered] = await Promise.all([
      count({ status: active }), count({ status: active, expectedDeliveryAt: { lt: now } }),
      count({ status: 'WAITING_PARTS' }), count({ status: 'COMPLETED' }),
      // Delivery always uses its actual date, even when the list filters entries.
      this.prisma.client.serviceOrder.count({ where: { AND: [base, { status: 'DELIVERED', closedAt: period }] } }),
    ]);
    return { active: activeCount, overdue, waitingParts, ready, delivered };
  }

  async todayMetrics(now: Date, today?: { startsAt: Date; endsAt: Date }) {
    const base: Prisma.ServiceOrderWhereInput = { deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } };
    const count = (condition: Prisma.ServiceOrderWhereInput) => this.prisma.client.serviceOrder.count({ where: { AND: [base, condition] } });
    const [active, overdue, waitingParts, awaitingApproval, ready, unassigned, dueToday, attentionTotal] = await Promise.all([
      count({}), count({ expectedDeliveryAt: { lt: now } }), count({ status: 'WAITING_PARTS' }), count({ status: 'AWAITING_APPROVAL' }), count({ status: 'COMPLETED' }), count({ technicianId: null }),
      today ? count({ status: { not: 'COMPLETED' }, expectedDeliveryAt: { gte: today.startsAt, lt: today.endsAt } }) : Promise.resolve(0),
      count({ OR: [{ expectedDeliveryAt: { lt: now } }, { status: { in: ['WAITING_PARTS', 'AWAITING_APPROVAL', 'COMPLETED'] } }, { technicianId: null }] }),
    ]);
    return { metrics: { active, overdue, waitingParts, awaitingApproval, ready, unassigned, dueToday }, attentionTotal };
  }

  // Priority tiers, most urgent first; each tier is oldest-first. Only the rows
  // that fit in the page size are loaded, so the cost does not grow with the workshop.
  async attentionOrders(now: Date, take: number) {
    const base: Prisma.ServiceOrderWhereInput = { deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } };
    const tiers: Prisma.ServiceOrderWhereInput[] = [
      { expectedDeliveryAt: { lt: now } }, { status: 'WAITING_PARTS' }, { status: 'AWAITING_APPROVAL' }, { technicianId: null }, { status: 'COMPLETED' },
    ];
    const found: ServiceOrder[] = [];
    for (const tier of tiers) {
      if (found.length >= take) break;
      found.push(...await this.prisma.client.serviceOrder.findMany({ where: { AND: [base, tier, { id: { notIn: found.map((order) => order.id) } }] }, orderBy: [{ openedAt: 'asc' }, { id: 'asc' }], take: take - found.length }));
    }
    return found;
  }

  // Since when each order sits in `status`: the latest transition into it
  // (the order's own entry date when no history row exists).
  async waitingSince(status: 'AWAITING_APPROVAL' | 'COMPLETED') {
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { deletedAt: null, status }, select: { id: true, openedAt: true, discountCents: true } });
    if (!orders.length) return [];
    const history = await this.prisma.client.serviceOrderStatusHistory.findMany({ where: { serviceOrderId: { in: orders.map((order) => order.id) }, toStatus: status }, orderBy: { changedAt: 'desc' }, select: { serviceOrderId: true, changedAt: true } });
    const latest = new Map<string, Date>();
    for (const row of history) if (!latest.has(row.serviceOrderId)) latest.set(row.serviceOrderId, row.changedAt);
    return orders.map((order) => ({ id: order.id, since: latest.get(order.id) ?? order.openedAt, discountCents: order.discountCents }));
  }

  async myOrders(userId: string, take: number) {
    const where: Prisma.ServiceOrderWhereInput = { deletedAt: null, technicianId: userId, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } };
    const [items, total] = await Promise.all([
      this.prisma.client.serviceOrder.findMany({ where, orderBy: [{ openedAt: 'asc' }, { id: 'asc' }], take }),
      this.prisma.client.serviceOrder.count({ where }),
    ]);
    return { items, total };
  }

  async activeWorkloadRows() {
    return this.prisma.client.serviceOrder.findMany({ where: { deletedAt: null, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING_PARTS'] } }, select: { technicianId: true, status: true } });
  }

  async listForBusinessSummary(since: Date) {
    return this.prisma.client.serviceOrder.findMany({
      where: {
        deletedAt: null,
        OR: [
          { status: { in: ['OPEN', 'AWAITING_APPROVAL', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED'] } },
          { status: 'DELIVERED', closedAt: { gte: since } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

}
