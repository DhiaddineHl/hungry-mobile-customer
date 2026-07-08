import { keycloakConfig } from './config';
import { clearTokens, getTokens, saveTokens, TokenSet } from './token-storage';

interface KeycloakTokenResponse {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
}

export interface KeycloakUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  preferred_username?: string;
  /** Custom attribute; only present if mapped into the userinfo claims, or set
   *  optimistically by the app after a profile update. */
  phoneNumber?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  tokens?: TokenSet;
}

function parseTokenResponse(data: KeycloakTokenResponse): TokenSet {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    idToken: data.id_token,
  };
}

/** Thrown by fetchWithTimeout when a request exceeds the deadline. */
class TimeoutError extends Error {}

/**
 * fetch() with an AbortController deadline. React Native's fetch has no default
 * timeout, so an unreachable Keycloak host (wrong IP, blocked port, cleartext
 * blocked) would otherwise hang the UI forever. 15s is generous for a LAN.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new TimeoutError(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Maps a thrown network/timeout error to a user-facing message. */
function networkErrorMessage(err: unknown): string {
  if (err instanceof TimeoutError) {
    return 'Could not reach the server. Check that the Keycloak URL is correct and reachable from this device.';
  }
  return 'Network error. Please check your connection.';
}

export async function loginWithPassword(email: string, password: string): Promise<AuthResult> {
  try {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: keycloakConfig.clientId,
      username: email,
      password,
      scope: 'openid profile email',
    });

    console.log('[Auth] Login → POST', keycloakConfig.tokenEndpoint);
    const response = await fetchWithTimeout(keycloakConfig.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.warn('[Auth] Login failed:', response.status, errorData);
      if (response.status === 401 || errorData?.error === 'invalid_grant') {
        return { success: false, error: 'Invalid email or password' };
      }
      return { success: false, error: errorData?.error_description ?? 'Login failed. Please try again.' };
    }

    const data: KeycloakTokenResponse = await response.json();
    const tokens = parseTokenResponse(data);
    await saveTokens(tokens);
    return { success: true, tokens };
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return { success: false, error: networkErrorMessage(err) };
  }
}

// NOTE: the Keycloak Admin API calls (in-app registration, profile updates)
// were removed — both now go through the backend (POST/PUT /customers), which
// provisions/updates the Keycloak account and the Customer entity atomically.
// This also removed the Keycloak admin credentials from the app bundle. See
// services/api/customer-service.ts.

export async function refreshAccessToken(): Promise<AuthResult> {
  try {
    const currentTokens = await getTokens();
    if (!currentTokens?.refreshToken) {
      return { success: false, error: 'No refresh token available' };
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: keycloakConfig.clientId,
      refresh_token: currentTokens.refreshToken,
    });

    const response = await fetchWithTimeout(keycloakConfig.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      await clearTokens();
      return { success: false, error: 'Session expired. Please log in again.' };
    }

    const data: KeycloakTokenResponse = await response.json();
    const tokens = parseTokenResponse(data);
    await saveTokens(tokens);
    return { success: true, tokens };
  } catch (err) {
    return { success: false, error: networkErrorMessage(err) };
  }
}

export async function exchangeAuthorizationCode(
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<AuthResult> {
  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: keycloakConfig.clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const response = await fetchWithTimeout(keycloakConfig.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return { success: false, error: errorData?.error_description ?? 'Google login failed. Please try again.' };
    }

    const data: KeycloakTokenResponse = await response.json();
    const tokens = parseTokenResponse(data);
    await saveTokens(tokens);
    return { success: true, tokens };
  } catch (err) {
    return { success: false, error: networkErrorMessage(err) };
  }
}

export async function fetchUserInfo(): Promise<KeycloakUserInfo | null> {
  try {
    const tokens = await getTokens();
    if (!tokens?.accessToken) return null;

    const response = await fetchWithTimeout(keycloakConfig.userInfoEndpoint, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        const refreshResult = await refreshAccessToken();
        if (refreshResult.success && refreshResult.tokens) {
          const retryResponse = await fetchWithTimeout(keycloakConfig.userInfoEndpoint, {
            headers: { Authorization: `Bearer ${refreshResult.tokens.accessToken}` },
          });
          if (retryResponse.ok) return retryResponse.json();
        }
      }
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  try {
    const tokens = await getTokens();
    if (tokens?.refreshToken) {
      const body = new URLSearchParams({
        client_id: keycloakConfig.clientId,
        refresh_token: tokens.refreshToken,
      });
      // id_token_hint lets Keycloak also terminate the browser SSO session
      // established by the Authorization Code flow (Google / hosted register),
      // not just revoke the refresh token.
      if (tokens.idToken) {
        body.set('id_token_hint', tokens.idToken);
      }
      await fetchWithTimeout(keycloakConfig.endSessionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }).catch(() => {});
    }
  } finally {
    await clearTokens();
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(decoded);
    if (typeof parsed.exp !== 'number') return true;
    return Date.now() >= parsed.exp * 1000;
  } catch {
    return true;
  }
}
