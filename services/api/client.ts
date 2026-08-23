import { isTokenExpired, refreshAccessToken } from '@/services/keycloak/auth-service';
import { getTokens } from '@/services/keycloak/token-storage';
import axios, { AxiosError } from 'axios';

/**
 * Axios instance for the Hungry backend, addressed through the **jfwk-gateway**
 * edge (`EXPO_PUBLIC_API_URL`, port 8082) rather than hungry-app (8080) —
 * since the gateway was introduced, hungry-app is bound to the backend's
 * internal network and publishes no host port.
 *
 * - Attaches the Keycloak access token when a session exists, refreshing it
 *   first if expired. The gateway rejects unauthenticated requests at the edge
 *   with 401 before they ever reach hungry-app; the only endpoint this app
 *   calls without a token is `POST /customers` (self-registration), which the
 *   gateway explicitly permits.
 * - Normalizes failures into {@link ApiError} with a user-presentable message
 *   extracted from Spring's ProblemDetail payload when available. The gateway's
 *   own circuit-breaker fallback answers 503 with a `message` field, which the
 *   same extraction picks up.
 */
export const apiClient = axios.create({
  // Fallback is a placeholder LAN address; always set EXPO_PUBLIC_API_URL in .env.
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.100.93:8082',
  // Same rationale as the keycloak service's fetchWithTimeout: RN networking
  // has no default deadline and an unreachable LAN host would hang forever.
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  let tokens = await getTokens();
  if (tokens && isTokenExpired(tokens.accessToken)) {
    const result = await refreshAccessToken();
    tokens = result.success && result.tokens ? result.tokens : null;
  }
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** True when the error is an {@link ApiError} with the given HTTP status. */
export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<Record<string, unknown>>) => {
    if (error.response) {
      const data = error.response.data;
      const message =
        (typeof data?.detail === 'string' && data.detail) || // Spring ProblemDetail
        (typeof data?.message === 'string' && data.message) ||
        (typeof data?.error === 'string' && data.error) ||
        `Request failed (${error.response.status})`;
      throw new ApiError(message, error.response.status);
    }
    if (error.code === 'ECONNABORTED') {
      throw new ApiError(
        'Could not reach the server. Check that the API gateway URL is correct and reachable from this device.'
      );
    }
    throw new ApiError('Network error. Please check your connection.');
  }
);
