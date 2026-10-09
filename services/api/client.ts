import { isTokenExpired, refreshAccessToken } from '@/services/keycloak/auth-service';
import { getTokens } from '@/services/keycloak/token-storage';
import { API_URL } from '@/services/config/endpoints';
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
  // Always set EXPO_PUBLIC_API_URL in .env; the LAN fallback is dev-only.
  baseURL: API_URL,
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
  /**
   * The raw error payload. Spring's ProblemDetail carries custom properties
   * beside `detail` — the verification endpoints add `reason` and
   * `retryAfterSeconds` — and callers that branch on those need more than the
   * message.
   */
  readonly data?: Record<string, unknown>;

  constructor(message: string, status?: number, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/** True when the error is an {@link ApiError} with the given HTTP status. */
export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

/** What to tell the customer when the server gave nothing presentable. */
function fallbackMessage(status: number): string {
  if (status === 401) return 'Your session has ended. Sign in again to continue.';
  if (status === 403) return "Your account can't do that.";
  if (status === 404) return "We couldn't find that. It may have been removed.";
  if (status === 429) return 'Too many attempts. Wait a minute, then try again.';
  if (status >= 500) return "Hungry's servers aren't responding right now. Try again in a moment.";
  return "That request didn't go through. Check what you entered and try again.";
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<Record<string, unknown>>) => {
    if (error.response) {
      const { status } = error.response;
      const data = error.response.data;
      if (__DEV__) console.warn(`[API] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${status}`, data);
      // Only a 4xx carries text written for the customer (the ProblemDetail
      // `detail` the backend phrases on purpose). A 5xx body is a stack's
      // worth of internals at worst and noise at best — it stays on `data`.
      const serverText =
        status < 500
          ? (typeof data?.detail === 'string' && data.detail) || // Spring ProblemDetail
            (typeof data?.message === 'string' && data.message)
          : null;
      throw new ApiError(serverText || fallbackMessage(status), status, data);
    }
    if (error.code === 'ECONNABORTED') {
      throw new ApiError("We couldn't reach Hungry in time. Check your connection and try again.");
    }
    throw new ApiError("You're offline. Check your connection and try again.");
  }
);
