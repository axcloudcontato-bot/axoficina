import { Injectable } from '@nestjs/common';
import type { PrismaClient } from '@oficina/database';
import type { ServiceOrderStatus } from '@oficina/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface CreateServiceOrderStatusHistoryInput {
  serviceOrderId: string;
  fromStatus: ServiceOrderStatus | null;
  toStatus: ServiceOrderStatus;
  changedBy: string;
  changedAt: Date;
}

// Sem tenant_id na tabela de propósito — ver comentário no schema.prisma e
// o Gotcha do plano ordem-de-servico.md. `serviceOrderId` sempre chega aqui
// já validado por um lookup tenant-scoped em ServiceOrderRepository.
@Injectable()
export class ServiceOrderStatusHistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // `tx` opcional: create/transition sempre gravam o histórico na mesma
  // transação que muda o status da OS, mesmo padrão de UserRepository.insert.
  async insert(input: CreateServiceOrderStatusHistoryInput, tx?: PrismaClient) {
    const db = tx ?? this.prisma.client;
    return db.serviceOrderStatusHistory.create({
      data: {
        serviceOrderId: input.serviceOrderId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        changedBy: input.changedBy,
        changedAt: input.changedAt,
      },
    });
  }

  // When each order entered the status it is in now (its latest transition into it).
  async statusSince(orders: Array<{ id: string; status: string }>): Promise<Map<string, Date>> {
    const since = new Map<string, Date>();
    if (orders.length === 0) return since;
    const current = new Map(orders.map((order) => [order.id, order.status]));
    const rows = await this.prisma.client.serviceOrderStatusHistory.findMany({
      where: { serviceOrderId: { in: orders.map((order) => order.id) } },
      orderBy: { changedAt: 'desc' },
      select: { serviceOrderId: true, toStatus: true, changedAt: true },
    });
    for (const row of rows) if (!since.has(row.serviceOrderId) && row.toStatus === current.get(row.serviceOrderId)) since.set(row.serviceOrderId, row.changedAt);
    return since;
  }

  async byServiceOrderId(serviceOrderId: string) {
    return this.prisma.client.serviceOrderStatusHistory.findMany({
      where: { serviceOrderId },
      orderBy: { changedAt: 'asc' },
    });
  }
}
