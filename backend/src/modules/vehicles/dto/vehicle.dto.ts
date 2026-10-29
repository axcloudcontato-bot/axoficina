import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import type {
  CreateVehicleRequest,
  DeleteVehicleRequest,
  ImportVehicleRow,
  ImportVehiclesRequest,
  RestoreVehicleRequest,
  TransferVehicleRequest,
  VehicleOverviewRequest,
  VehicleArchiveImpactRequest,
  UpdateVehicleRequest,
  VehicleListRequest,
} from '@oficina/contracts';

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 100;
const MAX_PHOTOS = 20;
const MAX_MILEAGE = 2_000_000;

export class CreateVehicleDto implements CreateVehicleRequest {
  @IsUUID('4', { message: 'customer_id must be a valid id' })
  customerId!: string;

  @IsNotEmpty({ message: 'brand is required' })
  @MaxLength(60)
  brand!: string;

  @IsNotEmpty({ message: 'model is required' })
  @MaxLength(80)
  model!: string;

  @IsNotEmpty({ message: 'plate is required' })
  @MaxLength(12)
  plate!: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  engine?: string;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @IsString()
  chassis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MILEAGE)
  mileage?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS)
  @IsString({ each: true })
  photos?: string[];
}

export class UpdateVehicleDto implements UpdateVehicleRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;

  @IsOptional()
  @IsNotEmpty({ message: 'brand cannot be empty' })
  brand?: string;

  @IsOptional()
  @IsNotEmpty({ message: 'model cannot be empty' })
  model?: string;

  @IsOptional()
  @IsNotEmpty({ message: 'plate cannot be empty' })
  plate?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  engine?: string;

  @IsOptional()
  @IsString()
  fuelType?: string;

  @IsOptional()
  @IsString()
  chassis?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(MAX_MILEAGE)
  mileage?: number;

  @IsOptional()
  @IsBoolean()
  confirmMileageDecrease?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS)
  @IsString({ each: true })
  photos?: string[];
}

export class DeleteVehicleDto implements DeleteVehicleRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class RestoreVehicleDto implements RestoreVehicleRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class VehicleArchiveImpactDto implements VehicleArchiveImpactRequest {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class TransferVehicleDto implements TransferVehicleRequest {
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;

  @IsUUID('4', { message: 'customer_id must be a valid id' })
  customerId!: string;
}

export class VehicleOverviewDto implements VehicleOverviewRequest {
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class GetVehicleDto {
  @IsNotEmpty({ message: 'id is required' })
  @IsUUID('4', { message: 'id must be a valid id' })
  id!: string;
}

export class VehicleListDto implements VehicleListRequest {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID('4', { message: 'customer_id must be a valid id' })
  customerId?: string;

  @IsOptional()
  @IsBoolean()
  matchOwner?: boolean;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsBoolean()
  withStats?: boolean;

  @IsOptional()
  @IsIn(['INACTIVE', 'IN_SERVICE'])
  filter?: VehicleListRequest['filter'];

  @IsOptional()
  @IsIn(['recent', 'plate', 'year', 'mileage'])
  sort?: VehicleListRequest['sort'];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  direction?: VehicleListRequest['direction'];

  @IsInt()
  @Min(0)
  offset: number = 0;

  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT;
}

export class ImportVehicleRowDto implements ImportVehicleRow {
  @IsInt() @Min(1) line!: number;
  @IsString() @MaxLength(20) plate!: string;
  @IsString() @MaxLength(60) brand!: string;
  @IsString() @MaxLength(80) model!: string;
  @IsOptional() @IsInt() year?: number;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
  @IsOptional() @IsString() @MaxLength(30) fuelType?: string;
  @IsOptional() @IsString() @MaxLength(30) chassis?: string;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_MILEAGE) mileage?: number;
  @IsOptional() @IsString() @MaxLength(24) ownerDocument?: string;
  @IsOptional() @IsString() @MaxLength(30) ownerPhone?: string;
  @IsOptional() @IsString() @MaxLength(200) ownerName?: string;
}
export class ImportVehiclesDto implements ImportVehiclesRequest {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(300) @ValidateNested({ each: true }) @Type(() => ImportVehicleRowDto) rows!: ImportVehicleRowDto[];
}
