import { Injectable, Logger } from '@nestjs/common';
import type { StatItem, StatOrder } from '../services/customer-stats';
import type { CustomerAddress, CustomerListRequest } from '@oficina/contracts';
import { Prisma } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { TenantContextService } from '../../../shared/tenant-context/tenant-context.service';

export interface CreateCustomerInput {
  careConsentSource?: string;
  careConsentBy?: string;
  birthDate?: Date;
  careMessagesEnabled?: boolean;
  careConsentAt?: Date;
  notifyServiceOrderUpdates?: boolean;
  // O Prisma Middleware sobrescreve isto com o tenant do contexto ativo em
  // runtime (ver CREATE_OPERATIONS em tenant-isolation.middleware.ts) — só
  // existe aqui para satisfazer o tipo `CustomerCreateInput` do Prisma.
  tenantId: string;
  type: string;
  document: string;
  name: string;
  phone: string;
  email?: string;
  address?: CustomerAddress;
  notes?: string;
  rg?: string;
  stateRegistration?: string;
  secondaryContactName?: string;
  secondaryContactPhone?: string;
  secondaryContactRelation?: string;
  preferredContactChannel?: string;
  preferredContactTime?: string;
}

export interface UpdateCustomerInput {
  careConsentSource?: string;
  careConsentBy?: string;
  type?: string;
  birthDate?: Date | null;
  careMessagesEnabled?: boolean;
  careConsentAt?: Date;
  notifyServiceOrderUpdates?: boolean;
  document?: string;
  name?: string;
  phone?: string;
  email?: string | null;
  address?: CustomerAddress | null;
  notes?: string | null;
  rg?: string | null;
  stateRegistration?: string | null;
  secondaryContactName?: string | null;
  secondaryContactPhone?: string | null;
  secondaryContactRelation?: string | null;
  preferredContactChannel?: string | null;
  preferredContactTime?: string | null;
}

export interface ListCustomersResult<T> {
  items: T[];
  total: number;
}

@Injectable()
export class CustomerRepository {
  private readonly logger = new Logger(CustomerRepository.name);

  constructor(private readonly prisma: PrismaService, private readonly tenantContext: TenantContextService) {}

