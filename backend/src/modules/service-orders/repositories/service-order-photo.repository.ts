import { Injectable } from '@nestjs/common';
import type { ServiceOrderPhotoAngle, ServiceOrderPhotoCategory } from '@oficina/contracts';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class ServiceOrderPhotoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insert(input: {
    tenantId: string;
    serviceOrderId: string;
    category: ServiceOrderPhotoCategory;
    angle?: ServiceOrderPhotoAngle;
    serviceOrderItemId?: string;
    caption?: string;
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }) {
    return this.prisma.client.serviceOrderPhoto.create({ data: input });
  }

  async list(serviceOrderId: string) {
    return this.prisma.client.serviceOrderPhoto.findMany({
      where: { serviceOrderId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Quais dos 6 ângulos padrão já têm foto, pra ENTRY ou EXIT — usado pra
  // decidir o que falta antes de liberar a OS a avançar (ver
  // ServiceOrderManager.transition).
  async distinctAngles(serviceOrderId: string, category: ServiceOrderPhotoCategory): Promise<ServiceOrderPhotoAngle[]> {
    const rows = await this.prisma.client.serviceOrderPhoto.findMany({
      where: { serviceOrderId, category, deletedAt: null, angle: { not: null } },
      select: { angle: true },
      distinct: ['angle'],
    });
    return rows.map((row) => row.angle as ServiceOrderPhotoAngle);
  }

  // Quais itens (peça/serviço) já têm foto de "antes" (ISSUE) e de "depois"
  // (RESOLVED) — usado pra cobrar o par completo por item antes de concluir
  // a OS.
  async itemCategoryCoverage(serviceOrderId: string): Promise<Array<{ serviceOrderItemId: string; category: 'ISSUE' | 'RESOLVED' }>> {
    const rows = await this.prisma.client.serviceOrderPhoto.findMany({
      where: { serviceOrderId, category: { in: ['ISSUE', 'RESOLVED'] }, deletedAt: null, serviceOrderItemId: { not: null } },
      select: { serviceOrderItemId: true, category: true },
      distinct: ['serviceOrderItemId', 'category'],
    });
    return rows.map((row) => ({ serviceOrderItemId: row.serviceOrderItemId as string, category: row.category as 'ISSUE' | 'RESOLVED' }));
  }

  async byId(id: string) {
    return this.prisma.client.serviceOrderPhoto.findFirst({ where: { id, deletedAt: null } });
  }

  async softDelete(id: string) {
    return this.prisma.client.serviceOrderPhoto.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  }
}
