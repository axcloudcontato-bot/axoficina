import { Injectable } from '@nestjs/common';
import type { PrismaClient, ServiceOrderItem } from '@oficina/database';
import type { CreateServiceOrderItemRequest, ServiceOrderItemType } from '@oficina/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export interface CreateServiceOrderItemInput {
  careServiceKey?: CreateServiceOrderItemRequest['careServiceKey'];
  serviceOrderId: string;
  type: ServiceOrderItemType;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface UpdateServiceOrderItemInput {
  careServiceKey?: CreateServiceOrderItemRequest['careServiceKey'] | null;
  type?: ServiceOrderItemType;
  description?: string;
  quantity?: number;
  unitPriceCents?: number;
}

// Sem tenant_id na tabela de propósito — ver comentário no schema.prisma.
// `serviceOrderId` sempre chega aqui já validado por um lookup tenant-scoped
// em ServiceOrderRepository.
@Injectable()
export class ServiceOrderItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(input: CreateServiceOrderItemInput, tx?: PrismaClient): Promise<ServiceOrderItem> {
    const db = tx ?? this.prisma.client;
    return db.serviceOrderItem.create({
      data: {
        serviceOrderId: input.serviceOrderId,
        type: input.type,
        description: input.description,
        careServiceKey: input.careServiceKey,
        quantity: input.quantity,
        unitPriceCents: input.unitPriceCents,
      },
    });
  }

  async byId(id: string): Promise<ServiceOrderItem | null> {
    return this.prisma.client.serviceOrderItem.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async byServiceOrderId(serviceOrderId: string): Promise<ServiceOrderItem[]> {
    return this.prisma.client.serviceOrderItem.findMany({
      where: { serviceOrderId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  async update(id: string, patch: UpdateServiceOrderItemInput) {
    return this.prisma.client.serviceOrderItem.updateMany({
      where: { id, deletedAt: null },
      data: patch,
    });
  }

  async softDelete(id: string) {
    return this.prisma.client.serviceOrderItem.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  // Soma em JS, não em SQL: Prisma `groupBy` não expressa `SUM(qty * price)`
  // diretamente sem um raw query, e o volume de itens por OS é pequeno o
  // bastante pra isso não ter custo de performance real (ver plano
  // itens-e-preco-da-os.md). Usado por ServiceOrderManager.list pra não
  // carregar `items` completo, só o total, por OS da página.
  async sumTotalsByServiceOrderIds(serviceOrderIds: string[]): Promise<Map<string, number>> {
    if (serviceOrderIds.length === 0) {
      return new Map();
    }
    const items = await this.prisma.client.serviceOrderItem.findMany({
      where: { serviceOrderId: { in: serviceOrderIds }, deletedAt: null },
      select: { serviceOrderId: true, quantity: true, unitPriceCents: true },
    });

    const totals = new Map<string, number>();
    for (const item of items) {
      const lineTotal = Math.round(item.quantity.toNumber() * item.unitPriceCents);
      totals.set(item.serviceOrderId, (totals.get(item.serviceOrderId) ?? 0) + lineTotal);
    }
    return totals;
  }

  async financialItemsByServiceOrderIds(serviceOrderIds: string[]) {
    if (serviceOrderIds.length === 0) return [];
    const items = await this.prisma.client.serviceOrderItem.findMany({
      where: { serviceOrderId: { in: serviceOrderIds }, deletedAt: null },
      select: { serviceOrderId: true, type: true, description: true, quantity: true, unitPriceCents: true },
    });
    return items.map((item) => ({
      serviceOrderId: item.serviceOrderId,
      type: item.type,
      description: item.description,
      lineTotalCents: Math.round(item.quantity.toNumber() * item.unitPriceCents),
    }));
  }
}
