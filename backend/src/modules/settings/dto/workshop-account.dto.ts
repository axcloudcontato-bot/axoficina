import { Type } from 'class-transformer';
import { IsISO8601, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import type { AuditLogRequest } from '@oficina/contracts';

export class AuditLogDto implements AuditLogRequest {
  @Type(() => Number) @IsInt() @Min(0) offset: number = 0;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit: number = 30;
  @IsOptional() @Matches(/^[a-z_]{2,30}\.$/) actionPrefix?: string;
  @IsOptional() @IsUUID('4') userId?: string;
  @IsOptional() @IsISO8601() from?: string;
  @IsOptional() @IsISO8601() to?: string;
}
