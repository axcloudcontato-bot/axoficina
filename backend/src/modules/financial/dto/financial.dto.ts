import { IsHexColor, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import type { CreateFinancialCategoryRequest, CreateFinancialEntryRequest, CreateSupplierRequest, DeleteFinancialCategoryRequest, DeleteFinancialEntryRequest, DeleteSupplierRequest, ListFinancialEntriesRequest, SettleFinancialEntryRequest, UpdateSupplierRequest } from '@oficina/contracts';

const TYPES = ['INCOME', 'EXPENSE'] as const;
const STATUSES = ['PENDING', 'PAID'] as const;

export class CreateFinancialCategoryDto implements CreateFinancialCategoryRequest {
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsIn(TYPES) type!: CreateFinancialCategoryRequest['type'];
  @IsOptional() @IsHexColor() color?: string;
}
export class DeleteFinancialCategoryDto implements DeleteFinancialCategoryRequest { @IsUUID() id!: string; }
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
export class DeleteFinancialEntryDto implements DeleteFinancialEntryRequest { @IsUUID() id!: string; }
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
