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
import { AuthMethod, clearTokens, getAuthMethod, getTokens } from '@/services/keycloak/token-storage';
import { resolveCustomerForAccount } from '@/hooks/use-customer';
import { deleteCurrentAccount } from '@/services/api/customer-service';
import { isApiError } from '@/services/api/client';
import { clearPushRegistration } from '@/services/notifications/push-service';
import { useCustomerStore } from '@/store/customer-store';
import { useFavoritesStore } from '@/store/favorites-store';
import { useDeliveryAddressStore } from '@/store/delivery-address-store';
import { useNotificationStore } from '@/store/notification-store';
import { useQueryClient } from '@tanstack/react-query';
import * as AuthSession from 'expo-auth-session';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: KeycloakUserInfo | null;
  /**
   * How this session was established, restored from storage on boot. `null`
   * only for a session that predates this being recorded (or the bypass user).
   * The router reads it to skip the e-mail verification gate for Google.
   */
  authMethod: AuthMethod | null;
}

interface AuthContextValue extends AuthState {
  /**
   * Whether the customer record behind the current session has been resolved
   * (read from the backend — see `resolveCustomerForAccount`). The router
   * waits on this before choosing between the app, the profile completion and
   * the address onboarding, so a new account never flashes the tabs on its way
   * through them.
   *
   * `true` with a `null` record means the lookup finished and the backend has
   * none: a Google account that has not filled in its profile yet.
   */
  isCustomerResolved: boolean;
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
  /**
   * Permanently deletes the customer's account (backend record + Keycloak
   * login) and ends the session. Everything this device holds for the account
   * is wiped too — a deleted account must not leave a cart or favorites behind
   * for the next sign-in. Rejects if the backend refuses; the session is then
   * left intact so the customer can retry.
   */
  deleteAccount: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * TEMPORARY: bypass authentication so the app is usable without logging in.
 *
 * While `true`, the app boots straight into the tabs with a mock guest user and
 * the Keycloak token bootstrap is skipped. Set back to `false` (or delete this
 * flag and the `BYPASS_AUTH` branches below) to restore the real auth flow.
 *
 * Note: this no longer yields a working app against the real backend. Every
 * request now goes through the jfwk-gateway, which answers 401 at the edge for
 * anything but `POST /customers` — a bypassed session has no token to send.
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
    authMethod: null,
  });
  const [isCustomerResolved, setIsCustomerResolved] = useState(BYPASS_AUTH);

  // `native` is required, not decorative. Without it makeRedirectUri falls
  // through to Linking.createURL, which splices Constants.expoConfig.hostUri —
  // the METRO DEV SERVER host — into the URL, because a LAN/localhost host is
  // not "Expo hosted" and so never gets stripped. On an emulator that yields
  // hungrycustomer://localhost:8081/auth/callback, and the browser is left
  // sitting on a dead localhost:8081 after Keycloak redirects. Passing `native`
  // short-circuits all of that in dev/standalone builds (not Expo Go).
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'hungrycustomer',
    path: 'auth/callback',
    native: 'hungrycustomer://auth/callback',
  });

  // The exact value below must be listed in the Keycloak client's
  // "Valid redirect URIs". If you see Keycloak's "Invalid parameter: redirect_uri"
  // page, copy this string verbatim into that list.
  console.log('[Auth] OAuth redirect_uri =', redirectUri);

  // Browser-based Authorization Code + PKCE flow, jumping straight to Google.
  //
  // `prompt=login` stops Keycloak from silently resuming its browser SSO
  // session (the KEYCLOAK_IDENTITY cookie outlives our back-channel logout,
  // which only revokes the refresh token). Without it, tapping "Continue with
  // Google" re-authenticates the previous user with no chance to switch.
  // Keycloak must ALSO be told to forward an account chooser to Google —
  // Identity providers > google > Advanced > Prompt = "select_account" — or
  // Google auto-selects its remembered account on the next hop.
  const [googleRequest, , promptGoogleAsync] = AuthSession.useAuthRequest(
    {
      clientId: keycloakConfig.clientId,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
      prompt: AuthSession.Prompt.Login,
      extraParams: {
        kc_idp_hint: 'google',
      },
    },
    discovery
  );

  // Warm the customer record into the query cache as soon as we have an
  // account id, so it is ready across the app right after login/session
  // restore instead of only when a screen first reads it. No record is created
  // here: a Google account without one is sent to the profile-completion
  // screen, which is what creates it (see `resolveCustomerForAccount`).
  //
  // Fire-and-forget on purpose: the session is already valid, so a backend
  // hiccup here must not block the user out of the app. The screens that need
  // the record refetch it through `useCustomer`.
  const resolveCustomer = useCallback(
    (sub?: string | null) => {
      if (!sub) {
        setIsCustomerResolved(true);
        return;
      }
      setIsCustomerResolved(false);
      resolveCustomerForAccount(queryClient, sub)
        .catch((error) => {
          console.warn('[Auth] Could not resolve the customer record:', error);
        })
        .finally(() => setIsCustomerResolved(true));
    },
    [queryClient]
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
            setState({
              isAuthenticated: true,
              isLoading: false,
              user: userInfo,
              authMethod: 'google',
            });
            resolveCustomer(userInfo?.sub);
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
    [redirectUri, resolveCustomer]
  );

  useEffect(() => {
    if (BYPASS_AUTH) return;
    (async () => {
      try {
        const tokens = await getTokens();
        if (!tokens) {
          setState({ isAuthenticated: false, isLoading: false, user: null, authMethod: null });
          setIsCustomerResolved(true);
          return;
        }

        if (isTokenExpired(tokens.accessToken)) {
          const result = await refreshAccessToken();
          if (!result.success) {
            await clearTokens();
            setState({ isAuthenticated: false, isLoading: false, user: null, authMethod: null });
            return;
          }
        }

        const [userInfo, authMethod] = await Promise.all([fetchUserInfo(), getAuthMethod()]);
        setState({ isAuthenticated: true, isLoading: false, user: userInfo, authMethod });
        resolveCustomer(userInfo?.sub);
      } catch {
        setState({ isAuthenticated: false, isLoading: false, user: null, authMethod: null });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const result = await loginWithPassword(email, password);
    if (result.success) {
      const userInfo = await fetchUserInfo();
      setState({
        isAuthenticated: true,
        isLoading: false,
        user: userInfo,
        authMethod: 'password',
      });
      resolveCustomer(userInfo?.sub);
    }
    return result;
  }, [resolveCustomer]);

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

  /**
   * Drops everything tied to this account so the next login starts clean.
   * Shared by sign-out and account deletion; `local` additionally wipes what
   * survives a plain sign-out (cart, favorites, order snapshots) because a
   * deleted account has no "next time" for them to come back on.
   */
  const clearSession = useCallback(
    (options: { local: boolean }) => {
      useCustomerStore.getState().clear();
      useDeliveryAddressStore.getState().clear();
      // The inbox is this account's order history in another form.
      useNotificationStore.getState().clear();
      if (options.local) {
        // The cart lives on the server with the account, so there is nothing on
        // the device to wipe; `queryClient.clear()` below drops the cached copy.
        useFavoritesStore.getState().clear();
      }
      queryClient.clear();
      setState({ isAuthenticated: false, isLoading: false, user: null, authMethod: null });
    },
    [queryClient]
  );

  const logoutFn = useCallback(async () => {
    // Before the tokens go: unregistering is an authenticated call, and once
    // the session is cleared the backend can no longer tell whose device this
    // is. Skipping it would leave this account's order notifications landing on
    // the lock screen of whoever signs in here next.
    await clearPushRegistration();
    await keycloakLogout();
    clearSession({ local: false });
  }, [clearSession]);

  const deleteAccountFn = useCallback(async () => {
    // Same ordering reason as logout: the device row must go while the token
    // still identifies the account. The backend deletes the customer and the
    // Keycloak user; a 404 means there was no record to delete (a Google
    // sign-in that never completed its profile), which is still "done".
    await clearPushRegistration();
    try {
      await deleteCurrentAccount();
    } catch (error) {
      if (!isApiError(error, 404)) throw error;
    }
    // The Keycloak user is gone, so revoking the refresh token may be refused;
    // `keycloakLogout` swallows that and clears the local tokens regardless.
    await keycloakLogout();
    clearSession({ local: true });
  }, [clearSession]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const result = await refreshAccessToken();
    if (!result.success) {
      setState({ isAuthenticated: false, isLoading: false, user: null, authMethod: null });
    }
    return result.success;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        isCustomerResolved,
        login,
        loginWithGoogle: loginWithGoogleFn,
        reloadUser,
        logout: logoutFn,
        deleteAccount: deleteAccountFn,
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
