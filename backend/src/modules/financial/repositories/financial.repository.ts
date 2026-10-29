import { Injectable } from '@nestjs/common';
import type { FinancialEntryStatus, FinancialEntryType } from '@oficina/contracts';
import type { Customer, FinancialCashBaseline, FinancialCategory, FinancialEntry, FinancialEntryAttachment, FinancialReconciliation, Supplier } from '@oficina/database';
import { PrismaService } from '../../../shared/prisma/prisma.service';

@Injectable()
export class FinancialRepository {
  constructor(private readonly prisma: PrismaService) {}

  cashBaseline(): Promise<FinancialCashBaseline | null> { return this.prisma.client.financialCashBaseline.findFirst(); }
  saveCashBaseline(tenantId: string, amountCents: number, asOf: Date): Promise<FinancialCashBaseline> { return this.prisma.client.financialCashBaseline.upsert({ where: { tenantId }, create: { tenantId, amountCents, asOf }, update: { amountCents, asOf } }); }

  categories() {
    return this.prisma.client.financialCategory.findMany({ where: { deletedAt: null }, orderBy: [{ type: 'asc' }, { name: 'asc' }] });
  }
  categoryById(id: string): Promise<FinancialCategory | null> {
    return this.prisma.client.financialCategory.findFirst({ where: { id, deletedAt: null } });
  }
  createCategory(input: { tenantId: string; name: string; type: FinancialEntryType; group?: string; color?: string; isSystem?: boolean }): Promise<FinancialCategory> {
    return this.prisma.client.financialCategory.create({ data: input });
  }
  updateCategory(id: string, data: { name: string; color?: string }): Promise<FinancialCategory> {
    return this.prisma.client.financialCategory.update({ where: { id }, data });
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
  createRecurringEntries(inputs: Array<Parameters<FinancialRepository['createEntry']>[0]>): Promise<FinancialEntry> {
    return this.prisma.transaction(async tx => {
      const first = await tx.financialEntry.create({ data: inputs[0] });
      for (const input of inputs.slice(1)) await tx.financialEntry.create({ data: input });
      return first;
    });
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
  async addPayment(user: { tenantId: string; userId: string }, id: string, amountCents: number, paidAt: Date, method?: string): Promise<FinancialEntry> {
    return this.prisma.transaction(async tx => {
      const current = await tx.financialEntry.findFirst({ where: { id, tenantId: user.tenantId, deletedAt: null, status: 'PENDING' } });
      if (!current || current.paidCents + amountCents > current.amountCents) throw new Error('FINANCIAL_PAYMENT_EXCEEDS_BALANCE');
      const updated = await tx.financialEntry.updateMany({ where: { id, tenantId: user.tenantId, paidCents: current.paidCents, status: 'PENDING' }, data: { paidCents: current.paidCents + amountCents, paymentManaged: true, ...(current.paidCents + amountCents === current.amountCents ? { status: 'PAID', paidAt } : {}) } });
      if (updated.count !== 1) throw new Error('FINANCIAL_PAYMENT_CONFLICT');
      await tx.financialEntryPayment.create({ data: { tenantId: user.tenantId, entryId: id, amountCents, paidAt, method, createdBy: user.userId } });
      return (await tx.financialEntry.findFirst({ where: { id, tenantId: user.tenantId } }))!;
    });
  }
  async reversePayment(tenantId: string, paymentId: string): Promise<FinancialEntry | null> {
    return this.prisma.transaction(async tx => {
      const payment = await tx.financialEntryPayment.findFirst({ where: { id: paymentId, tenantId, deletedAt: null } });
      if (!payment) return null;
      const entry = await tx.financialEntry.findFirst({ where: { id: payment.entryId, tenantId, deletedAt: null } });
      if (!entry || entry.paidCents < payment.amountCents) throw new Error('FINANCIAL_PAYMENT_CONFLICT');
      const updated = await tx.financialEntry.updateMany({ where: { id: entry.id, tenantId, paidCents: entry.paidCents }, data: { paidCents: entry.paidCents - payment.amountCents, status: 'PENDING', paidAt: null } });
      if (updated.count !== 1) throw new Error('FINANCIAL_PAYMENT_CONFLICT');
      await tx.financialEntryPayment.updateMany({ where: { id: paymentId, tenantId, deletedAt: null }, data: { deletedAt: new Date() } });
      await tx.financialReconciliation.deleteMany({ where: { tenantId, source: 'PAYMENT', sourceId: paymentId } });
      return (await tx.financialEntry.findFirst({ where: { id: entry.id, tenantId } }))!;
    });
  }
  payments(startAt: Date, endAt: Date) { return this.prisma.client.financialEntryPayment.findMany({ where: { deletedAt: null, paidAt: { gte: startAt, lt: endAt } }, orderBy: { paidAt: 'asc' } }); }
  entriesByIds(ids: string[]) { return this.prisma.client.financialEntry.findMany({ where: { id: { in: ids }, deletedAt: null } }); }
  async movementExists(source: 'MANUAL' | 'PAYMENT' | 'SERVICE_ORDER', id: string): Promise<boolean> {
    if (source === 'MANUAL') return Boolean(await this.prisma.client.financialEntry.findFirst({ where: { id, deletedAt: null, status: 'PAID', paymentManaged: false } }));
    if (source === 'PAYMENT') return Boolean(await this.prisma.client.financialEntryPayment.findFirst({ where: { id, deletedAt: null } }));
    return Boolean(await this.prisma.client.serviceOrderReceipt.findFirst({ where: { id, deletedAt: null } }));
  }
  reconciliations(ids: string[]) { return this.prisma.client.financialReconciliation.findMany({ where: { sourceId: { in: ids } } }); }
  reconcile(tenantId: string, userId: string, source: string, sourceId: string, bankReference: string): Promise<FinancialReconciliation> { return this.prisma.client.financialReconciliation.upsert({ where: { tenantId_source_sourceId: { tenantId, source, sourceId } }, create: { tenantId, source, sourceId, bankReference, reconciledBy: userId }, update: { bankReference, reconciledBy: userId, reconciledAt: new Date() } }); }
  createAttachment(tenantId: string, userId: string, entryId: string, name: string, mimeType: string, content: Buffer): Promise<FinancialEntryAttachment> { return this.prisma.client.financialEntryAttachment.create({ data: { tenantId, entryId, name, mimeType, content: Uint8Array.from(content), createdBy: userId } }); }
  attachments(entryId: string) { return this.prisma.client.financialEntryAttachment.findMany({ where: { entryId }, select: { id: true, name: true, mimeType: true, createdAt: true }, orderBy: { createdAt: 'desc' } }); }
  attachment(entryId: string, id: string): Promise<FinancialEntryAttachment | null> { return this.prisma.client.financialEntryAttachment.findFirst({ where: { id, entryId } }); }
  updateEntry(id: string, data: { categoryId: string; supplierId: string | null; customerId: string | null; type: FinancialEntryType; description: string; amountCents: number; dueAt: Date; notes: string | null }): Promise<FinancialEntry> {
    return this.prisma.client.financialEntry.update({ where: { id }, data });
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
