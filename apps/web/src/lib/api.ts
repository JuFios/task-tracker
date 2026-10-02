import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { useAuthStore, forceLogout } from '../stores/auth';
import type { ApiErrorBody, AuthResult } from '../types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshPromise: Promise<void> | null = null;

async function refreshTokens(): Promise<void> {
  const { refreshToken, setAuth } = useAuthStore.getState();
  if (!refreshToken) throw new Error('Missing refresh token');
  const { data } = await axios.post<AuthResult>(
    `${api.defaults.baseURL}/auth/refresh`,
    { refreshToken },
  );
  setAuth(data);
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetriableConfig | undefined;
    const isAuthRoute = Boolean(config?.url?.includes('/auth/'));

    if (error.response?.status === 401 && config && !config._retry && !isAuthRoute) {
      config._retry = true;
      refreshPromise ??= refreshTokens().finally(() => {
        refreshPromise = null;
      });
      try {
        await refreshPromise;
        // Update the auth header with the new token
        const newToken = useAuthStore.getState().accessToken;
        if (newToken) {
          config.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(config);
      } catch {
        forceLogout();
      }
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const message = error.response?.data?.message;
    if (Array.isArray(message) && message.length > 0) return message[0];
    if (typeof message === 'string' && message.length > 0) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function toastError(error: unknown, fallback?: string): void {
  toast.error(errorMessage(error, fallback));
}
