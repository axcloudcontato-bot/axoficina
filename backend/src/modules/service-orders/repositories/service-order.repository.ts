import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@oficina/database';
import type { ServiceOrderStatus } from '@oficina/contracts';
import type { PaymentMethod } from '@oficina/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';

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
}

@Injectable()
export class ServiceOrderRepository {
  constructor(private readonly prisma: PrismaService) {}

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
  ) {
    const where = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(vehicleId ? { vehicleId } : {}),
      ...(technicianId ? { technicianId } : {}),
      ...(customerId ? { customerId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.client.serviceOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.client.serviceOrder.count({ where }),
    ]);

    return { items, total };
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

  // Mesmo formato do listForBusinessSummary, mas com o período de entrega
  // (closedAt) arbitrário em vez de fixo em "últimos 6 meses" — usado pelo
  // controle de produtividade por técnico. OS ativas (não entregues) sempre
  // entram, independente do período, porque "carga atual" é sempre "agora".
  async listForProductivity(startAt: Date, endAt: Date) {
    return this.prisma.client.serviceOrder.findMany({
      where: {
        deletedAt: null,
        OR: [
          { status: { in: ['OPEN', 'AWAITING_APPROVAL', 'IN_PROGRESS', 'WAITING_PARTS', 'COMPLETED'] } },
          { status: 'DELIVERED', closedAt: { gte: startAt, lte: endAt } },
        ],
      },
    });
  }
}
