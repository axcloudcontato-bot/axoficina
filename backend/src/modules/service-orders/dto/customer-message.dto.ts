import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsString, IsUUID, Length, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import type { CreateCustomerMessageRequest } from '@oficina/contracts';

export class CreateCustomerMessageDto implements CreateCustomerMessageRequest {
  @IsUUID() serviceOrderId!: string;
  @IsIn(['EMAIL', 'WHATSAPP']) channel!: 'EMAIL' | 'WHATSAPP';
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 300) question!: string;
  @Transform(({ value }: { value: unknown }) => Array.isArray(value) ? value.map((item: unknown) => typeof item === 'string' ? item.trim() : item) : value)
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(3) @ArrayUnique((value: unknown) => typeof value === 'string' ? value.toLocaleLowerCase('pt-BR') : value)
  @IsString({ each: true }) @Length(1, 60, { each: true }) options!: string[];
  @IsBoolean() includeQuote!: boolean;
}

export class CustomerMessageTokenDto {
  @IsString() @Length(64, 64) @MaxLength(64) token!: string;
}

export class AnswerCustomerMessageDto extends CustomerMessageTokenDto {
  @IsInt() @Min(0) @Max(2) selectedOption!: number;
}

export class ListCustomerMessagesDto {
  @IsUUID() serviceOrderId!: string;
}
