import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { FISCAL_CANCEL_REASON_MAX, FISCAL_CANCEL_REASON_MIN, FISCAL_DOCUMENT_KINDS, FISCAL_ENVIRONMENTS, FISCAL_TAX_REGIMES } from '@oficina/contracts';
import type { CancelFiscalDocumentRequest, FiscalDocumentIdRequest, FiscalPreviewRequest, IssueFiscalDocumentRequest, ListFiscalDocumentsRequest, RegisterFiscalDocumentRequest, UpdateFiscalSettingsRequest, UploadFiscalCertificateRequest } from '@oficina/contracts';

export class UpdateFiscalSettingsDto implements UpdateFiscalSettingsRequest {
  @IsIn(FISCAL_ENVIRONMENTS) environment!: UpdateFiscalSettingsRequest['environment'];
  @IsIn(FISCAL_TAX_REGIMES) taxRegime!: UpdateFiscalSettingsRequest['taxRegime'];
  @IsOptional() @IsString() @MaxLength(30) municipalRegistration?: string | null;
  @IsOptional() @Matches(/^\d{7}$/, { message: 'city_ibge_code must have 7 digits' }) cityIbgeCode?: string | null;
  @IsOptional() @Matches(/^[\d./-]{0,10}$/, { message: 'cnae is invalid' }) cnae?: string | null;
  @IsBoolean() nfseEnabled!: boolean;
  @IsBoolean() nfeEnabled!: boolean;
  @IsBoolean() nfceEnabled!: boolean;
  @IsString() @Matches(/^[\d.]{2,10}$/, { message: 'service_list_item is invalid' }) serviceListItem!: string;
  @IsOptional() @IsString() @MaxLength(30) municipalTaxCode?: string | null;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(10) issRatePercent?: number | null;
  @IsBoolean() issWithheld!: boolean;
  @Matches(/^\d{8}$/, { message: 'default_ncm must have 8 digits' }) defaultNcm!: string;
  @Matches(/^[5-7]\d{3}$/, { message: 'default_cfop must be an output CFOP' }) defaultCfop!: string;
  @Matches(/^\d{3}$/, { message: 'csosn must have 3 digits' }) csosn!: string;
  @Matches(/^\d{2}$/, { message: 'pis_cofins_cst must have 2 digits' }) pisCofinsCst!: string;
  @IsOptional() @IsString() @MaxLength(10) nfceCscId?: string | null;
  @IsOptional() @IsString() @MaxLength(60) nfceCsc?: string;
}

export class UploadFiscalCertificateDto implements UploadFiscalCertificateRequest {
  @IsString() @IsNotEmpty() @MaxLength(160) fileName!: string;
  @IsString() @IsNotEmpty() @MaxLength(100_000) dataBase64!: string;
  @IsString() @IsNotEmpty() @MaxLength(200) password!: string;
}

export class ListFiscalDocumentsDto implements ListFiscalDocumentsRequest { @IsUUID() serviceOrderId!: string; }
export class FiscalDocumentIdDto implements FiscalDocumentIdRequest { @IsUUID() id!: string; }

export class FiscalPreviewDto implements FiscalPreviewRequest {
  @IsUUID() serviceOrderId!: string;
  @IsIn(FISCAL_DOCUMENT_KINDS) kind!: FiscalPreviewRequest['kind'];
}

export class IssueFiscalDocumentDto implements IssueFiscalDocumentRequest {
  @IsUUID() serviceOrderId!: string;
  @IsIn(FISCAL_DOCUMENT_KINDS) kind!: IssueFiscalDocumentRequest['kind'];
}

export class CancelFiscalDocumentDto implements CancelFiscalDocumentRequest {
  @IsUUID() id!: string;
  @IsString() @MinLength(FISCAL_CANCEL_REASON_MIN, { message: `reason must have at least ${FISCAL_CANCEL_REASON_MIN} characters` }) @MaxLength(FISCAL_CANCEL_REASON_MAX) reason!: string;
}

export class FiscalAttachmentDto {
  @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @IsIn(['application/pdf', 'application/xml', 'text/xml', 'image/png', 'image/jpeg']) mimeType!: string;
  @IsString() @IsNotEmpty() @MaxLength(3_000_000) dataBase64!: string;
}

export class RegisterFiscalDocumentDto implements RegisterFiscalDocumentRequest {
  @IsUUID() serviceOrderId!: string;
  @IsIn(FISCAL_DOCUMENT_KINDS) kind!: RegisterFiscalDocumentRequest['kind'];
  @IsString() @IsNotEmpty() @MaxLength(20) number!: string;
  @IsOptional() @IsString() @MaxLength(10) series?: string;
  @IsISO8601() issuedAt!: string;
  @IsInt() @Min(0) @Max(2_147_483_647) amountCents!: number;
  @IsOptional() @IsString() @MaxLength(60) verificationCode?: string;
  @IsOptional() @IsString() @MaxLength(60) accessKey?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @ValidateNested() @Type(() => FiscalAttachmentDto) attachment?: FiscalAttachmentDto;
}
