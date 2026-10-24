import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { UpdateWhatsAppSettingsRequest } from '@oficina/contracts';

export class UpdateWhatsAppSettingsDto implements UpdateWhatsAppSettingsRequest {
  @IsOptional() @IsString() @MaxLength(500) baseUrl?: string;
  @IsOptional() @IsString() @MaxLength(160) sessionId?: string;
  @IsOptional() @IsString() @MaxLength(1000) apiKey?: string;
  @IsOptional() @IsString() @MaxLength(500) webhookSecret?: string;
  @IsBoolean() enabled!: boolean;
}
