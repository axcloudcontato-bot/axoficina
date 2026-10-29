import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CashFlowSummaryResponse,
  CreateFinancialCategoryRequest,
  CreateFinancialEntryRequest,
  UpdateFinancialCategoryRequest,
  SaveFinancialCashBaselineRequest,
  AddFinancialPaymentRequest,
  UploadFinancialAttachmentRequest,
  ReconcileFinancialMovementRequest,
  ReverseFinancialPaymentRequest,
  UpdateFinancialEntryRequest,
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
  async updateCategory(user: AuthenticatedUser, request: UpdateFinancialCategoryRequest): Promise<{ category: FinancialCategoryResponse }> {
    const existing = await this.repository.categoryById(request.id);
    if (!existing) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Categoria financeira não encontrada.', HttpStatus.NOT_FOUND);
    if (existing.isSystem || existing.type !== request.type) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'A natureza e as categorias padrão não podem ser alteradas.', HttpStatus.BAD_REQUEST);
    const category = await this.repository.updateCategory(request.id, { name: request.name.trim(), color: request.color });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.category_updated', entity: 'financial_category', entityId: category.id, metadata: { previousName: existing.name, name: category.name } });
    return { category: this.categoryResponse(category) };
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
    const input = {
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
    };
    const count = request.recurrenceMonths ?? 1;
    if (count > 1 && status !== 'PENDING') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Contas recorrentes devem começar como previstas.', HttpStatus.BAD_REQUEST);
    const due = new Date(request.dueAt);
    const day = due.getUTCDate();
    const inputs = Array.from({ length: count }, (_, offset) => {
      const monthStart = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + offset, 1, due.getUTCHours(), due.getUTCMinutes()));
      const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
      monthStart.setUTCDate(Math.min(day, lastDay));
      return { ...input, dueAt: monthStart, description: count > 1 ? `${input.description} (${offset + 1}/${count})` : input.description };
    });
    const entry = count > 1 ? await this.repository.createRecurringEntries(inputs) : await this.repository.createEntry(inputs[0]);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.entry_created', entity: 'financial_entry', entityId: entry.id, metadata: { type: entry.type, amountCents: entry.amountCents } });
    return { entry: this.entryResponse(entry, category.name, supplierName, customerName) };
  }

  async settleEntry(user: AuthenticatedUser, id: string, paidAt?: string): Promise<{ entry: FinancialEntryResponse }> {
    const existing = await this.repository.entryById(id);
    if (!existing) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Lançamento financeiro não encontrado.', HttpStatus.NOT_FOUND);
    if (existing.status !== 'PENDING') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Este lançamento já foi realizado.', HttpStatus.CONFLICT);
    return this.addPayment(user, { id, amountCents: existing.amountCents - existing.paidCents, paidAt: paidAt ?? new Date().toISOString() });
  }
  async addPayment(user: AuthenticatedUser, request: AddFinancialPaymentRequest): Promise<{ entry: FinancialEntryResponse }> {
    const existing = await this.repository.entryById(request.id);
    if (!existing || existing.status !== 'PENDING') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Conta pendente não encontrada.', HttpStatus.NOT_FOUND);
    if (request.amountCents > existing.amountCents - existing.paidCents) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'O valor supera o saldo da conta.', HttpStatus.BAD_REQUEST);
    const entry = await this.repository.addPayment(user, request.id, request.amountCents, new Date(request.paidAt), request.method);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.entry_payment_added', entity: 'financial_entry', entityId: entry.id, metadata: { amountCents: request.amountCents, method: request.method } });
    const category = await this.repository.categoryById(entry.categoryId);
    return { entry: this.entryResponse(entry, category?.name ?? 'Categoria removida') };
  }
  async reversePayment(user: AuthenticatedUser, request: ReverseFinancialPaymentRequest) {
    const entry = await this.repository.reversePayment(user.tenantId, request.id);
    if (!entry) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Baixa não encontrada.', HttpStatus.NOT_FOUND);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.entry_payment_reversed', entity: 'financial_entry_payment', entityId: request.id, metadata: { entryId: entry.id, reason: request.reason.trim() } });
    return { success: true };
  }

  async updateEntry(user: AuthenticatedUser, request: UpdateFinancialEntryRequest): Promise<{ entry: FinancialEntryResponse }> {
    const existing = await this.repository.entryById(request.id);
    if (!existing) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Lançamento financeiro não encontrado.', HttpStatus.NOT_FOUND);
    if (existing.status !== 'PENDING') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Estorne o lançamento realizado antes de corrigi-lo.', HttpStatus.CONFLICT);
    if (request.amountCents <= existing.paidCents) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'O valor total deve superar os pagamentos já registrados.', HttpStatus.BAD_REQUEST);
    if (existing.paidCents > 0 && (request.type !== existing.type || request.categoryId !== existing.categoryId)) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Natureza e categoria não podem mudar após uma baixa parcial.', HttpStatus.CONFLICT);
    const category = await this.repository.categoryById(request.categoryId);
    if (!category || category.type !== request.type) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Categoria incompatível com o lançamento.', HttpStatus.BAD_REQUEST);
    if (request.type === 'EXPENSE') {
      const supplier = request.supplierId ? await this.repository.supplierById(request.supplierId) : null;
      if (!supplier || supplier.status !== 'ACTIVE') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Fornecedor não encontrado ou bloqueado.', HttpStatus.BAD_REQUEST);
    }
    if (request.type === 'INCOME' && (!request.customerId || !(await this.repository.customerById(request.customerId)))) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Cliente não encontrado.', HttpStatus.BAD_REQUEST);
    const entry = await this.repository.updateEntry(request.id, { categoryId: request.categoryId, supplierId: request.type === 'EXPENSE' ? request.supplierId! : null, customerId: request.type === 'INCOME' ? request.customerId! : null, type: request.type, description: request.description.trim(), amountCents: request.amountCents, dueAt: new Date(request.dueAt), notes: request.notes?.trim() || null });
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.entry_updated', entity: 'financial_entry', entityId: entry.id, metadata: { previousAmountCents: existing.amountCents, amountCents: entry.amountCents } });
    return { entry: this.entryResponse(entry, category.name) };
  }

  async deleteEntry(user: AuthenticatedUser, id: string, reason?: string): Promise<{ success: true }> {
    const existing = await this.repository.entryById(id);
    if (!existing) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Lançamento financeiro não encontrado.', HttpStatus.NOT_FOUND);
    if (existing.paidCents > 0) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Este lançamento possui baixas. Estorne as baixas antes de excluí-lo.', HttpStatus.CONFLICT);
    if (existing.status === 'PAID' && !reason?.trim()) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe o motivo do estorno.', HttpStatus.BAD_REQUEST);
    await this.repository.deleteEntry(id);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: existing.status === 'PAID' ? 'financial.entry_reversed' : 'financial.entry_deleted', entity: 'financial_entry', entityId: id, metadata: { reason: reason?.trim(), amountCents: existing.amountCents } });
    return { success: true };
  }

  async cashFlow(request: ListFinancialEntriesRequest): Promise<CashFlowSummaryResponse> {
    const startAt = new Date(request.startAt);
    const endAt = new Date(request.endAt);
    if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt >= endAt) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Informe um período financeiro válido.', HttpStatus.BAD_REQUEST);
    if (request.dateField === 'PAID' && request.status === 'PENDING') throw new AppException(AppErrorCode.VALIDATION_ERROR, 'A consulta por realização inclui apenas pagamentos e recebimentos realizados.', HttpStatus.BAD_REQUEST);
    const [categories, manualEntries, receipts, installments, baseline, payments] = await Promise.all([
      this.repository.categories(),
      this.repository.entries(startAt, endAt, { type: request.type, status: request.status, categoryId: request.categoryId }, request.dateField ?? 'DUE'),
      request.type === 'EXPENSE' || request.status === 'PENDING' || request.categoryId ? [] : this.repository.receipts(startAt, endAt),
      request.type === 'EXPENSE' || request.status === 'PAID' || request.dateField === 'PAID' || request.categoryId ? [] : this.repository.pendingInstallments(startAt, endAt),
      this.repository.cashBaseline(),
      request.status === 'PENDING' || request.categoryId ? [] : this.repository.payments(startAt, endAt),
    ]);
    const paymentEntries = payments.length ? await this.repository.entriesByIds([...new Set(payments.map(payment => payment.entryId))]) : [];
    const allManualEntries = [...manualEntries, ...paymentEntries];
    const suppliers = await this.repository.suppliersByIds([...new Set(allManualEntries.map((entry) => entry.supplierId).filter((id): id is string => Boolean(id)))]);
    const orderIds = [...new Set([...receipts, ...installments].map(item => item.serviceOrderId))];
    const orders = orderIds.length ? await this.repository.ordersByIds(orderIds) : [];
    const [customers, vehicles] = await Promise.all([
      this.repository.customersByIds([...new Set([...allManualEntries.map(entry => entry.customerId), ...orders.map(order => order.customerId)].filter((id): id is string => Boolean(id)))]),
      orders.length ? this.repository.vehiclesByIds([...new Set(orders.map(order => order.vehicleId))]) : [],
    ]);
    const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
    const customerMap = new Map(customers.map((customer) => [customer.id, customer.name]));
    const categoryMap = new Map(categories.map((item) => [item.id, item.name]));
    const vehicleMap = new Map(vehicles.map(vehicle => [vehicle.id, vehicle.plate]));
    const paymentEntryMap = new Map(paymentEntries.map(entry => [entry.id, entry]));
    const orderMap = new Map(orders.map(order => [order.id, { serviceOrderNumber: order.orderNumber, customerId: order.customerId, customerName: customerMap.get(order.customerId), vehiclePlate: vehicleMap.get(order.vehicleId) }]));
    const entries: FinancialEntryResponse[] = [
      ...manualEntries.filter(entry => !(entry.status === 'PAID' && entry.paymentManaged)).map((entry) => this.entryResponse(entry, categoryMap.get(entry.categoryId) ?? 'Categoria removida', entry.supplierId ? supplierMap.get(entry.supplierId) : undefined, entry.customerId ? customerMap.get(entry.customerId) : undefined)),
      ...payments.flatMap(payment => { const parent = paymentEntryMap.get(payment.entryId); if (!parent || request.type && parent.type !== request.type) return []; return [{ ...this.entryResponse(parent, categoryMap.get(parent.categoryId) ?? 'Categoria removida', parent.supplierId ? supplierMap.get(parent.supplierId) : undefined, parent.customerId ? customerMap.get(parent.customerId) : undefined), id: payment.id, parentEntryId: parent.id, amountCents: payment.amountCents, dueAt: payment.paidAt.toISOString(), paidAt: payment.paidAt.toISOString(), status: 'PAID' as const, source: 'PAYMENT' as const, description: `Pagamento: ${parent.description}`, paymentMethod: payment.method ?? undefined }]; }),
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
    const reconciliations = entries.length ? await this.repository.reconciliations(entries.filter(entry => entry.status === 'PAID').map(entry => entry.id)) : [];
    const reconciliationMap = new Map(reconciliations.map(item => [`${item.source}:${item.sourceId}`, item]));
    entries.forEach(entry => { const match = reconciliationMap.get(`${entry.source}:${entry.id}`); if (match) { entry.reconciledAt = match.reconciledAt.toISOString(); entry.bankReference = match.bankReference; } });
    const sum = (type: 'INCOME' | 'EXPENSE', status: 'PAID' | 'PENDING') => entries.filter((item) => item.type === type && item.status === status).reduce((total, item) => total + item.amountCents, 0);
    const realizedIncomeCents = sum('INCOME', 'PAID');
    const realizedExpenseCents = sum('EXPENSE', 'PAID');
    const projectedIncomeCents = sum('INCOME', 'PENDING');
    const projectedExpenseCents = sum('EXPENSE', 'PENDING');
    let openingBalanceCents: number | undefined;
    if (baseline && baseline.asOf <= startAt) {
      const [earlierEntries, earlierReceipts] = await Promise.all([
        this.repository.entries(baseline.asOf, startAt, { status: 'PAID' }, 'PAID'),
        this.repository.receipts(baseline.asOf, startAt),
      ]);
      const earlierPayments = await this.repository.payments(baseline.asOf, startAt);
      const paymentParents = await this.repository.entriesByIds([...new Set(earlierPayments.map(payment => payment.entryId))]);
      const paymentTypes = new Map(paymentParents.map(parent => [parent.id, parent.type]));
      openingBalanceCents = baseline.amountCents + earlierEntries.filter(item => !item.paymentManaged).reduce((value, item) => value + (item.type === 'INCOME' ? item.amountCents : -item.amountCents), 0) + earlierPayments.reduce((value, item) => value + (paymentTypes.get(item.entryId) === 'INCOME' ? item.amountCents : -item.amountCents), 0) + earlierReceipts.reduce((value, item) => value + item.amountCents, 0);
    }
    return {
      openingBalanceCents,
      realizedIncomeCents, realizedExpenseCents, projectedIncomeCents, projectedExpenseCents,
      realizedBalanceCents: realizedIncomeCents - realizedExpenseCents,
      projectedBalanceCents: realizedIncomeCents + projectedIncomeCents - realizedExpenseCents - projectedExpenseCents,
      entries,
      categories: categories.map((item) => this.categoryResponse(item)),
    };
  }

  async saveCashBaseline(user: AuthenticatedUser, request: SaveFinancialCashBaselineRequest) {
    const asOf = new Date(request.asOf);
    if (!Number.isFinite(asOf.getTime())) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Data do saldo inicial inválida.', HttpStatus.BAD_REQUEST);
    const baseline = await this.repository.saveCashBaseline(user.tenantId, request.amountCents, asOf);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.cash_baseline_updated', entity: 'financial_cash_baseline', entityId: user.tenantId, metadata: { amountCents: baseline.amountCents, asOf: baseline.asOf.toISOString() } });
    return { amountCents: baseline.amountCents, asOf: baseline.asOf.toISOString() };
  }
  async reconcileMovement(user: AuthenticatedUser, request: ReconcileFinancialMovementRequest) {
    if (!(await this.repository.movementExists(request.source, request.sourceId))) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Movimento realizado não encontrado.', HttpStatus.NOT_FOUND);
    const reconciliation = await this.repository.reconcile(user.tenantId, user.userId, request.source, request.sourceId, request.bankReference.trim());
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.movement_reconciled', entity: 'financial_reconciliation', entityId: reconciliation.id, metadata: { source: request.source, sourceId: request.sourceId, bankReference: request.bankReference.trim() } });
    return { reconciledAt: reconciliation.reconciledAt.toISOString() };
  }
  async uploadAttachment(user: AuthenticatedUser, request: UploadFinancialAttachmentRequest) {
    if (!(await this.repository.entryById(request.entryId))) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Lançamento não encontrado.', HttpStatus.NOT_FOUND);
    const content = Buffer.from(request.dataBase64, 'base64');
    const pdf = request.mimeType === 'application/pdf' && content.subarray(0, 5).toString() === '%PDF-';
    const png = request.mimeType === 'image/png' && content.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const jpeg = request.mimeType === 'image/jpeg' && content[0] === 255 && content[1] === 216 && content[2] === 255;
    if (!content.length || content.length > 2_000_000 || ![pdf, png, jpeg].some(Boolean)) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Use PDF, PNG ou JPEG de até 2 MB.', HttpStatus.BAD_REQUEST);
    const attachment = await this.repository.createAttachment(user.tenantId, user.userId, request.entryId, request.name.trim().slice(0, 160), request.mimeType, content);
    await this.audit.record({ tenantId: user.tenantId, userId: user.userId, action: 'financial.attachment_added', entity: 'financial_entry_attachment', entityId: attachment.id, metadata: { entryId: request.entryId, name: attachment.name } });
    return { id: attachment.id, name: attachment.name };
  }
  async listAttachments(entryId: string) { return { attachments: await this.repository.attachments(entryId) }; }
  async downloadAttachment(entryId: string, attachmentId: string) {
    const attachment = await this.repository.attachment(entryId, attachmentId);
    if (!attachment) throw new AppException(AppErrorCode.VALIDATION_ERROR, 'Comprovante não encontrado.', HttpStatus.NOT_FOUND);
    return { name: attachment.name, mimeType: attachment.mimeType, dataBase64: Buffer.from(attachment.content).toString('base64') };
  }

  private categoryResponse(category: { id: string; name: string; type: string; group: string; color: string | null; isSystem: boolean }): FinancialCategoryResponse {
    return { id: category.id, name: category.name, type: category.type as FinancialCategoryResponse['type'], group: category.group, color: category.color ?? undefined, isSystem: category.isSystem };
  }
  private entryResponse(entry: { id: string; categoryId: string; supplierId?: string | null; customerId?: string | null; type: string; description: string; amountCents: number; paidCents?: number; dueAt: Date; status: string; paidAt: Date | null; notes: string | null }, categoryName: string, supplierName?: string, customerName?: string): FinancialEntryResponse {
    return { id: entry.id, categoryId: entry.categoryId, categoryName, supplierId: entry.supplierId ?? undefined, supplierName, customerId: entry.customerId ?? undefined, customerName, type: entry.type as FinancialEntryResponse['type'], description: entry.description, amountCents: entry.status === 'PENDING' ? entry.amountCents - (entry.paidCents ?? 0) : entry.amountCents, originalAmountCents: entry.amountCents, paidTotalCents: entry.paidCents ?? 0, dueAt: entry.dueAt.toISOString(), status: entry.status as FinancialEntryResponse['status'], paidAt: entry.paidAt?.toISOString(), notes: entry.notes ?? undefined, source: 'MANUAL' };
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
