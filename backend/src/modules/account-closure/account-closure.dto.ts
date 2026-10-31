import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { AdminCloseRequest, AdminPurgeRequest, CloseAccountRequest } from '@oficina/contracts';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CloseAccountDto implements CloseAccountRequest {
  @IsString() @MinLength(1) @MaxLength(200)
  password!: string;

  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200)
  confirmName!: string;
}

export class AdminCloseDto implements AdminCloseRequest {
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500)
  reason?: string | null;
}

export class AdminPurgeDto implements AdminPurgeRequest {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200)
  confirmName!: string;
}
