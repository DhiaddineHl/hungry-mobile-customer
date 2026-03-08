import {
  AuthResult,
  exchangeAuthorizationCode,
  fetchUserInfo,
  isTokenExpired,
  logout as keycloakLogout,
  KeycloakUserInfo,
  loginWithPassword,
  refreshAccessToken,
  registerUser,
} from '@/services/keycloak/auth-service';
import { keycloakConfig } from '@/services/keycloak/config';
import { clearTokens, getTokens } from '@/services/keycloak/token-storage';
import * as AuthSession from 'expo-auth-session';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: KeycloakUserInfo | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    phoneNumber?: string
  ) => Promise<AuthResult>;
  loginWithGoogle: () => Promise<AuthResult>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: keycloakConfig.authorizationEndpoint,
  tokenEndpoint: keycloakConfig.tokenEndpoint,
  endSessionEndpoint: keycloakConfig.endSessionEndpoint,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
  });

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'hungrycustomer',
    path: 'auth/callback',
  });

  const [request, , promptAsync] = AuthSession.useAuthRequest(
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

  useEffect(() => {
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

  const register = useCallback(
    async (
      firstName: string,
      lastName: string,
      email: string,
      password: string,
      phoneNumber?: string
    ): Promise<AuthResult> => {
      const result = await registerUser(firstName, lastName, email, password, phoneNumber);
      if (result.success) {
        const userInfo = await fetchUserInfo();
        setState({ isAuthenticated: true, isLoading: false, user: userInfo });
      }
      return result;
    },
    []
  );

  const loginWithGoogleFn = useCallback(async (): Promise<AuthResult> => {
    if (!request) {
      return { success: false, error: 'Google login is not available' };
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
        return { success: false, error: 'Google login was cancelled' };
      }
      return { success: false, error: 'Google login failed' };
    } catch {
      return { success: false, error: 'Google login failed. Please try again.' };
    }
  }, [request, promptAsync, redirectUri]);

  const logoutFn = useCallback(async () => {
    await keycloakLogout();
    setState({ isAuthenticated: false, isLoading: false, user: null });
  }, []);

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
        register,
        loginWithGoogle: loginWithGoogleFn,
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
