import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserResponse } from '@oficina/contracts';

interface Session {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserResponse | null;
  setSession: (session: Session) => void;
  updateTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  logout: () => void;
}

// Tokens ficam em localStorage (via persist) — consistente com o contrato
// da API (tokens voltam no corpo JSON, não como cookie httpOnly). O header
// Authorization é lido direto deste store pelo interceptor de request do
// apiClient (ver lib/api/client.ts) — este arquivo não importa de lá para
// não criar um ciclo de import com ele.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) => set({ accessToken, refreshToken, user }),
      updateTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'oficina-auth',
    },
  ),
);
