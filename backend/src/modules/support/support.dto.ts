import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const trimmed = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateSupportTicketDto {
  @Transform(trimmed) @IsString() @MinLength(5) @MaxLength(120)
  subject!: string;

  @Transform(trimmed) @IsString() @MinLength(20) @MaxLength(4000)
  description!: string;

  @IsIn(['LOW', 'NORMAL', 'HIGH'])
  priority!: 'LOW' | 'NORMAL' | 'HIGH';
}

export class SupportTicketListDto {
  @IsOptional() @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
  offset = 0;
}

export class UpdateSupportTicketDto {
  @IsOptional() @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

  @IsOptional() @Transform(trimmed) @IsString() @MinLength(10) @MaxLength(4000)
  response?: string;
}
