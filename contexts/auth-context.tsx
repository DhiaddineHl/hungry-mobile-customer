import {
  AuthResult,
  exchangeAuthorizationCode,
  fetchUserInfo,
  isTokenExpired,
  logout as keycloakLogout,
  KeycloakUserInfo,
  loginWithPassword,
  refreshAccessToken,
} from '@/services/keycloak/auth-service';
import { keycloakConfig } from '@/services/keycloak/config';
import { clearTokens, getTokens } from '@/services/keycloak/token-storage';
import { useCustomerStore } from '@/store/customer-store';
import { useQueryClient } from '@tanstack/react-query';
import * as AuthSession from 'expo-auth-session';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: KeycloakUserInfo | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<AuthResult>;
  // Registration moved to the backend: the signup screen calls
  // useRegisterCustomer (hooks/use-customer.ts), and the backend provisions
  // the Keycloak account + Customer entity atomically.
  loginWithGoogle: () => Promise<AuthResult>;
  /**
   * Re-fetches the user info from Keycloak after a profile change (done via
   * the backend, which syncs the Keycloak account). `overrides` patches
   * claims that userinfo does not return (e.g. `phoneNumber` unless mapped).
   */
  reloadUser: (overrides?: Partial<KeycloakUserInfo>) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * TEMPORARY: bypass authentication so the app is usable without logging in.
 *
 * While `true`, the app boots straight into the tabs with a mock guest user and
 * the Keycloak token bootstrap is skipped. Set back to `false` (or delete this
 * flag and the `BYPASS_AUTH` branches below) to restore the real auth flow.
 */
const BYPASS_AUTH = false;

const GUEST_USER: KeycloakUserInfo = {
  sub: 'guest',
  name: 'Guest',
  given_name: 'Guest',
  preferred_username: 'guest',
};

// Discovery for the browser-based Authorization Code + PKCE flow (Google login).
const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: keycloakConfig.authorizationEndpoint,
  tokenEndpoint: keycloakConfig.tokenEndpoint,
  endSessionEndpoint: keycloakConfig.endSessionEndpoint,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: BYPASS_AUTH,
    isLoading: !BYPASS_AUTH,
    user: BYPASS_AUTH ? GUEST_USER : null,
  });

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'hungrycustomer',
    path: 'auth/callback',
  });

  // The exact value below must be listed in the Keycloak client's
  // "Valid redirect URIs". If you see Keycloak's "Invalid parameter: redirect_uri"
  // page, copy this string verbatim into that list.
  console.log('[Auth] OAuth redirect_uri =', redirectUri);

  // Browser-based Authorization Code + PKCE flow, jumping straight to Google.
  const [googleRequest, , promptGoogleAsync] = AuthSession.useAuthRequest(
    {
      clientId: keycloakConfig.clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
      extraParams: {
        kc_idp_hint: 'google',
      },
    },
    discovery
  );

  // Drives a browser auth request to completion: prompt, then exchange the
  // returned authorization code (+ PKCE verifier) for tokens and load the user.
  const runBrowserAuth = useCallback(
    async (
      request: AuthSession.AuthRequest | null,
      promptAsync: () => Promise<AuthSession.AuthSessionResult>
    ): Promise<AuthResult> => {
      if (!request) {
        return { success: false, error: 'Authentication is not available yet. Please try again.' };
      }
      try {
        const result = await promptAsync();
        if (result.type === 'success' && result.params.code && request.codeVerifier) {
          const tokenResult = await exchangeAuthorizationCode(
            result.params.code,
            request.codeVerifier,
            redirectUri
          );
          if (tokenResult.success) {
            const userInfo = await fetchUserInfo();
            setState({ isAuthenticated: true, isLoading: false, user: userInfo });
          }
          return tokenResult;
        }
        if (result.type === 'cancel' || result.type === 'dismiss') {
          return { success: false, error: 'Authentication was cancelled' };
        }
        return { success: false, error: 'Authentication failed' };
      } catch {
        return { success: false, error: 'Authentication failed. Please try again.' };
      }
    },
    [redirectUri]
  );

  useEffect(() => {
    if (BYPASS_AUTH) return;
    (async () => {
      try {
        const tokens = await getTokens();
        if (!tokens) {
          setState({ isAuthenticated: false, isLoading: false, user: null });
          return;
        }

        if (isTokenExpired(tokens.accessToken)) {
          const result = await refreshAccessToken();
          if (!result.success) {
            await clearTokens();
            setState({ isAuthenticated: false, isLoading: false, user: null });
            return;
          }
        }

        const userInfo = await fetchUserInfo();
        setState({ isAuthenticated: true, isLoading: false, user: userInfo });
      } catch {
        setState({ isAuthenticated: false, isLoading: false, user: null });
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const result = await loginWithPassword(email, password);
    if (result.success) {
      const userInfo = await fetchUserInfo();
      setState({ isAuthenticated: true, isLoading: false, user: userInfo });
    }
    return result;
  }, []);

  const loginWithGoogleFn = useCallback(
    (): Promise<AuthResult> => runBrowserAuth(googleRequest, promptGoogleAsync),
    [runBrowserAuth, googleRequest, promptGoogleAsync]
  );

  const reloadUser = useCallback(async (overrides?: Partial<KeycloakUserInfo>) => {
    const refreshed = await fetchUserInfo();
    setState((prev) => {
      const base = refreshed ?? prev.user;
      if (!base) return prev;
      return { ...prev, user: { ...base, ...overrides } };
    });
  }, []);

  const logoutFn = useCallback(async () => {
    await keycloakLogout();
    // Drop everything tied to this account so the next login starts clean.
    useCustomerStore.getState().clear();
    queryClient.clear();
    setState({ isAuthenticated: false, isLoading: false, user: null });
  }, [queryClient]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const result = await refreshAccessToken();
    if (!result.success) {
      setState({ isAuthenticated: false, isLoading: false, user: null });
    }
    return result.success;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginWithGoogle: loginWithGoogleFn,
        reloadUser,
        logout: logoutFn,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
