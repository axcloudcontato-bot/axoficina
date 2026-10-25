import { Injectable } from '@nestjs/common';
import type { FinancialEntryStatus, FinancialEntryType } from '@oficina/contracts';
import type { Customer, FinancialCategory, FinancialEntry, Supplier } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class FinancialRepository {
  constructor(private readonly prisma: PrismaService) {}

  categories() {
    return this.prisma.client.financialCategory.findMany({ where: { deletedAt: null }, orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  }
  categoryById(id: string): Promise<FinancialCategory | null> {
    return this.prisma.client.financialCategory.findFirst({ where: { id, deletedAt: null } });
  }
  createCategory(input: { tenantId: string; name: string; type: FinancialEntryType; group?: string; color?: string; isSystem?: boolean }): Promise<FinancialCategory> {
    return this.prisma.client.financialCategory.create({ data: input });
  }
  ensureDefaultCategories(tenantId: string, categories: Array<{ name: string; type: FinancialEntryType; group: string; color: string; isSystem: true }>) {
    return this.prisma.client.financialCategory.createMany({ data: categories.map((category) => ({ tenantId, ...category })), skipDuplicates: true });
  }
  deleteCategory(id: string) {
    return this.prisma.client.financialCategory.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  }
  createEntry(input: { tenantId: string; categoryId: string; supplierId?: string; customerId?: string; type: FinancialEntryType; description: string; amountCents: number; dueAt: Date; status: FinancialEntryStatus; paidAt?: Date; notes?: string; createdBy: string }): Promise<FinancialEntry> {
    return this.prisma.client.financialEntry.create({ data: input });
  }
  entryById(id: string): Promise<FinancialEntry | null> {
    return this.prisma.client.financialEntry.findFirst({ where: { id, deletedAt: null } });
  }
  entries(startAt: Date, endAt: Date, filters?: { type?: FinancialEntryType; status?: FinancialEntryStatus; categoryId?: string }, dateField: 'DUE' | 'PAID' = 'DUE') {
    return this.prisma.client.financialEntry.findMany({ where: { deletedAt: null, ...filters, ...(dateField === 'PAID' ? { status: 'PAID', paidAt: { gte: startAt, lt: endAt } } : { dueAt: { gte: startAt, lt: endAt } }) }, orderBy: { [dateField === 'PAID' ? 'paidAt' : 'dueAt']: 'asc' } });
  }
  settleEntry(id: string, paidAt: Date): Promise<FinancialEntry> {
    return this.prisma.client.financialEntry.update({ where: { id }, data: { status: 'PAID', paidAt } });
  }
  deleteEntry(id: string) {
    return this.prisma.client.financialEntry.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  }
  receipts(startAt: Date, endAt: Date) {
    return this.prisma.client.serviceOrderReceipt.findMany({ where: { deletedAt: null, receivedAt: { gte: startAt, lt: endAt } }, orderBy: { receivedAt: 'asc' } });
  }
  pendingInstallments(startAt: Date, endAt: Date) {
    return this.prisma.client.serviceOrderInstallment.findMany({ where: { deletedAt: null, status: 'PENDING', dueAt: { gte: startAt, lt: endAt } }, orderBy: { dueAt: 'asc' } });
  }
  suppliers() {
    return this.prisma.client.supplier.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
  }
  suppliersByIds(ids: string[]) {
    return this.prisma.client.supplier.findMany({ where: { id: { in: ids }, deletedAt: null } });
  }
  customersByIds(ids: string[]): Promise<Customer[]> {
    return this.prisma.client.customer.findMany({ where: { id: { in: ids }, deletedAt: null } });
  }
  ordersByIds(ids: string[]) {
    return this.prisma.client.serviceOrder.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, orderNumber: true, customerId: true, vehicleId: true } });
  }
  vehiclesByIds(ids: string[]) {
    return this.prisma.client.vehicle.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true, plate: true } });
  }
  customerById(id: string): Promise<Customer | null> {
    return this.prisma.client.customer.findFirst({ where: { id, deletedAt: null } });
  }
  supplierById(id: string): Promise<Supplier | null> {
    return this.prisma.client.supplier.findFirst({ where: { id, deletedAt: null } });
  }
  createSupplier(input: { tenantId: string; name: string; document?: string; contactName?: string; phone?: string; email?: string; paymentTerms?: string; notes?: string }): Promise<Supplier> {
    return this.prisma.client.supplier.create({ data: input });
  }
  updateSupplier(id: string, input: { name: string; document?: string | null; contactName?: string | null; phone?: string | null; email?: string | null; paymentTerms?: string | null; notes?: string | null }): Promise<Supplier> {
    return this.prisma.client.supplier.update({ where: { id }, data: input });
  }
  deleteSupplier(id: string) {
    return this.prisma.client.supplier.updateMany({ where: { id, deletedAt: null }, data: { deletedAt: new Date() } });
  }
}
