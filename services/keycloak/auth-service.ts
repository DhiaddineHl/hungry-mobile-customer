import { keycloakConfig } from './config';
import { saveTokens, getTokens, clearTokens, TokenSet } from './token-storage';

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
    const adminTokenBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: keycloakConfig.clientId,
      scope: 'openid',
    });

    let adminToken: string | null = null;
    const adminTokenResponse = await fetch(keycloakConfig.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: adminTokenBody.toString(),
    });

    if (adminTokenResponse.ok) {
      const adminData = await adminTokenResponse.json();
      adminToken = adminData.access_token;
    }

    const attributes: Record<string, string[]> = {};
    if (phoneNumber) {
      attributes.phoneNumber = [phoneNumber];
    }

    const userPayload = {
      firstName,
      lastName,
      email,
      username: email,
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
      attributes,
    };

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) {
      headers['Authorization'] = `Bearer ${adminToken}`;
    }

    const registerResponse = await fetch(keycloakConfig.registrationEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(userPayload),
    });

    if (!registerResponse.ok) {
      const errorData = await registerResponse.json().catch(() => null);
      if (registerResponse.status === 409) {
        return { success: false, error: 'An account with this email already exists' };
      }
      return { success: false, error: errorData?.errorMessage ?? 'Registration failed. Please try again.' };
    }

    return loginWithPassword(email, password);
  } catch {
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
