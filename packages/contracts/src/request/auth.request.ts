import type { LegalAcknowledgement } from '../legal';

export interface SignupRequest extends LegalAcknowledgement {
  tenantName: string;
  tenantDocument: string;
  adminName: string;
  adminEmail: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface LogoutRequest {
  refreshToken: string;
}
