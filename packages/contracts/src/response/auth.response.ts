import type { UserResponse } from './user.response';

export interface TenantResponse {
  id: string;
  name: string;
  document: string;
  plan: string;
  status: string;
  createdAt: string;
}

export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends TokenPairResponse {
  user: UserResponse;
}

export interface SignupResponse extends AuthResponse {
  tenant: TenantResponse;
}

export type RefreshResponse = TokenPairResponse;

// A device signed in to the account. The refresh token rotates on each renewal, so lastActiveAt is the last renewal.
export interface SessionResponse {
  id: string;
  device: string | null;
  lastActiveAt: string;
  expiresAt: string;
  current: boolean;
}
