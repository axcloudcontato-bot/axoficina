import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CashFlowSummaryResponse,
  CreateFinancialCategoryRequest,
  CreateFinancialEntryRequest,
  FinancialCategoryResponse,
  FinancialEntryResponse,
  ListFinancialEntriesRequest,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  SupplierResponse,
} from '@oficina/contracts';
import type { AuthenticatedUser } from '../../../shared/guards/jwt-auth.guard';
import { AppErrorCode } from '../../../shared/errors/app-error-code';
import { AppException } from '../../../shared/errors/app-exception';
import { AuditLogService } from '../../../shared/audit-log/audit-log.service';
import { FinancialRepository } from '../repositories/financial.repository';
import { DEFAULT_FINANCIAL_CATEGORIES } from '../default-financial-categories';

@Injectable()
export class FinancialManager {
  constructor(private readonly repository: FinancialRepository, private readonly audit: AuditLogService) {}

  async listCategories(user: AuthenticatedUser): Promise<{ categories: FinancialCategoryResponse[] }> {
    await this.repository.ensureDefaultCategories(user.tenantId, DEFAULT_FINANCIAL_CATEGORIES);
    const categories = await this.repository.categories();
    return { categories: categories.map((item) => this.categoryResponse(item)) };
  }

  async createCategory(user: AuthenticatedUser, request: CreateFinancialCategoryRequest): Promise<{ category: FinancialCategoryResponse }> {
    const category = await this.repository.createCategory({ tenantId: user.tenantId, name: request.name.trim(), type: request.type, group: 'Personalizadas', color: request.color });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.category_created', entity: 'financial_category', entityId: category.id, metadata: { type: category.type } });
    return { category: this.categoryResponse(category) };
  }

