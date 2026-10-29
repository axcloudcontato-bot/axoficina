import { Injectable } from '@nestjs/common';
import type { CatalogItem, CatalogPackage, CatalogPackageItem } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';

export type CatalogInput = {
  type: string; name: string; category: string | null; unitPriceCents: number;
  costCents: number | null; code: string | null; brand: string | null; unit: string; supplierId: string | null;
  standardMinutes: number | null; careServiceKey: string | null;
  trackStock: boolean; minStock: number | null;
};

export interface ReportLine {
  serviceOrderId: string; catalogItemId: string | null; type: string; description: string;
  quantity: unknown; unitPriceCents: number; costCents: number | null;
}

export type StockKind = 'PURCHASE' | 'ADJUSTMENT';

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
  async supplierExists(id: string): Promise<boolean> {
    return Boolean(await this.prisma.client.supplier.findFirst({ where: { id, deletedAt: null }, select: { id: true } }));
  }
  create(tenantId: string, input: CatalogInput): Promise<CatalogItem> {
    return this.prisma.client.catalogItem.create({ data: { tenantId, ...input } });
  }
  createMany(tenantId: string, inputs: Array<Partial<CatalogInput> & Pick<CatalogInput, 'type' | 'name' | 'category' | 'unitPriceCents'>>) {
    return this.prisma.client.catalogItem.createMany({ data: inputs.map((input) => ({ tenantId, ...input })), skipDuplicates: true });
  }
  update(id: string, input: CatalogInput): Promise<CatalogItem> {
    return this.prisma.client.catalogItem.update({ where: { id }, data: input });
  }
  // The balance and its trace move together: PURCHASE adds, ADJUSTMENT sets the counted quantity.
  adjustStock(tenantId: string, id: string, userId: string, kind: StockKind, quantity: number, note: string | null): Promise<CatalogItem> {
    return this.prisma.transaction(async (tx) => {
      const current = await tx.catalogItem.findFirst({ where: { id, deletedAt: null } });
      if (!current) throw new Error('catalog item vanished');
      const delta = kind === 'PURCHASE' ? quantity : quantity - Number(current.stockQuantity);
      const updated = await tx.catalogItem.update({ where: { id }, data: { stockQuantity: { increment: delta } } });
      await tx.stockMovement.create({ data: { tenantId, catalogItemId: id, kind, quantity: delta, balanceAfter: updated.stockQuantity, note, createdBy: userId } });
      return updated;
    });
  }

  // Import: new rows are created, existing ones get the fields the sheet carries.
  async importRows(tenantId: string, create: CatalogInput[], update: Array<{ id: string; data: Partial<CatalogInput> }>) {
    await this.prisma.transaction(async (tx) => {
      if (create.length) await tx.catalogItem.createMany({ data: create.map((input) => ({ tenantId, ...input })), skipDuplicates: true });
      for (const { id, data } of update) await tx.catalogItem.update({ where: { id }, data });
    });
  }

  async reportLines(tenantId: string, since: Date): Promise<ReportLine[]> {
    // Items carry no tenant column: the delivered orders (tenant-scoped) say which items count.
    const orders = await this.prisma.client.serviceOrder.findMany({ where: { tenantId, status: 'DELIVERED', closedAt: { gte: since }, deletedAt: null }, select: { id: true } });
    return this.prisma.client.serviceOrderItem.findMany({
      where: { serviceOrderId: { in: orders.map((order) => order.id) }, deletedAt: null },
      select: { serviceOrderId: true, catalogItemId: true, type: true, description: true, quantity: true, unitPriceCents: true, costCents: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  listPackages(): Promise<CatalogPackage[]> {
    return this.prisma.client.catalogPackage.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  }
  packageById(id: string): Promise<CatalogPackage | null> {
    return this.prisma.client.catalogPackage.findFirst({ where: { id, deletedAt: null } });
  }
  packageByName(name: string): Promise<CatalogPackage | null> {
    return this.prisma.client.catalogPackage.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, deletedAt: null } });
  }
  packageLines(packageIds: string[]): Promise<CatalogPackageItem[]> {
    return this.prisma.client.catalogPackageItem.findMany({ where: { packageId: { in: packageIds } } });
  }
  async existingItemIds(ids: string[]): Promise<Set<string>> {
    const rows = await this.prisma.client.catalogItem.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } });
    return new Set(rows.map((row) => row.id));
  }
  savePackage(tenantId: string, id: string | undefined, name: string, items: Array<{ catalogItemId: string; quantity: number }>): Promise<CatalogPackage> {
    return this.prisma.transaction(async (tx) => {
      const saved = id
        ? await tx.catalogPackage.update({ where: { id }, data: { name } })
        : await tx.catalogPackage.create({ data: { tenantId, name } });
      await tx.catalogPackageItem.deleteMany({ where: { packageId: saved.id } });
      await tx.catalogPackageItem.createMany({ data: items.map((item) => ({ packageId: saved.id, ...item })) });
      return saved;
    });
  }
  removePackage(id: string) {
    return this.prisma.client.catalogPackage.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  }

  remove(id: string) {
    return this.prisma.client.catalogItem.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  }
}
