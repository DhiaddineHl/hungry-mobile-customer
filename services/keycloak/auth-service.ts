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

async function getAdminToken(): Promise<{ token?: string; error?: string }> {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'admin-cli',
    username: process.env.EXPO_PUBLIC_KEYCLOAK_ADMIN_USERNAME ?? 'admin',
    password: process.env.EXPO_PUBLIC_KEYCLOAK_ADMIN_PASSWORD ?? 'admin',
  });

  const url = `${keycloakConfig.url}/realms/master/protocol/openid-connect/token`;
  console.log('[Auth] Requesting admin token from:', url);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => null);
    console.error('[Auth] Admin token failed:', res.status, errorData);
    return {
      error: errorData?.error_description ?? errorData?.error ?? `Admin auth failed (${res.status})`,
    };
  }

  const data = await res.json();
  return { token: data.access_token };
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

    const response = await fetch(keycloakConfig.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      if (response.status === 401 || errorData?.error === 'invalid_grant') {
        return { success: false, error: 'Invalid email or password' };
      }
      return { success: false, error: errorData?.error_description ?? 'Login failed. Please try again.' };
    }

    const data: KeycloakTokenResponse = await response.json();
    const tokens = parseTokenResponse(data);
    await saveTokens(tokens);
    return { success: true, tokens };
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

export async function registerUser(
  firstName: string,
  lastName: string,
  email: string,
  password: string,
  phoneNumber?: string
): Promise<AuthResult> {
  try {
    const { token: adminToken, error: tokenError } = await getAdminToken();
    if (!adminToken) {
      return { success: false, error: tokenError ?? 'Could not authenticate with Keycloak admin.' };
    }

    const attributes: Record<string, string[]> = {};
    if (phoneNumber) {
      attributes.phoneNumber = [phoneNumber];
    }

    const registerResponse = await fetch(keycloakConfig.registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        username: email,
        email,
        firstName,
        lastName,
        enabled: true,
        emailVerified: true,
        credentials: [{ type: 'password', value: password, temporary: false }],
        attributes,
      }),
    });

    if (!registerResponse.ok) {
      const errorData = await registerResponse.json().catch(() => null);
      console.error('[Auth] Registration error:', registerResponse.status, errorData);
      if (registerResponse.status === 409) {
        return { success: false, error: 'An account with this email already exists.' };
      }
      const message =
        errorData?.errorMessage ??
        errorData?.error_description ??
        errorData?.error ??
        'Registration failed. Please try again.';
      return { success: false, error: message };
    }

    return loginWithPassword(email, password);
  } catch (err) {
    console.error('[Auth] Registration exception:', err);
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

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

    const response = await fetch(keycloakConfig.tokenEndpoint, {
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
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' };
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

    const response = await fetch(keycloakConfig.tokenEndpoint, {
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
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

export async function fetchUserInfo(): Promise<KeycloakUserInfo | null> {
  try {
    const tokens = await getTokens();
    if (!tokens?.accessToken) return null;

    const response = await fetch(keycloakConfig.userInfoEndpoint, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        const refreshResult = await refreshAccessToken();
        if (refreshResult.success && refreshResult.tokens) {
          const retryResponse = await fetch(keycloakConfig.userInfoEndpoint, {
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
      await fetch(keycloakConfig.endSessionEndpoint, {
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
