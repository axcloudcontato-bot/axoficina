import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

// `@IsOptional()` só pula a validação quando o valor é null/undefined — uma
// string vazia (o que o frontend sempre manda pra um campo de e-mail opcional
// deixado em branco, ex: EmailSettingsForm's `replyTo: ''`) continua caindo
// no `@IsEmail()` e falhando, derrubando o salvamento inteiro com "Dados
// inválidos" sem indicar o campo. `@ValidateIf` evita isso tratando string
// vazia como "não informado", igual null/undefined.
export class UpdateCompanySettingsDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(200) legalName?: string;
  @IsString() @MaxLength(30) document!: string;
  @IsOptional() @IsString() @MaxLength(30) stateRegistration?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(30) whatsapp?: string;
  @ValidateIf((object: UpdateCompanySettingsDto) => Boolean(object.email)) @IsEmail() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(250) website?: string;
  @IsOptional() @IsString() @MaxLength(200) addressStreet?: string;
  @IsOptional() @IsString() @MaxLength(30) addressNumber?: string;
  @IsOptional() @IsString() @MaxLength(100) addressComplement?: string;
  @IsOptional() @IsString() @MaxLength(100) addressDistrict?: string;
  @IsOptional() @IsString() @MaxLength(100) addressCity?: string;
  @IsOptional() @IsString() @MaxLength(2) addressState?: string;
  @IsOptional() @IsString() @MaxLength(12) addressPostalCode?: string;
  @IsOptional() @IsString() @MaxLength(700000) logoDataUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) documentFooter?: string;
}

export class UpdateEmailSettingsDto {
  @IsOptional() @IsString() @MaxLength(250) host?: string;
  @IsInt() @Min(1) @Max(65535) port!: number;
  @IsBoolean() secure!: boolean;
  @IsOptional() @IsString() @MaxLength(250) username?: string;
  @IsOptional() @IsString() @MaxLength(500) password?: string;
  @IsOptional() @IsString() @MaxLength(160) fromName?: string;
  @ValidateIf((object: UpdateEmailSettingsDto) => Boolean(object.fromEmail)) @IsEmail() @MaxLength(250) fromEmail?: string;
  @ValidateIf((object: UpdateEmailSettingsDto) => Boolean(object.replyTo)) @IsEmail() @MaxLength(250) replyTo?: string;
  @IsBoolean() enabled!: boolean;
}

export class TestEmailSettingsDto {
  @IsEmail() recipient!: string;
}

export class SendEmailDto {
  @IsEmail() recipient!: string;
  @IsString() @MaxLength(200) subject!: string;
  @IsString() @MaxLength(20000) text!: string;
}
