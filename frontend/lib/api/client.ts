import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { stringToCamelCase } from '@oficina/contracts';
import { keysToCamel, keysToSnake } from '../case-convert';
import { useAuthStore } from '@/stores/auth-store';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
});

apiClient.interceptors.request.use((config) => {
  // Lido do store a cada request (em vez de empurrado para
  // `apiClient.defaults.headers` via callback no auth-store) para não criar
  // import circular entre este arquivo e `stores/auth-store.ts` — ver
  // histórico: esse ciclo deixava `onRehydrateStorage` lançar
  // `ReferenceError: Cannot access 'apiClient' before initialization` no
  // primeiro load, o que travava a Promise interna do zustand/persist e
  // nunca marcava `hasHydrated`, prendendo o AuthGuard em "Carregando..."
  // para sempre.
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
    config.data = keysToSnake(config.data);
  }
  return config;
});

// Nunca deixa o refresh-and-retry abaixo tentar de novo em cima de
// login/signup/refresh — evita loop (refresh falhando chamaria a si mesmo)
// e evita renovar sessão no meio de um fluxo que ainda nem tem uma.
const AUTH_ENDPOINTS = ['/api/v1/auth/login', '/api/v1/auth/signup', '/api/v1/auth/refresh'];

function isAuthEndpoint(url?: string): boolean {
  return Boolean(url && AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint)));
}

// Refresh tokens são rotativos e de uso único no backend (AuthManager.refresh
// revoga o token antigo a cada uso; reusar um já revogado revoga a família
// inteira). Por isso 401s concorrentes (duas queries disparando ao mesmo
// tempo com o access token expirado) precisam compartilhar UMA única
// chamada de refresh — nunca uma por request — senão a segunda reusaria um
// refresh token que a primeira já invalidou e derrubaria a sessão inteira.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const { refreshToken, updateTokens, logout } = useAuthStore.getState();
  if (!refreshToken) {
    logout();
    throw new Error('No refresh token available');
  }
  try {
    const response = await apiClient.post<{ accessToken: string; refreshToken: string }>('/api/v1/auth/refresh', { refreshToken });
    updateTokens({ accessToken: response.data.accessToken, refreshToken: response.data.refreshToken });
    return response.data.accessToken;
  } catch (error) {
    logout();
    throw error;
  }
}

apiClient.interceptors.response.use(
  (response) => {
    // `responseType: 'blob'`/`'arraybuffer'` faz `response.data` ser um
    // Blob/ArrayBuffer, não um JSON — `typeof` acusa "object" nos dois
    // casos, e rodar keysToCamel nele corrompe o binário (deixa de ser um
    // Blob de verdade, URL.createObjectURL falha com "Overload resolution
    // failed"). Só a resposta JSON (default 'json') passa pela conversão.
    const responseType = response.config.responseType;
    if (response.data && typeof response.data === 'object' && (!responseType || responseType === 'json')) {
      response.data = keysToCamel(response.data);
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean }) | undefined;

    if (error.response?.status !== 401 || !config || config._retriedAfterRefresh || isAuthEndpoint(config.url)) {
      return Promise.reject(error);
    }
    config._retriedAfterRefresh = true;

    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newAccessToken = await refreshPromise;
      config.headers.set('Authorization', `Bearer ${newAccessToken}`);
      return apiClient(config);
    } catch {
      // Falha ao renovar (refresh token também expirado/revogado) — rejeita
      // com o 401 original; useAuthStore.logout() já limpou a sessão, e o
      // AuthGuard redireciona pra /login ao ver accessToken null.
      return Promise.reject(error);
    }
  },
);

interface BackendErrorBody {
  error?: {
    code?: string;
    message?: string;
    status?: number;
    details?: Array<{ field: string; message: string }>;
  };
}

const DEFAULT_ERROR_MESSAGE = 'Algo deu errado. Tente novamente.';

// Regra API_ERROR_MESSAGES: nunca mostrar o `.message` genérico do axios
// ("Request failed with status code 400") — sempre extrair a mensagem
// estruturada que o backend devolve.
export function extractErrorMessage(error: unknown, fallback: string = DEFAULT_ERROR_MESSAGE): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as BackendErrorBody | undefined;
    return body?.error?.message ?? fallback;
  }
  return fallback;
}

// `detail.field` volta em snake_case do backend (ex: "tenant_name") — os
// campos de formulário no frontend são camelCase (ex: register('tenantName')),
// então convertemos a chave para poder casar com `setError(fieldName, ...)`.
export function extractFieldErrors(error: unknown): Record<string, string> {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as BackendErrorBody | undefined;
    const details = body?.error?.details ?? [];
    return Object.fromEntries(details.map((detail) => [stringToCamelCase(detail.field), detail.message]));
  }
  return {};
}

export function extractErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as BackendErrorBody | undefined;
    return body?.error?.code;
  }
  return undefined;
}
