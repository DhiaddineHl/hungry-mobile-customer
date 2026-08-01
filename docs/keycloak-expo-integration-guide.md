# Integrating Keycloak Auth + Backend Entity Sync in an Expo React Native App

**Audience:** a Claude coding agent asked to add Keycloak authentication (login, registration,
social login, session persistence) to an Expo / React Native app whose backend owns a domain
entity (`Customer`, `Driver`, `Merchant`, …) that must stay in sync with the Keycloak account.

This is a distilled, portable version of a working implementation (Expo SDK 56, expo-router,
Spring Boot backend, Keycloak 26). Substitute the placeholders below throughout.

| Placeholder | Example in the reference app | Meaning |
|---|---|---|
| `<Entity>` / `<entity>` | `Customer` / `customer` | Backend domain entity mirroring the account |
| `<entities>` | `customers` | REST collection path |
| `<scheme>` | `hungrycustomer` | App deep-link scheme (`app.json` → `expo.scheme`) |
| `<realm>` | `hungry` | Keycloak realm |
| `<client-id>` | `hungry-customer-app` | Public Keycloak client for the mobile app |
| `<APP>` | `HUNGRY` | Env-var prefix |

---

## 0. The one architectural rule

> **The mobile app never holds Keycloak admin/service-account credentials.**
> Account creation and profile updates go through **your backend**, which owns the
> `manage-users` service-account client and writes the Keycloak user *and* the `<Entity>`
> row in a single transaction.

Everything else follows from this. Concretely, the app talks to Keycloak for **only four
things** — token endpoint (login / refresh / code exchange), authorize endpoint (browser flow),
userinfo, and logout. It talks to the **backend** for register, profile update, and reads.

```
                 ┌──────────────────────────── Keycloak ────────────────────────────┐
   login/refresh │  /token   /auth   /userinfo   /logout                            │
   ──────────────┤                                            ▲ admin REST          │
   Expo app      │                                            │ (service account)   │
   ──────────────┤                                            │                     │
   register/     │                                     ┌──────┴───────┐             │
   update/read   └────────────────────────────────────►│   Backend    │─── DB ──────┘
   (Bearer token)          POST/PUT/GET /<entities>    │ (Spring Boot)│  <Entity> row
                                                       └──────────────┘   keycloakUserId
```

**Why not the Keycloak Admin API from the app?** It requires admin credentials, and every
`EXPO_PUBLIC_*` value ships in the bundle in plaintext. **Why not create the `<Entity>` row
lazily on first login?** Then registration is two non-atomic calls and a crash between them
leaves an orphan Keycloak user with no domain record.

