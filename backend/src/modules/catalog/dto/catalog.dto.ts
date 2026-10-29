import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { CATALOG_ITEM_TYPES } from '@oficina/contracts';
import type { CreateCatalogItemRequest, DeleteCatalogItemRequest, UpdateCatalogItemRequest } from '@oficina/contracts';

export class CreateCatalogItemDto implements CreateCatalogItemRequest {
  @IsIn(CATALOG_ITEM_TYPES, { message: 'type must be PART, PRODUCT or LABOR' }) type!: CreateCatalogItemRequest['type'];
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsInt({ message: 'unit_price_cents must be an integer' }) @Min(0) unitPriceCents!: number;
}
export class UpdateCatalogItemDto extends CreateCatalogItemDto implements UpdateCatalogItemRequest { @IsUUID() id!: string; }
export class DeleteCatalogItemDto implements DeleteCatalogItemRequest { @IsUUID() id!: string; }
