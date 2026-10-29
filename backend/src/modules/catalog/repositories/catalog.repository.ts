import { Injectable } from '@nestjs/common';
import type { CatalogItem } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';

type Input = { type: string; name: string; category: string | null; unitPriceCents: number };

@Injectable()
export class CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<CatalogItem[]> {
    return this.prisma.client.catalogItem.findMany({ where: { deletedAt: null }, orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  }
  byId(id: string): Promise<CatalogItem | null> {
    return this.prisma.client.catalogItem.findFirst({ where: { id, deletedAt: null } });
  }
  findByName(type: string, name: string): Promise<CatalogItem | null> {
    return this.prisma.client.catalogItem.findFirst({ where: { type, name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
  }
  create(tenantId: string, input: Input): Promise<CatalogItem> {
    return this.prisma.client.catalogItem.create({ data: { tenantId, ...input } });
  }
  createMany(tenantId: string, inputs: Input[]) {
    return this.prisma.client.catalogItem.createMany({ data: inputs.map((input) => ({ tenantId, ...input })), skipDuplicates: true });
  }
  update(id: string, input: Input): Promise<CatalogItem> {
    return this.prisma.client.catalogItem.update({ where: { id }, data: input });
  }
  remove(id: string) {
    return this.prisma.client.catalogItem.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  }
}