**The join key is the Keycloak `sub`** (the user's UUID). The backend stores it on the entity
(`keycloakUserId`, and mirrored into a business `code` field) and exposes a lookup by it.
The app derives it from the access token's `sub` claim via `userinfo`.

---

## 1. Dependencies

```bash
npx expo install expo-auth-session expo-crypto expo-web-browser expo-secure-store \
                 expo-linking @react-native-async-storage/async-storage
npm i axios @tanstack/react-query zustand
```

`expo-crypto` is required by `expo-auth-session` for PKCE. Add the config plugins:

```jsonc
// app.json
{
  "expo": {
    "scheme": "<scheme>",                    // REQUIRED — this is the OAuth redirect scheme
    "plugins": ["expo-router", "expo-secure-store", "expo-web-browser", "..."]
  }
}
```

`.env` (all `EXPO_PUBLIC_*` values are **public** — never put secrets here):

```dotenv
EXPO_PUBLIC_KEYCLOAK_URL=https://auth.example.com
EXPO_PUBLIC_KEYCLOAK_REALM=<realm>
EXPO_PUBLIC_KEYCLOAK_CLIENT_ID=<client-id>
EXPO_PUBLIC_API_URL=https://api.example.com
```

> On a physical device, `localhost` is the phone. Use the LAN IP of the dev machine for both
> URLs, and on Android enable cleartext (`usesCleartextTraffic`) or use HTTPS.

---

## 2. File layout to create

```
services/keycloak/
  config.ts          # endpoints derived from env
  token-storage.ts   # SecureStore (native) / localStorage (web)
  auth-service.ts    # token endpoint calls, userinfo, logout, JWT expiry
services/api/
  client.ts          # axios instance + Bearer interceptor + error normalization
  types.ts           # backend DTOs (<Entity>Input / <Entity>Output)
  <entity>-service.ts# register / getByAccount / update
  query-keys.ts      # query-key factory
contexts/
  auth-context.tsx   # AuthProvider + useAuth
hooks/
  use-<entity>.ts    # React Query hooks (query + register/update mutations)
store/
  <entity>-store.ts  # persisted { keycloakUserId, <entity>Id } for pre-login onboarding
```

Build them in this order — each depends only on the ones above it.

---

## 3. `services/keycloak/config.ts`

Derive every endpoint from three env vars. Do **not** add admin endpoints here.

```ts
const KEYCLOAK_URL = process.env.EXPO_PUBLIC_KEYCLOAK_URL ?? 'http://192.168.1.10:8081';
const REALM = process.env.EXPO_PUBLIC_KEYCLOAK_REALM ?? '<realm>';
const CLIENT_ID = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID ?? '<client-id>';

const realmUrl = `${KEYCLOAK_URL}/realms/${REALM}`;

export const keycloakConfig = {
  url: KEYCLOAK_URL,
  realm: REALM,
  clientId: CLIENT_ID,
  realmUrl,
  authorizationEndpoint: `${realmUrl}/protocol/openid-connect/auth`,
  tokenEndpoint:         `${realmUrl}/protocol/openid-connect/token`,
  endSessionEndpoint:    `${realmUrl}/protocol/openid-connect/logout`,
  userInfoEndpoint:      `${realmUrl}/protocol/openid-connect/userinfo`,
  // No Admin REST endpoints on purpose: account creation and profile updates go
  // through the backend, which holds the service-account credentials.
};
```

---

## 4. `services/keycloak/token-storage.ts`

Three keys: access, refresh, id. `idToken` is optional but **needed for full logout**
(`id_token_hint`), so persist it whenever Keycloak returns one.

```ts
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'keycloak_access_token';
const REFRESH_TOKEN_KEY = 'keycloak_refresh_token';
const ID_TOKEN_KEY = 'keycloak_id_token';

export interface TokenSet { accessToken: string; refreshToken: string; idToken?: string }

// SecureStore has no web implementation → fall back to localStorage on web.
async function setItem(k: string, v: string) {
  Platform.OS === 'web' ? localStorage.setItem(k, v) : await SecureStore.setItemAsync(k, v);
}
async function getItem(k: string) {
  return Platform.OS === 'web' ? localStorage.getItem(k) : SecureStore.getItemAsync(k);
}
async function deleteItem(k: string) {
  Platform.OS === 'web' ? localStorage.removeItem(k) : await SecureStore.deleteItemAsync(k);
}

export async function saveTokens(t: TokenSet) {
  await setItem(ACCESS_TOKEN_KEY, t.accessToken);
  await setItem(REFRESH_TOKEN_KEY, t.refreshToken);
  if (t.idToken) await setItem(ID_TOKEN_KEY, t.idToken);
}

export async function getTokens(): Promise<TokenSet | null> {
  const [accessToken, refreshToken, idToken] = await Promise.all([
    getItem(ACCESS_TOKEN_KEY), getItem(REFRESH_TOKEN_KEY), getItem(ID_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken, idToken: idToken ?? undefined };
}

export async function clearTokens() {
  await Promise.all([deleteItem(ACCESS_TOKEN_KEY), deleteItem(REFRESH_TOKEN_KEY), deleteItem(ID_TOKEN_KEY)]);
}
```

> ⚠️ `localStorage` is XSS-readable. If you ship a real web build, move web tokens in-memory
> or behind an httpOnly cookie issued by the backend. Native `SecureStore` is fine.

---

## 5. `services/keycloak/auth-service.ts`

Pure functions over the OIDC endpoints — no React. Every function returns a discriminated
result (`{ success, error?, tokens? }`) rather than throwing, so screens can render the
message directly.

### 5.1 Non-obvious pieces you must include

**A timeout wrapper.** React Native's `fetch` has *no default timeout*. A wrong LAN IP or a
blocked port hangs the login button forever. This is the single most common "auth is broken"
report during development.

```ts
class TimeoutError extends Error {}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) throw new TimeoutError(`Request to ${url} timed out`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function networkErrorMessage(err: unknown): string {
  return err instanceof TimeoutError
    ? 'Could not reach the server. Check that the Keycloak URL is correct and reachable from this device.'
    : 'Network error. Please check your connection.';
}
```

**Keycloak wants `application/x-www-form-urlencoded`, not JSON.** Build bodies with
`URLSearchParams` and `.toString()`. Sending JSON to `/token` yields an opaque 400.

**Local JWT expiry check** so the app can refresh proactively instead of waiting for a 401:

```ts
export function isTokenExpired(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/')); // base64url → base64
    const { exp } = JSON.parse(decoded);
    return typeof exp !== 'number' || Date.now() >= exp * 1000;
  } catch {
    return true; // unparseable → treat as expired
  }
}
```

### 5.2 The four calls

```ts
interface KeycloakTokenResponse {
  access_token: string; refresh_token: string; id_token?: string;
  expires_in: number; refresh_expires_in: number; token_type: string;
}

export interface KeycloakUserInfo {
  sub: string;                 // ← the join key with the backend entity
  email?: string; email_verified?: boolean;
  name?: string; given_name?: string; family_name?: string; preferred_username?: string;
  /** Custom attribute — only present if mapped into the userinfo claims. */
  phoneNumber?: string;
}

const parse = (d: KeycloakTokenResponse): TokenSet => ({
  accessToken: d.access_token, refreshToken: d.refresh_token, idToken: d.id_token,
});
```

**1. Password grant (ROPC)** — only if the product requires a native login form; see §9.

```ts
export async function loginWithPassword(email: string, password: string): Promise<AuthResult> {
  try {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: keycloakConfig.clientId,
      username: email,
      password,
      scope: 'openid profile email',
    });
    const response = await fetchWithTimeout(keycloakConfig.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      // Keycloak returns 401 + invalid_grant for BOTH bad password and disabled user.
      if (response.status === 401 || err?.error === 'invalid_grant') {
        return { success: false, error: 'Invalid email or password' };
      }
      return { success: false, error: err?.error_description ?? 'Login failed. Please try again.' };
    }
    const tokens = parse(await response.json());
    await saveTokens(tokens);
    return { success: true, tokens };
  } catch (err) {
    return { success: false, error: networkErrorMessage(err) };
  }
}
```

**2. Authorization-code exchange** (used by the browser/PKCE flow — social login, hosted login):

```ts
export async function exchangeAuthorizationCode(
  code: string, codeVerifier: string, redirectUri: string
): Promise<AuthResult> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: keycloakConfig.clientId,
    code,
    redirect_uri: redirectUri,   // must byte-match the one sent to /auth
    code_verifier: codeVerifier, // PKCE
  });
  /* …same POST/parse/saveTokens shape as above… */
}
```

**3. Refresh** — on failure, **clear the tokens** so the app drops to the login screen instead
of retrying a dead session forever. If Keycloak has refresh-token rotation enabled, the
response carries a *new* refresh token; `saveTokens` must persist it or the next refresh fails.

```ts
export async function refreshAccessToken(): Promise<AuthResult> {
  const current = await getTokens();
  if (!current?.refreshToken) return { success: false, error: 'No refresh token available' };
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: keycloakConfig.clientId,
    refresh_token: current.refreshToken,
  });
  const response = await fetchWithTimeout(/* …token endpoint… */);
  if (!response.ok) {
    await clearTokens();
    return { success: false, error: 'Session expired. Please log in again.' };
  }
  const tokens = parse(await response.json());
  await saveTokens(tokens);
  return { success: true, tokens };
}
```

**4. `fetchUserInfo` with one 401-retry**, and **logout with `id_token_hint`**:

```ts
export async function fetchUserInfo(): Promise<KeycloakUserInfo | null> {
  const tokens = await getTokens();
  if (!tokens?.accessToken) return null;
  const res = await fetchWithTimeout(keycloakConfig.userInfoEndpoint, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (res.ok) return res.json();
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed.success && refreshed.tokens) {
      const retry = await fetchWithTimeout(keycloakConfig.userInfoEndpoint, {
        headers: { Authorization: `Bearer ${refreshed.tokens.accessToken}` },
      });
      if (retry.ok) return retry.json();
    }
  }
  return null;
}

export async function logout(): Promise<void> {
  try {
    const tokens = await getTokens();
    if (tokens?.refreshToken) {
      const body = new URLSearchParams({
        client_id: keycloakConfig.clientId,
        refresh_token: tokens.refreshToken,
      });
      // Without id_token_hint, only the refresh token is revoked — the browser SSO
      // session survives, so "log out → Continue with Google" silently re-logs the
      // same account with no account picker.
      if (tokens.idToken) body.set('id_token_hint', tokens.idToken);
      await fetchWithTimeout(keycloakConfig.endSessionEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }).catch(() => {}); // network failure must not block local sign-out
    }
  } finally {
    await clearTokens(); // always clear locally, even if the server call failed
  }
}
```

---

## 6. `services/api/client.ts` — the backend bridge

This is where Keycloak and the backend meet: one axios interceptor attaches the token and
refreshes it *before* the request when expired.

```ts
export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.10:8080',
  timeout: 15000,                       // same rationale as fetchWithTimeout
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  let tokens = await getTokens();
  if (tokens && isTokenExpired(tokens.accessToken)) {
    const result = await refreshAccessToken();
    tokens = result.success && result.tokens ? result.tokens : null;
  }
  // No session → send unauthenticated. Registration during onboarding needs this.
  if (tokens?.accessToken) config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  return config;
});
```

Normalize errors into a typed `ApiError` so screens and React Query can branch on status
(notably: 404 from the by-account lookup means "no entity yet", not a failure):

```ts
export class ApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) { super(message); this.name = 'ApiError'; this.status = status; }
}
export function isApiError(e: unknown, status?: number): e is ApiError {
  return e instanceof ApiError && (status === undefined || e.status === status);
}

apiClient.interceptors.response.use(
  (r) => r,
  (error: AxiosError<Record<string, unknown>>) => {
    if (error.response) {
      const d = error.response.data;
      const message =
        (typeof d?.detail === 'string' && d.detail) ||     // Spring ProblemDetail
        (typeof d?.message === 'string' && d.message) ||
        (typeof d?.error === 'string' && d.error) ||
        `Request failed (${error.response.status})`;
      throw new ApiError(message, error.response.status);
    }
    if (error.code === 'ECONNABORTED') throw new ApiError('Could not reach the server…');
    throw new ApiError('Network error. Please check your connection.');
  }
);
```

---

## 7. Backend contract (`services/api/<entity>-service.ts`)

Three endpoints. Mirror the backend DTOs in `types.ts` and keep them in sync with the server.

| Call | Endpoint | Auth | Backend does |
|---|---|---|---|
| Register | `POST /<entities>` | none (no session yet) | creates Keycloak user **+** `<Entity>` row atomically; returns `keycloakUserId` |
| Read | `GET /<entities>/by-account/{keycloakUserId}` | Bearer | resolves the entity by `sub`; **404** when absent |
| Update | `PUT /<entities>` | Bearer | resolves by `code` (= `sub`), applies present fields, mirrors name/email/phone onto the Keycloak user |

```ts
export interface <Entity>Registration {
  firstName: string; lastName: string; email: string; password: string; phoneNumber?: string;
}

/** One call: the backend provisions the Keycloak login and the entity together. */
export async function register<Entity>(r: <Entity>Registration): Promise<<Entity>> {
  const input: <Entity>Input = {
    name: `${r.firstName} ${r.lastName}`.trim(),
    fullname: { firstName: r.firstName, lastName: r.lastName },
    contact: { email: r.email, phones: r.phoneNumber ? [r.phoneNumber] : [] },
    password: r.password,   // sent ONLY at registration
  };
  const { data } = await apiClient.post<<Entity>>('/<entities>', input);
  return data;
}

/** Throws ApiError(404) when the account has no entity — e.g. social sign-in. */
export async function get<Entity>ByAccount(keycloakUserId: string): Promise<<Entity>> {
  const { data } = await apiClient.get<<Entity>>(
    `/<entities>/by-account/${encodeURIComponent(keycloakUserId)}`
  );
  return data;
}

/** Partial update; the backend resolves by `code` and applies only present fields. */
export async function update<Entity>(input: <Entity>Input): Promise<<Entity>> {
  const { data } = await apiClient.put<<Entity>>('/<entities>', input);
  return data;
}
```

**Backend-side requirements to state to the backend team (or implement):**

1. A confidential Keycloak client with a **service account** holding `realm-management → manage-users`.
2. `POST /<entities>` is **permitted unauthenticated** (it is the registration endpoint) but rate-limited.
3. Registration order: create the Keycloak user → set password → persist the entity with
   `keycloakUserId = sub` and `code = sub`, **in one transaction**; on entity failure, delete
   the Keycloak user (compensating action) so no orphan remains.
4. Updates mirror name/email/phone back onto the Keycloak user in the same transaction.
5. The API validates the Bearer token against `<realm>`'s JWKS and, for `PUT`, checks that the
   token's `sub` matches the targeted record — otherwise any user can edit any record.

---

## 8. `contexts/auth-context.tsx` — the app-facing surface

State: `{ isAuthenticated, isLoading, user }`. Actions: `login`, `loginWithGoogle`,
`reloadUser`, `logout`, `refreshSession`. Registration deliberately lives **outside** the auth
context (it is a backend mutation, see §7 and the `useRegister<Entity>` hook).

### 8.1 Bootstrap on mount — the session-restore path

```tsx
useEffect(() => {
  (async () => {
    try {
      const tokens = await getTokens();
      if (!tokens) return setState({ isAuthenticated: false, isLoading: false, user: null });

      if (isTokenExpired(tokens.accessToken)) {
        const result = await refreshAccessToken();
        if (!result.success) {
          await clearTokens();
          return setState({ isAuthenticated: false, isLoading: false, user: null });
        }
      }
      const userInfo = await fetchUserInfo();
      setState({ isAuthenticated: true, isLoading: false, user: userInfo });
      prefetch<Entity>(userInfo?.sub);
    } catch {
      setState({ isAuthenticated: false, isLoading: false, user: null });
    }
  })();
}, []); // run once — the redirect guard keys off isLoading
```

`isLoading` must start `true` and gate the router guard, or the app flashes the login screen
on every cold start before the stored session is restored.

### 8.2 Browser flow (PKCE) for social / hosted login

```tsx
const redirectUri = AuthSession.makeRedirectUri({ scheme: '<scheme>', path: 'auth/callback' });

// Log this once — the exact string must appear in the Keycloak client's Valid
// redirect URIs, and in dev it is an exp://… proxy URL, not <scheme>://.
console.log('[Auth] OAuth redirect_uri =', redirectUri);

const discovery: AuthSession.DiscoveryDocument = {
  authorizationEndpoint: keycloakConfig.authorizationEndpoint,
  tokenEndpoint: keycloakConfig.tokenEndpoint,
  endSessionEndpoint: keycloakConfig.endSessionEndpoint,
};

const [googleRequest, , promptGoogleAsync] = AuthSession.useAuthRequest(
  {
    clientId: keycloakConfig.clientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
    extraParams: { kc_idp_hint: 'google' }, // skip Keycloak's page, jump straight to Google
  },
  discovery
);
```

Factor the prompt → exchange → load-user sequence into one reusable driver (a second IdP or a
hosted-login button then costs three lines):

```tsx
const runBrowserAuth = useCallback(async (request, promptAsync): Promise<AuthResult> => {
  if (!request) return { success: false, error: 'Authentication is not available yet.' };
  try {
    const result = await promptAsync();
    if (result.type === 'success' && result.params.code && request.codeVerifier) {
      const tokenResult = await exchangeAuthorizationCode(
        result.params.code, request.codeVerifier, redirectUri
      );
      if (tokenResult.success) {
        const userInfo = await fetchUserInfo();
        setState({ isAuthenticated: true, isLoading: false, user: userInfo });
        prefetch<Entity>(userInfo?.sub);
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
}, [redirectUri, prefetch<Entity>]);
```

Screens must treat *cancelled* as not-an-error (don't show a red banner when the user
dismisses the browser):

```tsx
const wasCancelled = (error?: string) => !!error && error.toLowerCase().includes('cancel');
```

### 8.3 Warm the entity cache at login

Prefetching on the auth transition means every screen that reads the profile already has it:

```tsx
const prefetch<Entity> = useCallback((sub?: string | null) => {
  if (sub) queryClient.prefetchQuery(<entity>QueryOptions(sub));
}, [queryClient]);
```

### 8.4 `reloadUser(overrides?)`

After a profile update the backend has changed the Keycloak user, so re-fetch `userinfo`.
Claims Keycloak does **not** return (custom attributes like `phoneNumber`, unless explicitly
mapped into the token) are patched in optimistically:

```tsx
const reloadUser = useCallback(async (overrides?: Partial<KeycloakUserInfo>) => {
  const refreshed = await fetchUserInfo();
  setState((prev) => {
    const base = refreshed ?? prev.user;
    return base ? { ...prev, user: { ...base, ...overrides } } : prev;
  });
}, []);
```

### 8.5 Logout must wipe *all* per-account state

Tokens alone are not enough — persisted Zustand stores and the query cache outlive them and
would leak one user's data into the next session:

```tsx
const logoutFn = useCallback(async () => {
  await keycloakLogout();
  use<Entity>Store.getState().clear();
  useOtherPerAccountStore.getState().clear();
  queryClient.clear();
  setState({ isAuthenticated: false, isLoading: false, user: null });
}, [queryClient]);
```

### 8.6 Optional dev bypass

A single `const BYPASS_AUTH = false` flag that short-circuits bootstrap to a mock guest user is
useful while the backend/Keycloak is unavailable. Keep it **one constant, clearly commented**,
and verify it is `false` before shipping — a stale `true` silently disables all auth.

---

## 9. Router guard (expo-router)

```tsx
function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;                       // wait for session restore

    const inAuthGroup = ['login', 'signup', 'verification'].includes(segments[0]);
    // Post-sign-up onboarding runs BEFORE the user has a session — do not bounce it.
    const inOnboarding = ['location', 'map-select', 'address-info'].includes(segments[0]);

    if (isAuthenticated && inAuthGroup) router.replace('/(tabs)');
    else if (!isAuthenticated && !inAuthGroup && !inOnboarding) router.replace('/login');
  }, [isAuthenticated, isLoading, segments]);
  /* …<Stack/>… */
}
```

Provider nesting order in the root layout matters — `AuthProvider` uses `useQueryClient`:

```tsx
<GestureHandlerRootView>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  </QueryClientProvider>
</GestureHandlerRootView>
```

---

## 10. Entity hooks (`hooks/use-<entity>.ts`)

Share one `queryOptions` factory between the hook and the imperative prefetch so both resolve
to the *same* cache entry and the same 404-as-null behaviour:

```ts
export function <entity>QueryOptions(keycloakUserId: string | null | undefined) {
  return {
    queryKey: <entity>Keys.detail(keycloakUserId ?? ''),
    queryFn: async (): Promise<<Entity> | null> => {
      try {
        return await get<Entity>ByAccount(keycloakUserId!);
      } catch (error) {
        if (isApiError(error, 404)) return null;  // account exists, entity doesn't (social sign-in)
        throw error;
      }
    },
    enabled: !!keycloakUserId,
    staleTime: 5 * 60 * 1000,
  };
}

export function use<Entity>(id: string | null | undefined) { return useQuery(<entity>QueryOptions(id)); }
```

Registration mutation — seed the cache and persist the ids for the pre-login onboarding gap:

```ts
export function useRegister<Entity>() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (r: <Entity>Registration) => register<Entity>(r),
    onSuccess: (entity) => {
      if (entity.keycloakUserId) {
        use<Entity>Store.getState().setAccount({
          keycloakUserId: entity.keycloakUserId,
          <entity>Id: entity.id,
        });
        queryClient.setQueryData(<entity>Keys.detail(entity.keycloakUserId), entity);
      }
    },
  });
}
```

Query-key factory (hierarchical, so one `invalidateQueries({ queryKey: <entity>Keys.all })`
reaches every derived key):

```ts
export const <entity>Keys = {
  all: ['<entities>'] as const,
  details: () => [...<entity>Keys.all, 'detail'] as const,
  detail: (keycloakUserId: string) => [...<entity>Keys.details(), keycloakUserId] as const,
};
```

---

## 11. The pre-login onboarding gap (important, easy to miss)

Typical flow: **sign up → collect address/preferences → log in**. Between registration and the
first login there is **no token**, so `user.sub` is unavailable — but the screens still need to
write to the backend entity.

Solution: a small persisted store holding the ids returned by registration, and a uniform
resolution order in every screen.

```ts
// store/<entity>-store.ts
export const use<Entity>Store = create<AccountState>()(
  persist(
    (set) => ({
      keycloakUserId: null,
      <entity>Id: null,
      setAccount: ({ keycloakUserId, <entity>Id }) => set({ keycloakUserId, <entity>Id }),
      clear: () => set({ keycloakUserId: null, <entity>Id: null }),
    }),
    { name: '<app>-<entity>-account', storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

```ts
// Everywhere an id is needed: prefer the live session, fall back to the registration echo.
const pendingId = use<Entity>Store((s) => s.keycloakUserId);
const keycloakUserId = user?.sub ?? pendingId;
```

Two consequences to honour:
- The router guard must whitelist the onboarding routes (§9).
- The backend must accept those writes; either keep the relevant endpoint unauthenticated for
  the onboarding window, or (better) log the user in immediately after registration and drop
  the gap entirely.

---

## 12. Keycloak realm configuration checklist

Have the operator (or do it yourself in the Admin Console) configure:

**Realm → Login:** User registration `On` (only if using the hosted register page),
Forgot password `On`, Email as username `On`, Login with email `On`, Verify email `On` (prod),
Duplicate emails `Off`. **Realm → General → Require SSL:** `all requests` in production.

**Realm → Email:** SMTP host/port/from + credentials — required for verify-email and
forgot-password to send anything.

**Clients → Create client** (the app's public client):

| Field | Value | Why |
|---|---|---|
| Client type | OpenID Connect | |
| Client ID | `<client-id>` | must equal `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID` |
| Client authentication | **Off** (public) | a mobile bundle cannot keep a secret |
| Standard flow | **On** | Authorization Code + PKCE (social / hosted login) |
| Direct access grants | On **only if** using a native password form | see the ROPC note below |
| Implicit flow | Off | deprecated, token-in-URL |
| Service accounts | Off | that belongs to the **backend** client |
| Valid redirect URIs | `<scheme>://auth/callback` **+** the `exp://…` dev URL | must byte-match |
| Valid post-logout redirect URIs | `<scheme>://auth/callback` | |
| Web origins | `+` | echo allowed redirect origins |
| Advanced → PKCE Code Challenge Method | **`S256`** | forces PKCE server-side |

**Sessions/Tokens:** access token ~5 min, SSO idle 30 min–hours, SSO max 8–24 h, and enable
**Revoke Refresh Token** (rotation) — the client already persists rotated refresh tokens.

**A second, confidential client** for the backend: Client authentication `On`,
Service accounts `On`, role `realm-management → manage-users`. Its secret lives in the backend
config only.

> ⚠️ **ROPC (`grant_type=password`) trade-off.** A native email/password form requires Direct
> Access Grants and is deprecated by the OAuth 2.0 Security BCP / OAuth 2.1: it bypasses MFA,
> IdP brokering and bot detection, and the app handles raw credentials. If the product allows,
> use the same browser flow with **no** `kc_idp_hint` (Keycloak renders its hosted login page
> listing social buttons) and turn Direct Access Grants **Off**.

### Social login (Google) — two redirect hops, the usual source of confusion

```
App ──(1)──► Keycloak ──(2)──► Google ──(2 back)──► Keycloak ──(1 back)──► App
            /auth              broker login         /broker/google/endpoint  <scheme>://
```

- **Hop 1** (App ↔ Keycloak) uses `<scheme>://auth/callback` — configured on the **Keycloak client**.
- **Hop 2** (Keycloak ↔ Google) uses Keycloak's broker endpoint
  `https://<keycloak-host>/realms/<realm>/broker/google/endpoint` — configured in **Google Cloud
  Console** as an *Authorized redirect URI*, on a **Web application** OAuth client (not Android/iOS).
  Google never sees `<scheme>://`.
- Google requires **HTTPS** for that URI (except `http://localhost`). A LAN IP is rejected — use
  `localhost` or an HTTPS tunnel in dev.
- In Keycloak: **Identity providers → Google**, paste client id/secret, `Trust Email = On`,
  scopes `openid profile email`. Add mappers if you want `given_name`/`family_name` to populate.

### Custom attributes (e.g. phone number)

Either **Realm settings → User profile → Create attribute** (`phoneNumber`), and/or
**Client scopes → dedicated scope → Mappers → User Attribute** to project it into the ID /
userinfo claims. Without the mapper, `fetchUserInfo()` will never return it — which is exactly
why `reloadUser(overrides)` exists.

---

## 13. Verification checklist

Run through all of these on a **physical device**, not just the simulator:

- [ ] `GET {KEYCLOAK_URL}/realms/<realm>/.well-known/openid-configuration` returns the four
      endpoints and is reachable **from the phone's browser**.
- [ ] Sign up → one `POST /<entities>` → Keycloak user *and* entity row both exist, with
      `keycloakUserId == sub`.
- [ ] Log in with the new credentials → tokens land in SecureStore.
- [ ] Kill and relaunch the app → still signed in, no login-screen flash.
- [ ] Let the access token expire (or shorten its lifespan to 1 min) → next API call refreshes
      silently and succeeds.
- [ ] Revoke the session in the Keycloak console → next refresh fails → app returns to login.
- [ ] Social login → returns to the app signed in; check the logged `redirect_uri` matches the
      client config exactly.
- [ ] Profile update → `PUT /<entities>` → change is visible in both the DB and the Keycloak
      user, and in the app after `reloadUser`.
- [ ] Log out → SecureStore empty, query cache cleared, persisted stores cleared; "Continue with
      Google" now shows the account picker (proves `id_token_hint` worked).
- [ ] Point the app at an unreachable IP → login fails with the timeout message in ≤15 s
      instead of hanging.
- [ ] `grep -r "ADMIN" .env* services/` finds nothing — no admin credentials in the bundle.

---

## 14. Failure modes and their causes

| Symptom | Cause / fix |
|---|---|
| Login button spins forever | No fetch timeout, or Keycloak URL unreachable from the device (§5.1). |
| `Invalid parameter: redirect_uri` | The logged `redirect_uri` is not in the client's Valid redirect URIs. In Expo Go it is `exp://…`, not `<scheme>://` — add both. |
| Browser returns but the app is not signed in | Same as above, or `code_verifier` lost because the `AuthRequest` was recreated; drive it through one `runBrowserAuth` (§8.2). |
| `redirect_uri_mismatch` **from Google** | Google's authorized URI ≠ Keycloak's broker endpoint. Copy it verbatim from the Keycloak provider page. |
| Google rejects the URI on save | Not HTTPS / LAN IP. Use `localhost` or a tunnel. |
| Lands on Keycloak's page instead of Google | `kc_idp_hint` missing, or the provider alias isn't `google`. |
| 400 from `/token` with no detail | Body sent as JSON instead of `x-www-form-urlencoded`. |
| Works once, then every refresh 400s | Refresh-token rotation on, but the rotated token isn't persisted. |
| Login screen flashes on every cold start | Router guard doesn't wait for `isLoading`. |
| Previous user's data after switching accounts | `queryClient.clear()` / persisted-store `clear()` missing from logout (§8.5). |
| `sub` is `undefined` during onboarding | Reading `user.sub` with no session — fall back to the persisted registration store (§11). |
| Profile field never updates in the UI | Custom attribute not mapped into userinfo claims — map it, or pass it via `reloadUser(overrides)`. |
| 404 on the by-account lookup for social users | Expected: the Keycloak account has no entity yet. Treat as `null` and prompt to complete the profile. |

---

## 15. Security invariants — do not regress these

1. No Keycloak admin or service-account credentials in the app, in `.env`, or in any
   `EXPO_PUBLIC_*` var. All `EXPO_PUBLIC_*` values ship in plaintext.
2. Tokens in `SecureStore` on native. `localStorage` on web is a known compromise — call it out.
3. PKCE `S256` enforced **server-side** on the client, not just requested by the app.
4. HTTPS everywhere in production (`Require SSL = all requests`).
5. The backend authorizes `PUT` by comparing the token's `sub` to the target record.
6. Logout always clears local tokens, even when the network call fails.
7. Prefer the browser Authorization Code flow over ROPC; if ROPC ships, document it as debt.