  async deleteCategory(user: AuthenticatedUser, id: string): Promise<{ success: true }> {
    const category = await this.repository.categoryById(id);
    if (!category) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Categoria financeira não encontrada.', HttpStatus.NOT_FOUND);
    const used = (await this.repository.entries(new Date(0), new Date('9999-12-31T00:00:00Z'), { categoryId: id })).length > 0;
    if (used) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'A categoria possui lançamentos e não pode ser excluída.', HttpStatus.BAD_REQUEST);
    await this.repository.deleteCategory(id);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.category_deleted', entity: 'financial_category', entityId: id, metadata: {} });
    return { success: true };
  }

  async createEntry(user: AuthenticatedUser, request: CreateFinancialEntryRequest): Promise<{ entry: FinancialEntryResponse }> {
    const category = await this.repository.categoryById(request.categoryId);
    if (!category || category.type !== request.type) {
      throw new AppException(AppErrorCode.VALIDATION_ERROR, 'A categoria não corresponde ao tipo do lançamento.', HttpStatus.BAD_REQUEST);
    }
    let supplierName: string | undefined;
    let customerName: string | undefined;
    if (request.type === 'EXPENSE') {
      if (!request.supplierId) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Selecione o fornecedor da conta a pagar.', HttpStatus.BAD_REQUEST);
      const supplier = await this.repository.supplierById(request.supplierId);
      if (!supplier || supplier.status !== 'ACTIVE') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Fornecedor não encontrado ou bloqueado.', HttpStatus.BAD_REQUEST);
      supplierName = supplier.name;
    } else {
      if (!request.customerId) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Selecione o cliente da conta a receber.', HttpStatus.BAD_REQUEST);
      const customer = await this.repository.customerById(request.customerId);
      if (!customer) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Cliente não encontrado.', HttpStatus.BAD_REQUEST);
      customerName = customer.name;
    }
    const status = request.status ?? 'PENDING';
    const entry = await this.repository.createEntry({
      tenantId: user.tenantId,
      categoryId: category.id,
      supplierId: request.type === 'EXPENSE' ? request.supplierId : undefined,
      customerId: request.type === 'INCOME' ? request.customerId : undefined,
      type: request.type,
      description: request.description.trim(),
      amountCents: request.amountCents,
      dueAt: new Date(request.dueAt),
      status,
      paidAt: status === 'PAID' ? new Date(request.paidAt ?? Date.now()) : undefined,
      notes: request.notes?.trim() || undefined,
      createdBy: user.userId,
    });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.entry_created', entity: 'financial_entry', entityId: entry.id, metadata: { type: entry.type, amountCents: entry.amountCents } });
    return { entry: this.entryResponse(entry, category.name, supplierName, customerName) };
  }

  async settleEntry(user: AuthenticatedUser, id: string, paidAt?: string): Promise<{ entry: FinancialEntryResponse }> {
    const existing = await this.repository.entryById(id);
    if (!existing) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Lançamento financeiro não encontrado.', HttpStatus.NOT_FOUND);
    const category = await this.repository.categoryById(existing.categoryId);
    const entry = await this.repository.settleEntry(id, paidAt ? new Date(paidAt) : new Date());
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.entry_settled', entity: 'financial_entry', entityId: id, metadata: { amountCents: entry.amountCents } });
    return { entry: this.entryResponse(entry, category?.name ?? 'Categoria removida') };
  }

  async deleteEntry(user: AuthenticatedUser, id: string): Promise<{ success: true }> {
    const existing = await this.repository.entryById(id);
    if (!existing) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Lançamento financeiro não encontrado.', HttpStatus.NOT_FOUND);
    await this.repository.deleteEntry(id);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.entry_deleted', entity: 'financial_entry', entityId: id, metadata: {} });
    return { success: true };
  }

  async cashFlow(request: ListFinancialEntriesRequest): Promise<CashFlowSummaryResponse> {
    const startAt = new Date(request.startAt);
    const endAt = new Date(request.endAt);
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt >= endAt) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe um período financeiro válido.', HttpStatus.BAD_REQUEST);
    if (request.dateField === 'PAID' && request.status === 'PENDING') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'A consulta por realização inclui apenas pagamentos e recebimentos realizados.', HttpStatus.BAD_REQUEST);
    const [categories, manualEntries, receipts, installments] = await Promise.all([
      this.repository.categories(),
      this.repository.entries(startAt, endAt, { type: request.type, status: request.status, categoryId: request.categoryId }, request.dateField ?? 'DUE'),
      request.type === 'EXPENSE' || request.status === 'PENDING' || request.categoryId ? [] : this.repository.receipts(startAt, endAt),
      request.type === 'EXPENSE' || request.status === 'PAID' || request.dateField === 'PAID' || request.categoryId ? [] : this.repository.pendingInstallments(startAt, endAt),
    ]);
    const suppliers = await this.repository.suppliersByIds([...new Set(manualEntries.map((entry) => entry.supplierId).filter((id): id is string => Boolean(id)))]);
    const orderIds = [...new Set([...receipts, ...installments].map(item => item.serviceOrderId))];
    const orders = orderIds.length ? await this.repository.ordersByIds(orderIds) : [];
    const [customers, vehicles] = await Promise.all([
      this.repository.customersByIds([...new Set([...manualEntries.map(entry => entry.customerId), ...orders.map(order => order.customerId)].filter((id): id is string => Boolean(id)))]),
      orders.length ? this.repository.vehiclesByIds([...new Set(orders.map(order => order.vehicleId))]) : [],
    ]);
    const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
    const customerMap = new Map(customers.map((customer) => [customer.id, customer.name]));
    const categoryMap = new Map(categories.map((item) => [item.id, item.name]));
    const vehicleMap = new Map(vehicles.map(vehicle => [vehicle.id, vehicle.plate]));
    const orderMap = new Map(orders.map(order => [order.id, { serviceOrderNumber: order.orderNumber, customerId: order.customerId, customerName: customerMap.get(order.customerId), vehiclePlate: vehicleMap.get(order.vehicleId) }]));
    const entries: FinancialEntryResponse[] = [
      ...manualEntries.map((entry) => this.entryResponse(entry, categoryMap.get(entry.categoryId) ?? 'Categoria removida', entry.supplierId ? supplierMap.get(entry.supplierId) : undefined, entry.customerId ? customerMap.get(entry.customerId) : undefined)),
      ...receipts.map((receipt) => ({
        id: receipt.id, categoryName: 'Recebimentos de OS', type: 'INCOME' as const, description: 'Recebimento de ordem de serviço',
        amountCents: receipt.amountCents, dueAt: receipt.receivedAt.toISOString(), status: 'PAID' as const, paidAt: receipt.receivedAt.toISOString(),
        source: 'SERVICE_ORDER' as const, serviceOrderId: receipt.serviceOrderId, ...orderMap.get(receipt.serviceOrderId), paymentMethod: receipt.method, notes: receipt.notes ?? undefined,
      })),
      ...installments.map((item) => ({
        id: item.id, categoryName: 'Parcelas de OS', type: 'INCOME' as const, description: `Parcela ${item.installmentNumber}/${item.installmentCount} de ordem de serviço`,
        amountCents: item.amountCents, dueAt: item.dueAt.toISOString(), status: 'PENDING' as const,
        source: 'SERVICE_ORDER' as const, serviceOrderId: item.serviceOrderId, ...orderMap.get(item.serviceOrderId),
      })),
    ].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
    const sum = (type: 'INCOME' | 'EXPENSE', status: 'PAID' | 'PENDING') => entries.filter((item) => item.type === type && item.status === status).reduce((total, item) => total + item.amountCents, 0);
    const realizedIncomeCents = sum('INCOME', 'PAID');
    const realizedExpenseCents = sum('EXPENSE', 'PAID');
    const projectedIncomeCents = sum('INCOME', 'PENDING');
    const projectedExpenseCents = sum('EXPENSE', 'PENDING');
    return {
      realizedIncomeCents, realizedExpenseCents, projectedIncomeCents, projectedExpenseCents,
      realizedBalanceCents: realizedIncomeCents - realizedExpenseCents,
      projectedBalanceCents: realizedIncomeCents + projectedIncomeCents - realizedExpenseCents - projectedExpenseCents,
      entries,
      categories: categories.map((item) => this.categoryResponse(item)),
    };
  }

  private categoryResponse(category: { id: string; name: string; type: string; group: string; color: string | null; isSystem: boolean }): FinancialCategoryResponse {
    return { id: category.id, name: category.name, type: category.type as FinancialCategoryResponse['type'], group: category.group, color: category.color ?? undefined, isSystem: category.isSystem };
  }
  private entryResponse(entry: { id: string; categoryId: string; supplierId?: string | null; customerId?: string | null; type: string; description: string; amountCents: number; dueAt: Date; status: string; paidAt: Date | null; notes: string | null }, categoryName: string, supplierName?: string, customerName?: string): FinancialEntryResponse {
    return { id: entry.id, categoryId: entry.categoryId, categoryName, supplierId: entry.supplierId ?? undefined, supplierName, customerId: entry.customerId ?? undefined, customerName, type: entry.type as FinancialEntryResponse['type'], description: entry.description, amountCents: entry.amountCents, dueAt: entry.dueAt.toISOString(), status: entry.status as FinancialEntryResponse['status'], paidAt: entry.paidAt?.toISOString(), notes: entry.notes ?? undefined, source: 'MANUAL' };
  }

  async listSuppliers(): Promise<{ suppliers: SupplierResponse[] }> {
    return { suppliers: (await this.repository.suppliers()).map((supplier) => this.supplierResponse(supplier)) };
  }
  async createSupplier(user: AuthenticatedUser, request: CreateSupplierRequest): Promise<{ supplier: SupplierResponse }> {
    const supplier = await this.repository.createSupplier({ tenantId: user.tenantId, ...cleanSupplier(request) });
    return { supplier: this.supplierResponse(supplier) };
  }
  async updateSupplier(user: AuthenticatedUser, request: UpdateSupplierRequest): Promise<{ supplier: SupplierResponse }> {
    const existing = await this.repository.supplierById(request.id);
    if (!existing) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Fornecedor não encontrado.', HttpStatus.NOT_FOUND);
    const supplier = await this.repository.updateSupplier(request.id, cleanSupplier(request));
    return { supplier: this.supplierResponse(supplier) };
  }
  async deleteSupplier(user: AuthenticatedUser, id: string): Promise<{ success: true }> {
    const existing = await this.repository.supplierById(id);
    if (!existing) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Fornecedor não encontrado.', HttpStatus.NOT_FOUND);
    await this.repository.deleteSupplier(id);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.supplier_deleted', entity: 'supplier', entityId: id, metadata: {} });
    return { success: true };
  }
  private supplierResponse(supplier: { id: string; name: string; document: string | null; contactName: string | null; phone: string | null; email: string | null; paymentTerms: string | null; notes: string | null; status: string }): SupplierResponse {
    return { id: supplier.id, name: supplier.name, document: supplier.document ?? undefined, contactName: supplier.contactName ?? undefined, phone: supplier.phone ?? undefined, email: supplier.email ?? undefined, paymentTerms: supplier.paymentTerms ?? undefined, notes: supplier.notes ?? undefined, status: supplier.status as SupplierResponse['status'] };
  }
}

function cleanSupplier(request: CreateSupplierRequest) {
  const value = (text?: string) => text?.trim() || undefined;
  return { name: request.name.trim(), document: value(request.document), contactName: value(request.contactName), phone: value(request.phone), email: value(request.email), paymentTerms: value(request.paymentTerms), notes: value(request.notes) };
}
