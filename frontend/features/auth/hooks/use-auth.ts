'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, SignupRequest } from '@oficina/contracts';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '../api/auth-api';

export function useSignup() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (request: SignupRequest) => authApi.signup(request),
    onSuccess: (data) => {
      queryClient.clear();
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: (request: LoginRequest) => authApi.login(request),
    onSuccess: (data) => {
      queryClient.clear();
      setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const logout = useAuthStore((state) => state.logout);

  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        await authApi.logout({ refreshToken });
      }
    },
    onSettled: () => {
      queryClient.clear();
      logout();
    },
  });
}
