import { Equals, IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PRIVACY_REQUEST_TYPES } from '@oficina/contracts';
import type { CreatePrivacyRequest, PrivacyRequestType } from '@oficina/contracts';

export class CreatePrivacyRequestDto implements CreatePrivacyRequest {
  @IsIn(PRIVACY_REQUEST_TYPES)
  type!: PrivacyRequestType;

  @IsOptional() @IsUUID('4')
  customerId?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  details?: string;
}
export class ResolvePrivacyRequestDto {
  @IsUUID('4') id!: string;
  @IsIn(['IN_REVIEW', 'COMPLETED', 'RETAINED']) status!: 'IN_REVIEW' | 'COMPLETED' | 'RETAINED';
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(10) @MaxLength(2000) response!: string;
  @IsOptional() @IsISO8601() retentionUntil?: string;
}
export class EraseCustomerDto {
  @IsUUID('4') requestId!: string;
  @IsString() @MinLength(1) @MaxLength(200) password!: string;
  @Equals('EXCLUIR') confirmation!: string;
}
export class EraseAccountDto extends EraseCustomerDto {}
export class ExportCustomerDto {
  @IsUUID('4') id!: string;
}
