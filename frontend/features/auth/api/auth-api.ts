import { apiClient } from '@/lib/api/client';
import type {
  AuthResponse,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  LoginRequest,
  LogoutRequest,
  RefreshRequest,
  RefreshResponse,
  SignupRequest,
  SignupResponse,
} from '@oficina/contracts';

export const authApi = {
  async forgotPassword(request: ForgotPasswordRequest): Promise<{ success: true }> {
    return (await apiClient.post('/api/v1/auth/forgot-password', request)).data;
  },
  async resetPassword(request: ResetPasswordRequest): Promise<{ success: true }> {
    return (await apiClient.post('/api/v1/auth/reset-password', request)).data;
  },
  async changePassword(request: ChangePasswordRequest): Promise<RefreshResponse> {
    return (await apiClient.post('/api/v1/auth/change-password', request)).data;
  },
  async signup(request: SignupRequest): Promise<SignupResponse> {
    const response = await apiClient.post<SignupResponse>('/api/v1/auth/signup', request);
    return response.data;
  },

  async login(request: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', request);
    return response.data;
  },

  async refresh(request: RefreshRequest): Promise<RefreshResponse> {
    const response = await apiClient.post<RefreshResponse>('/api/v1/auth/refresh', request);
    return response.data;
  },

  async logout(request: LogoutRequest): Promise<void> {
    await apiClient.post('/api/v1/auth/logout', request);
  },
};
