import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CARE_SERVICE_KEYS, CATALOG_ITEM_TYPES, CATALOG_REPORT_DAYS, CATALOG_UNITS } from '@oficina/contracts';
import type { AdjustStockRequest, CreateCatalogItemRequest, DeleteCatalogItemRequest, DeleteCatalogPackageRequest, ImportCatalogRequest, ImportCatalogRow, SaveCatalogPackageRequest, UpdateCatalogItemRequest } from '@oficina/contracts';

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
  @IsOptional() @IsBoolean() trackStock?: boolean;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99_999_999) minStock?: number | null;
}
export class UpdateCatalogItemDto extends CreateCatalogItemDto implements UpdateCatalogItemRequest { @IsUUID() id!: string; }
export class DeleteCatalogItemDto implements DeleteCatalogItemRequest { @IsUUID() id!: string; }

export class AdjustStockDto implements AdjustStockRequest {
  @IsUUID() id!: string;
  @IsIn(['PURCHASE', 'ADJUSTMENT']) kind!: AdjustStockRequest['kind'];
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99_999_999) quantity!: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class ImportCatalogRowDto implements ImportCatalogRow {
  @IsIn(CATALOG_ITEM_TYPES) type!: ImportCatalogRow['type'];
  @IsString() @IsNotEmpty() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsInt() @Min(0) @Max(2_147_483_647) unitPriceCents!: number;
  @IsOptional() @IsInt() @Min(0) @Max(2_147_483_647) costCents?: number | null;
  @IsOptional() @IsString() @MaxLength(40) code?: string;
  @IsOptional() @IsString() @MaxLength(60) brand?: string;
  @IsOptional() @IsIn(CATALOG_UNITS) unit?: ImportCatalogRow['unit'];
}
export class ImportCatalogDto implements ImportCatalogRequest {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => ImportCatalogRowDto) rows!: ImportCatalogRowDto[];
}

export class PackageLineDto {
  @IsUUID() catalogItemId!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(9999) quantity!: number;
}
export class SaveCatalogPackageDto implements SaveCatalogPackageRequest {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @IsNotEmpty() @MaxLength(80) name!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => PackageLineDto) items!: PackageLineDto[];
}
export class DeleteCatalogPackageDto implements DeleteCatalogPackageRequest { @IsUUID() id!: string; }

export class CatalogReportQueryDto {
  @IsOptional() @Type(() => Number) @IsIn(CATALOG_REPORT_DAYS) days?: number;
}
