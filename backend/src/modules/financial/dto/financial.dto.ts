import { IsHexColor, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import type { AddFinancialPaymentRequest, CreateFinancialCategoryRequest, CreateFinancialEntryRequest, CreateSupplierRequest, DeleteFinancialCategoryRequest, DeleteFinancialEntryRequest, DeleteSupplierRequest, FinancialAttachmentRequest, ListFinancialEntriesRequest, ReconcileFinancialMovementRequest, ReverseFinancialPaymentRequest, SaveFinancialCashBaselineRequest, SettleFinancialEntryRequest, UpdateFinancialCategoryRequest, UpdateFinancialEntryRequest, UpdateSupplierRequest, UploadFinancialAttachmentRequest } from '@oficina/contracts';

const TYPES = ['INCOME', 'EXPENSE'] as const;
const STATUSES = ['PENDING', 'PAID'] as const;

export class CreateFinancialCategoryDto implements CreateFinancialCategoryRequest {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsIn(TYPES) type!: CreateFinancialCategoryRequest['type'];
  @IsOptional() @IsHexColor() color?: string;
}
export class DeleteFinancialCategoryDto implements DeleteFinancialCategoryRequest { @IsUUID() id!: string; }
export class SaveFinancialCashBaselineDto implements SaveFinancialCashBaselineRequest { @IsInt() amountCents!: number; @IsISO8601() asOf!: string; }
export class UpdateFinancialCategoryDto extends CreateFinancialCategoryDto implements UpdateFinancialCategoryRequest { @IsUUID() id!: string; }
export class CreateFinancialEntryDto implements CreateFinancialEntryRequest {
  @IsUUID() categoryId!: string;
  @IsOptional() @IsUUID() supplierId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsIn(TYPES) type!: CreateFinancialEntryRequest['type'];
  @IsString() @IsNotEmpty() @MaxLength(160) description!: string;
  @IsInt() @Min(1) amountCents!: number;
  @IsISO8601() dueAt!: string;
  @IsOptional() @IsIn(STATUSES) status?: CreateFinancialEntryRequest['status'];
  @IsOptional() @IsISO8601() paidAt?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsInt() @Min(1) @Max(24) recurrenceMonths?: number;
}
export class ListFinancialEntriesDto implements ListFinancialEntriesRequest {
  @IsISO8601() startAt!: string;
  @IsISO8601() endAt!: string;
  @IsOptional() @IsIn(['DUE', 'PAID']) dateField?: 'DUE' | 'PAID';
  @IsOptional() @IsIn(TYPES) type?: ListFinancialEntriesRequest['type'];
  @IsOptional() @IsIn(STATUSES) status?: ListFinancialEntriesRequest['status'];
  @IsOptional() @IsUUID() categoryId?: string;
}
export class SettleFinancialEntryDto implements SettleFinancialEntryRequest { @IsUUID() id!: string; @IsOptional() @IsISO8601() paidAt?: string; }
export class AddFinancialPaymentDto implements AddFinancialPaymentRequest { @IsUUID() id!: string; @IsInt() @Min(1) amountCents!: number; @IsISO8601() paidAt!: string; @IsOptional() @IsString() @MaxLength(40) method?: string; }
export class ReverseFinancialPaymentDto implements ReverseFinancialPaymentRequest { @IsUUID() id!: string; @IsString() @IsNotEmpty() @MaxLength(500) reason!: string; }
export class ReconcileFinancialMovementDto implements ReconcileFinancialMovementRequest { @IsIn(['MANUAL', 'PAYMENT', 'SERVICE_ORDER']) source!: ReconcileFinancialMovementRequest['source']; @IsUUID() sourceId!: string; @IsString() @IsNotEmpty() @MaxLength(120) bankReference!: string; }
export class UploadFinancialAttachmentDto implements UploadFinancialAttachmentRequest { @IsUUID() entryId!: string; @IsString() @IsNotEmpty() @MaxLength(160) name!: string; @IsIn(['application/pdf', 'image/png', 'image/jpeg']) mimeType!: string; @IsString() @IsNotEmpty() @MaxLength(3_000_000) dataBase64!: string; }
export class FinancialAttachmentDto implements FinancialAttachmentRequest { @IsUUID() entryId!: string; @IsUUID() attachmentId!: string; }
export class ListFinancialAttachmentsDto { @IsUUID() entryId!: string; }
export class UpdateFinancialEntryDto extends CreateFinancialEntryDto implements UpdateFinancialEntryRequest { @IsUUID() id!: string; }
export class DeleteFinancialEntryDto implements DeleteFinancialEntryRequest { @IsUUID() id!: string; @IsOptional() @IsString() @MaxLength(500) reason?: string; }
export class CreateSupplierDto implements CreateSupplierRequest {
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(20) document?: string;
  @IsOptional() @IsString() @MaxLength(100) contactName?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) email?: string;
  @IsOptional() @IsString() @MaxLength(120) paymentTerms?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
export class UpdateSupplierDto extends CreateSupplierDto implements UpdateSupplierRequest { @IsUUID() id!: string; }
export class DeleteSupplierDto implements DeleteSupplierRequest { @IsUUID() id!: string; }
