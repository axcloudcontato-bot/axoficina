import { Equals, IsEmail, IsNotEmpty, MinLength } from 'class-validator';
import { LEGAL_VERSION, MIN_PASSWORD_LENGTH } from '@oficina/contracts';
import type { LoginRequest, LogoutRequest, RefreshRequest, SignupRequest } from '@oficina/contracts';

export class SignupDto implements SignupRequest {
  @Equals(true, { message: 'Aceite os Termos de uso para continuar.' })
  acceptedTerms!: boolean;

  @Equals(LEGAL_VERSION, { message: 'Leia e aceite a versão atual dos documentos.' })
  legalVersion!: string;

  @IsNotEmpty({ message: 'tenant_name is required' })
  tenantName!: string;

  @IsNotEmpty({ message: 'tenant_document is required' })
  tenantDocument!: string;

  @IsNotEmpty({ message: 'admin_name is required' })
  adminName!: string;

  @IsEmail({}, { message: 'admin_email must be a valid email' })
  adminEmail!: string;

  @MinLength(MIN_PASSWORD_LENGTH, { message: `password must be at least ${MIN_PASSWORD_LENGTH} characters` })
  password!: string;
}

export class LoginDto implements LoginRequest {
  @IsEmail({}, { message: 'email must be a valid email' })
  email!: string;

  @IsNotEmpty({ message: 'password is required' })
  password!: string;
}

export class RefreshDto implements RefreshRequest {
  @IsNotEmpty({ message: 'refresh_token is required' })
  refreshToken!: string;
}

export class LogoutDto implements LogoutRequest {
  @IsNotEmpty({ message: 'refresh_token is required' })
  refreshToken!: string;
}
