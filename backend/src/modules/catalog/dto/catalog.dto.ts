import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { CARE_SERVICE_KEYS, CATALOG_ITEM_TYPES, CATALOG_UNITS } from '@oficina/contracts';
import type { CreateCatalogItemRequest, DeleteCatalogItemRequest, UpdateCatalogItemRequest } from '@oficina/contracts';

export class CreateCatalogItemDto implements CreateCatalogItemRequest {
  @IsIn(CATALOG_ITEM_TYPES, { message: 'type must be PART, PRODUCT or LABOR' }) type!: CreateCatalogItemRequest['type'];
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsInt({ message: 'unit_price_cents must be an integer' }) @Min(0) unitPriceCents!: number;
  @IsOptional() @IsInt() @Min(0) @Max(2_147_483_647) costCents?: number | null;
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsOptional() @IsString() @MaxLength(60) brand?: string;
  @IsOptional() @IsIn(CATALOG_UNITS) unit?: CreateCatalogItemRequest['unit'];
  @IsOptional() @IsUUID() supplierId?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(1440) standardMinutes?: number | null;
  @IsOptional() @IsIn(CARE_SERVICE_KEYS) careServiceKey?: CreateCatalogItemRequest['careServiceKey'];
}
export class UpdateCatalogItemDto extends CreateCatalogItemDto implements UpdateCatalogItemRequest { @IsUUID() id!: string; }
export class DeleteCatalogItemDto implements DeleteCatalogItemRequest { @IsUUID() id!: string; }