  private async searchFilter(search: string): Promise<Prisma.CustomerWhereInput> {
    const term = search.trim();
    const digits = term.replace(/\D/g, '');
    const numeric = /^[\d\s()+./-]+$/.test(term) && Boolean(digits);
    const OR: Prisma.CustomerWhereInput[] = [
      { name: { contains: term, mode: 'insensitive' } },
      { document: { contains: numeric ? digits : term } },
      { email: { contains: term, mode: 'insensitive' } },
      { phone: { contains: term } },
    ];
    const plate = term.replace(/[^a-zA-Z0-9]/g, '');
    if (plate.length >= 3 && plate.length <= 7) {
      const vehicles = await this.prisma.client.vehicle.findMany({
        where: { plate: { contains: plate, mode: 'insensitive' }, deletedAt: null },
        select: { customerId: true },
        take: 500,
      });
      if (vehicles.length) OR.push({ id: { in: [...new Set(vehicles.map((item) => item.customerId))] } });
    }
    if (numeric && digits.length >= 8) {
      // Phone numbers are stored with different masks. Raw queries do not
      // receive Prisma's tenant extension, so scope this lookup explicitly.
      const tenantId = this.tenantContext.getStore()?.tenantId;
      if (!tenantId) throw new Error('Busca de contatos exige contexto de oficina.');
      const national = digits.startsWith('55') && [12, 13].includes(digits.length) ? digits.slice(2) : digits;
      const matches = await this.prisma.client.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM customers WHERE tenant_id = ${tenantId}::uuid AND deleted_at IS NULL
          AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${`%${national}%`}
        ORDER BY created_at DESC LIMIT 500`);
      if (matches.length) OR.push({ id: { in: matches.map((item) => item.id) } });
      if (matches.length === 500) this.logger.warn('Busca por telefone limitada a 500 cadastros.');
    }
    return { OR };
  }

  // `this.prisma.client` (tenant-scoped): toda operação de Customer roda
  // dentro de uma requisição autenticada — o Prisma Middleware injeta
  // tenant_id automaticamente (ver TENANT_SCOPED_MODELS em
  // tenant-isolation.middleware.ts).
  async insert(input: CreateCustomerInput) {
    return this.prisma.client.customer.create({
      data: {
        tenantId: input.tenantId,
        type: input.type,
        document: input.document,
        name: input.name,
        phone: input.phone,
        birthDate: input.birthDate,
        careMessagesEnabled: input.careMessagesEnabled,
        careConsentAt: input.careConsentAt,
        careConsentSource: input.careConsentSource,
        careConsentBy: input.careConsentBy,
        email: input.email,
        address: input.address as Prisma.InputJsonValue | undefined,
        notes: input.notes,
        rg: input.rg,
        stateRegistration: input.stateRegistration,
        secondaryContactName: input.secondaryContactName,
        secondaryContactPhone: input.secondaryContactPhone,
        secondaryContactRelation: input.secondaryContactRelation,
        preferredContactChannel: input.preferredContactChannel,
        preferredContactTime: input.preferredContactTime,
        notifyServiceOrderUpdates: input.notifyServiceOrderUpdates,
      },
    });
  }

  async byId(id: string) {
    return this.prisma.client.customer.findFirst({
      where: { id, deletedAt: null },
    });
  }

  // Usado pelo VehicleManager pra denormalizar o nome do dono em telas de
  // listagem de veículos sem N+1 (uma query em lote em vez de uma por
  // veículo).
  async byIds(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    return this.prisma.client.customer.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });
  }

  // `prisma.unscoped` de propósito: só chamado por
  // MaintenanceAlertScanProcessor, que roda fora do AsyncLocalStorage de uma
  // requisição. Usado pra filtrar veículos de cliente soft-deletado antes de
  // gerar/manter um alerta (spec, Edge Case 5) — sem relação FK entre Vehicle
  // e Customer (SCHEMA.md: sem REFERENCES), então o filtro é feito em
  // aplicação via lote, mesmo padrão N+1-safe de `byIds`. Nunca usar isto num
  // Controller/Manager.
  async activeIdsAmongUnscoped(ids: string[]) {
    if (ids.length === 0) {
      return [];
    }
    const customers = await this.prisma.unscoped.customer.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    return customers.map((customer) => customer.id);
  }

  // Usado por VehicleManager.list pra casar veículos pelo nome/documento do
  // cliente dono — sem relação FK entre Vehicle e Customer (SCHEMA.md: sem
  // REFERENCES), o casamento é em duas etapas: aqui só os ids que batem;
  // VehicleRepository.listByTenant faz o OR com marca/modelo/placa. `limit`
  // é uma rede de segurança contra uma cláusula IN gigante se o termo bater
  // em muitos clientes.
  async searchIdsByNameOrDocument(search: string, limit = 500) {
    const customers = await this.prisma.client.customer.findMany({
      where: {
        deletedAt: null,
        ...await this.searchFilter(search),
      },
      select: { id: true },
      take: limit,
    });
    if (customers.length === limit) {
      this.logger.warn(`searchIdsByNameOrDocument truncou em ${limit} resultados para o termo de busca — resultado pode estar incompleto`);
    }
    return customers.map((customer) => customer.id);
  }

  // Escopado ao tenant automaticamente pela extensão — checagem de
  // unicidade do documento é sempre POR TENANT (ver schema.prisma).
  async byDocument(document: string) {
    return this.prisma.client.customer.findFirst({
      where: { document, deletedAt: null },
    });
  }

  async update(id: string, patch: UpdateCustomerInput) {
    return this.prisma.client.customer.updateMany({
      where: { id, deletedAt: null },
      data: { ...patch, address: patch.address === null ? Prisma.DbNull : patch.address as Prisma.InputJsonValue | undefined },
    });
  }

  // Archived customers are invisible to every other lookup; only the restore flow looks at them.
  async archivedById(id: string) {
    return this.prisma.client.customer.findFirst({ where: { id, deletedAt: { not: null } } });
  }

  async restore(id: string) {
    return this.prisma.client.customer.updateMany({ where: { id, deletedAt: { not: null } }, data: { deletedAt: null } });
  }

  // Open orders and what is still to be received on this customer's orders.
  async archiveImpact(id: string): Promise<{ openServiceOrders: number; pendingCents: number }> {
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { customerId: id, deletedAt: null }, select: { id: true, status: true } });
    const openServiceOrders = orders.filter((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)).length;
    if (orders.length === 0) return { openServiceOrders, pendingCents: 0 };
    const pending = await this.prisma.client.serviceOrderInstallment.aggregate({
      where: { serviceOrderId: { in: orders.map((order) => order.id) }, status: 'PENDING', deletedAt: null },
      _sum: { amountCents: true },
    });
    return { openServiceOrders, pendingCents: pending._sum.amountCents ?? 0 };
  }

  // Plates, orders and order items of a set of customers, for the numbers shown beside them.
  async vehiclesOf(customerIds: string[]) {
    if (customerIds.length === 0) return [];
    return this.prisma.client.vehicle.findMany({
      where: { customerId: { in: customerIds }, deletedAt: null },
      select: { id: true, customerId: true, brand: true, model: true, plate: true, year: true, mileage: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async ordersOf(customerIds: string[]): Promise<{ orders: StatOrder[]; items: StatItem[] }> {
    if (customerIds.length === 0) return { orders: [], items: [] };
    const orders = await this.prisma.client.serviceOrder.findMany({
      where: { customerId: { in: customerIds }, deletedAt: null },
      select: { id: true, customerId: true, status: true, closedAt: true, discountCents: true },
    });
    const deliveredIds = orders.filter((order) => order.status === 'DELIVERED').map((order) => order.id);
    // Items carry no tenant column: the orders above (tenant-scoped) say which ones belong here.
    const items = deliveredIds.length
      ? await this.prisma.client.serviceOrderItem.findMany({ where: { serviceOrderId: { in: deliveredIds }, deletedAt: null }, select: { serviceOrderId: true, quantity: true, unitPriceCents: true } })
      : [];
    return { orders, items };
  }

  async openOrdersOf(customerId: string) {
    return this.prisma.client.serviceOrder.findMany({
      where: { customerId, deletedAt: null, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
      select: { id: true, orderNumber: true, status: true, vehicleId: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async pendingCentsOf(customerId: string): Promise<number> {
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { customerId, deletedAt: null }, select: { id: true } });
    if (orders.length === 0) return 0;
    const pending = await this.prisma.client.serviceOrderInstallment.aggregate({
      where: { serviceOrderId: { in: orders.map((order) => order.id) }, status: 'PENDING', deletedAt: null },
      _sum: { amountCents: true },
    });
    return pending._sum.amountCents ?? 0;
  }

  async pendingOrdersOf(customerId: string): Promise<Array<{ id: string; orderNumber: number; pendingCents: number }>> {
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { customerId, deletedAt: null }, select: { id: true, orderNumber: true } });
    if (orders.length === 0) return [];
    const installments = await this.prisma.client.serviceOrderInstallment.findMany({ where: { serviceOrderId: { in: orders.map((order) => order.id) }, status: 'PENDING', deletedAt: null }, select: { serviceOrderId: true, amountCents: true } });
    const pendingByOrder = new Map<string, number>();
    for (const item of installments) pendingByOrder.set(item.serviceOrderId, (pendingByOrder.get(item.serviceOrderId) ?? 0) + item.amountCents);
    return orders.filter((order) => pendingByOrder.has(order.id)).map((order) => ({ id: order.id, orderNumber: order.orderNumber, pendingCents: pendingByOrder.get(order.id) ?? 0 }));
  }

  async upcomingAppointmentsOf(customerId: string, from: Date) {
    return this.prisma.client.appointment.findMany({
      where: { customerId, deletedAt: null, startsAt: { gte: from }, status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_SERVICE'] } },
      select: { id: true, startsAt: true, status: true, serviceDescription: true },
      orderBy: { startsAt: 'asc' },
      take: 5,
    });
  }

  // Customers with something still to receive.
  async idsWithDebt(): Promise<string[]> {
    const installments = await this.prisma.client.serviceOrderInstallment.findMany({ where: { status: 'PENDING', deletedAt: null }, select: { serviceOrderId: true } });
    if (installments.length === 0) return [];
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { id: { in: [...new Set(installments.map((item) => item.serviceOrderId))] }, deletedAt: null }, select: { customerId: true } });
    return [...new Set(orders.map((order) => order.customerId))];
  }

  // Customers who took a car home since `since`.
  async idsDeliveredSince(since: Date): Promise<string[]> {
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { status: 'DELIVERED', closedAt: { gte: since }, deletedAt: null }, select: { customerId: true } });
    return [...new Set(orders.map((order) => order.customerId))];
  }

  async idsDeliveredBefore(since: Date): Promise<string[]> {
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { status: 'DELIVERED', closedAt: { lt: since }, deletedAt: null }, select: { customerId: true } });
    return [...new Set(orders.map((order) => order.customerId))];
  }

  async idsEverDelivered(): Promise<string[]> {
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { status: 'DELIVERED', deletedAt: null }, select: { customerId: true } });
    return [...new Set(orders.map((order) => order.customerId))];
  }

  // Just what is needed to recognise a customer that is already registered.
  async allForMatching() {
    return this.prisma.client.customer.findMany({ where: { deletedAt: null }, select: { id: true, name: true, phone: true, document: true } });
  }

  // Moves everything that hangs off `mergeId` to `keepId`, archives `mergeId` and applies what the kept customer gained.
  // One transaction: either the whole customer moves or nothing does.
  async mergeInto(keepId: string, mergeId: string, keeperPatch: UpdateCustomerInput): Promise<{ movedVehicles: number; movedServiceOrders: number }> {
    return this.prisma.transaction(async (tx) => {
      const move = { where: { customerId: mergeId }, data: { customerId: keepId } };
      const vehicles = await tx.vehicle.updateMany(move);
      const orders = await tx.serviceOrder.updateMany(move);
      await tx.appointment.updateMany(move);
      await tx.customerCarePlan.updateMany(move);
      await tx.customerCareDelivery.updateMany(move);
      await tx.customerMessage.updateMany(move);
      await tx.serviceOrderStatusNotification.updateMany(move);
      await tx.maintenanceAlert.updateMany(move);
      await tx.financialEntry.updateMany(move);
      // The duplicate leaves first, so its document is free for the kept customer to take.
      await tx.customer.updateMany({ where: { id: mergeId, deletedAt: null }, data: { deletedAt: new Date() } });
      if (Object.keys(keeperPatch).length > 0) {
        await tx.customer.updateMany({ where: { id: keepId, deletedAt: null }, data: { ...keeperPatch, address: keeperPatch.address === null ? Prisma.DbNull : keeperPatch.address as Prisma.InputJsonValue | undefined } });
      }
      return { movedVehicles: vehicles.count, movedServiceOrders: orders.count };
    });
  }

  async softDelete(id: string) {
    return this.prisma.client.customer.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async listByTenant(offset: number, limit: number, search?: string, archived = false, ids?: { in?: string[]; notIn?: string[] }, sort?: 'NAME') {
    const where = {
      deletedAt: archived ? { not: null } : null,
      ...(ids ? { id: ids } : {}),
      ...(search ? await this.searchFilter(search) : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.customer.findMany({
        where,
        orderBy: archived ? { deletedAt: 'desc' as const } : sort === 'NAME' ? { name: 'asc' as const } : { createdAt: 'desc' as const },
        skip: offset,
        take: limit,
      }),
      this.prisma.client.customer.count({ where }),
    ]);

    return { items, total };
  }

  // Sorting derived values in SQL keeps pagination correct across the entire workshop.
  async listRanked(offset: number, limit: number, search: string | undefined, filter: CustomerListRequest['filter'], sort: 'LAST_VISIT' | 'RECEIVABLE', now = new Date()) {
    const tenantId = this.tenantContext.getStore()?.tenantId;
    if (!tenantId) throw new Error('Ordenação de clientes exige contexto de oficina.');
    const conditions: Prisma.Sql[] = [Prisma.sql`c.tenant_id = ${tenantId}::uuid`, Prisma.sql`c.deleted_at IS NULL`];
    const term = search?.trim();
    if (term) {
      const digits = term.replace(/\D/g, '');
      const numeric = /^[\d\s()+./-]+$/.test(term) && Boolean(digits);
      const matches: Prisma.Sql[] = [
        Prisma.sql`c.name ILIKE ${`%${term}%`}`,
        Prisma.sql`c.document LIKE ${`%${numeric ? digits : term}%`}`,
        Prisma.sql`c.email ILIKE ${`%${term}%`}`,
        Prisma.sql`c.phone LIKE ${`%${term}%`}`,
      ];
      if (numeric && digits.length >= 8) {
        const national = digits.startsWith('55') && [12, 13].includes(digits.length) ? digits.slice(2) : digits;
        matches.push(Prisma.sql`regexp_replace(c.phone, '[^0-9]', '', 'g') LIKE ${`%${national}%`}`);
      }
      const plate = term.replace(/[^a-zA-Z0-9]/g, '');
      if (plate.length >= 3 && plate.length <= 7) matches.push(Prisma.sql`EXISTS (SELECT 1 FROM vehicles v WHERE v.tenant_id = c.tenant_id AND v.customer_id = c.id AND v.deleted_at IS NULL AND regexp_replace(v.plate, '[^a-zA-Z0-9]', '', 'g') ILIKE ${`%${plate}%`})`);
      conditions.push(Prisma.sql`(${Prisma.join(matches, ' OR ')})`);
    }
    const delivered = Prisma.sql`so.tenant_id = c.tenant_id AND so.customer_id = c.id AND so.deleted_at IS NULL AND so.status = 'DELIVERED'`;
    if (filter === 'INACTIVE') {
      const since = new Date(now.getTime() - 180 * 86_400_000);
      conditions.push(Prisma.sql`EXISTS (SELECT 1 FROM service_orders so WHERE ${delivered} AND so.closed_at < ${since})`);
      conditions.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM service_orders so WHERE ${delivered} AND so.closed_at >= ${since})`);
    }
    if (filter === 'NEVER_VISITED') conditions.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM service_orders so WHERE ${delivered})`);
    const pending = Prisma.sql`SELECT 1 FROM service_orders so JOIN service_order_installments i ON i.service_order_id = so.id AND i.tenant_id = c.tenant_id AND i.deleted_at IS NULL AND i.status = 'PENDING' WHERE so.tenant_id = c.tenant_id AND so.customer_id = c.id AND so.deleted_at IS NULL`;
    if (filter === 'DEBT') conditions.push(Prisma.sql`EXISTS (${pending})`);
    const where = Prisma.sql`${Prisma.join(conditions, ' AND ')}`;
    const ranking = sort === 'LAST_VISIT'
      ? Prisma.sql`(SELECT MAX(so.closed_at) FROM service_orders so WHERE ${delivered}) DESC NULLS LAST`
      : Prisma.sql`(SELECT COALESCE(SUM(i.amount_cents), 0) FROM service_orders so JOIN service_order_installments i ON i.service_order_id = so.id AND i.tenant_id = c.tenant_id AND i.deleted_at IS NULL AND i.status = 'PENDING' WHERE so.tenant_id = c.tenant_id AND so.customer_id = c.id AND so.deleted_at IS NULL) DESC`;
    const [ranked, totals] = await Promise.all([
      this.prisma.client.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT c.id FROM customers c WHERE ${where} ORDER BY ${ranking}, c.id ASC LIMIT ${limit} OFFSET ${offset}`),
      this.prisma.client.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM customers c WHERE ${where}`),
    ]);
    const ids = ranked.map((row) => row.id);
    const found = ids.length ? await this.prisma.client.customer.findMany({ where: { id: { in: ids }, deletedAt: null } }) : [];
    const byId = new Map(found.map((item) => [item.id, item]));
    return { items: ids.map((id) => byId.get(id)).filter((item): item is NonNullable<typeof item> => Boolean(item)), total: Number(totals[0]?.total ?? 0) };
  }
}
