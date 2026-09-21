# Keycloak Back-Office Configuration Guide — Hungry Customer App

This guide configures a Keycloak realm + client for the **Hungry Customer** mobile app
(Expo / React Native) using the **OAuth 2.0 Authorization Code flow with PKCE** — the flow
recommended by the [Keycloak JavaScript adapter docs](https://www.keycloak.org/securing-apps/javascript-adapter)
for public (browser / native) clients.

> **Why Authorization Code + PKCE and not the password grant?**
> The current app code signs users in with `grant_type=password` (Resource Owner Password
> Credentials) and registers them with **admin credentials embedded in the app bundle**.
> Both are insecure (see `docs/keycloak-setup.md` § "Migration notes" at the bottom). This
> guide configures Keycloak so the app can move to the browser-based Authorization Code flow,
> where Keycloak hosts the login, registration, MFA and password-reset pages itself.

---

## 0. Prerequisites

- A running Keycloak server (v22+; tested wording matches the **new Admin Console**).
- Admin access to the **master** realm.
- The app's deep-link scheme. From `app.json`: **`hungrycustomer`** → redirect URI
  `hungrycustomer://auth/callback`.

For production, Keycloak **must** be served over **HTTPS** with a real certificate.
Plain `http://<lan-ip>:8081` is acceptable only for local development.

---

## 1. Create the realm

1. Open the Admin Console → realm dropdown (top-left) → **Create realm**.
2. **Realm name:** `hungry`  (must match `EXPO_PUBLIC_KEYCLOAK_REALM`).
3. **Enabled:** On → **Create**.

---

## 2. Realm-level login settings

**Realm settings → Login** tab. Enable the self-service features so the app never needs
admin rights to create users:

| Setting                  | Value | Why |
|--------------------------|-------|-----|
| User registration        | **On** | Lets users self-register on Keycloak's hosted page (replaces the admin-API registration). |
| Forgot password          | **On** | Enables the "Forgot Password" link the login screen already shows. |
| Remember me              | On (optional) | Longer-lived SSO session. |
| Email as username        | **On** | App identifies users by email. |
| Login with email         | **On** | Allow email in the username field. |
| Verify email             | **On** (prod) | Forces real email verification instead of the app's mocked OTP screen. |
| Duplicate emails         | Off | Keep emails unique. |

**Realm settings → General → Require SSL:** `external requests` for dev, **`all requests`**
for production.

---

## 3. Configure SMTP (needed for Verify email / Forgot password)

**Realm settings → Email** tab. Fill in your SMTP host, port, from-address, and credentials,
then **Test connection**. Without this, "Verify email" and "Forgot password" cannot send mail.

---

## 4. Create the app client

**Clients → Create client.**

### General settings
| Field | Value |
|-------|-------|
| Client type | **OpenID Connect** |
| Client ID | **`hungry-customer-app`** (must equal `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID`) |
| Name | Hungry Customer App |

> Pick **one** client id and use it everywhere. The repo currently disagrees with itself:
> `config.ts` defaults to `hungry-customer-app` while `.env` says `hungry-frontend`. This
> guide standardizes on **`hungry-customer-app`** — update `.env` to match.

### Capability config
| Field | Value | Why |
|-------|-------|-----|
| **Client authentication** | **Off** (→ *public* client) | Mobile apps can't keep a secret; the app bundle is not confidential. |
| **Authorization** | Off | Not using Keycloak Authorization Services. |
| **Standard flow** | **On** | Enables Authorization Code flow (used by Google login + browser registration). |
| **Direct access grants** | **On** ⚠️ | **Required by the current app**, which keeps a native email/password login form (ROPC). See the warning below. The most-secure setup turns this **Off** and moves email/password login to the hosted page too. |
| **Implicit flow** | Off | Deprecated / token-in-URL. |
| **Service accounts** | Off | Not a backend client. |

> ⚠️ **ROPC trade-off.** The app currently signs in with `grant_type=password`
> (native form → token endpoint), which needs **Direct Access Grants = On**. This grant is
> deprecated by the OAuth 2.0 Security BCP / OAuth 2.1 and bypasses MFA, IdP brokering and
> bot detection. Registration and Google login already use the secure Authorization Code +
> PKCE browser flow. To fully harden the app, switch email/password login to the same browser
> flow and set Direct Access Grants back to **Off**.

### Login settings (redirect URIs & origins)
Be **as specific as possible** — wildcards on a public client are a security risk.

| Field | Value |
|-------|-------|
| **Root URL** | *(leave blank for native)* |
| **Valid redirect URIs** | `hungrycustomer://auth/callback` |
| **Valid post-logout redirect URIs** | `hungrycustomer://auth/callback`  (or a dedicated `hungrycustomer://auth/logout`) |
| **Web origins** | `+` (echo allowed redirect origins) — or the exact web origin if you ship a web build |

> **Expo dev caveat — do NOT register a dev URL here.** `makeRedirectUri` only honours the
> `scheme` option when it is also given `native`; without it, it falls through to
> `Linking.createURL`, which splices `Constants.expoConfig.hostUri` (the **Metro dev-server
> host**) into the URL and yields `hungrycustomer://localhost:8081/auth/callback`. The app
> therefore passes `native: 'hungrycustomer://auth/callback'` explicitly
> (`contexts/auth-context.tsx`), so dev builds and release builds send the **same** redirect
> URI and the single entry above is all Keycloak ever needs. Expo Go cannot be used for Google
> login at all — it ignores custom schemes. Confirm with the `[Auth] OAuth redirect_uri = …`
> log line on startup.

### Advanced → enforce PKCE
**Clients → hungry-customer-app → Advanced → Advanced settings:**
- **Proof Key for Code Exchange Code Challenge Method:** **`S256`**

This forces every authorization request to use PKCE-SHA256. The app already sends
`usePKCE: true`, and setting it here makes Keycloak reject any request that doesn't.

---

## 5. Token & session lifetimes

**Realm settings → Sessions** and **→ Tokens**. Sensible mobile defaults:

| Setting | Suggested value | Notes |
|---------|-----------------|-------|
| Access Token Lifespan | **5 min** | Short-lived; app refreshes silently. Keep short since SSO logout detection is limited on mobile. |
| SSO Session Idle | 30 min – a few hours | Idle timeout. |
| SSO Session Max | 8–24 h | Absolute cap; forces periodic re-login. |
| Refresh token reuse | Revoke on use (enable **Revoke Refresh Token** under Tokens) | Rotation: detects stolen refresh tokens. |

> If you enable **Revoke Refresh Token** (rotation), make sure the app always persists the
> **new** refresh token returned by each refresh call. The current `refreshAccessToken()`
> already does this via `saveTokens`.

---

## 6. Google social login ("Continue with Google")

The app's `loginWithGoogle()` opens the system browser, and Keycloak **brokers** the login to
Google. There are **two redirect hops**, and most setup problems come from mixing them up:

```
App ──(1)──► Keycloak ──(2)──► Google ──(2 back)──► Keycloak ──(1 back)──► App
            authorize         broker login          broker endpoint        hungrycustomer://
```

- **Hop 1** (App ↔ Keycloak): redirect URI `hungrycustomer://auth/callback`. Configured on the
  **client** in §4. In dev this hop also depends on `KC_HOSTNAME` — see §6.3.1.
- **Hop 2** (Keycloak ↔ Google): redirect URI is Keycloak's **broker endpoint**. Configured in
  **Google Cloud Console** and must be HTTPS-reachable by the user's browser.

Google **never** sees the `hungrycustomer://` scheme — it only talks to Keycloak.

### 6.1 Google Cloud Console

1. Go to <https://console.cloud.google.com/> → create (or select) a project.
2. **APIs & Services → OAuth consent screen:**
   - User type **External**, fill app name, support email, developer email.
   - Scopes: add `openid`, `email`, `profile`.
   - While in **Testing**, add your Google account under **Test users** (only listed users can
     sign in until you publish the consent screen).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID:**
   - Application type: **Web application** (Keycloak is the OAuth client here, *not* the phone —
     so it is a web/confidential client, **not** "Android"/"iOS").
   - **Authorized redirect URIs** → add Keycloak's broker endpoint exactly:
     ```
     https://<keycloak-host>/realms/hungry/broker/google/endpoint
     ```
   - Create, then copy the **Client ID** and **Client secret**.

> ⚠️ Google requires the redirect URI to be **HTTPS** (except `http://localhost`). A LAN IP like
> `http://172.29.80.1:8081/...` will be rejected. For dev, either run Keycloak on `localhost`
> with HTTPS, or use a tunnel (ngrok/Cloudflare) and register that HTTPS URL as the broker
> redirect. In production Keycloak must be HTTPS anyway.

### 6.2 Keycloak — add the Google identity provider

1. **Identity providers → Add provider → Google.**
2. Paste the **Client ID** and **Client Secret** from Google.
3. Recommended settings:
   | Setting | Value | Why |
   |---------|-------|-----|
   | **Enabled** | On | |
   | **Trust Email** | On | Google verifies email; avoids a second verification step. |
   | **Store Tokens** | Off (On only if you call Google APIs) | Less to store. |
   | **Sync Mode** | `Import` (or `Force` to re-sync on every login) | How profile fields update. |
   | **Default Scopes** | `openid profile email` | Matches what the app requests. |
4. The **Redirect URI** shown at the top of this provider page is the exact value that must be
   in Google's Authorized redirect URIs — copy it from here to be safe (it ends in
   `/broker/google/endpoint`).
5. (Optional) **Identity provider → Mappers → Add mapper** to copy Google claims into the
   Keycloak user — e.g. `given_name` → first name, `family_name` → last name. These then flow
   into the app via `fetchUserInfo`.

### 6.3 Mobile app — already wired

No code changes are needed; for reference, the relevant pieces:

- `contexts/auth-context.tsx` builds the auth request with **PKCE** and
  `extraParams: { kc_idp_hint: 'google' }`. The `kc_idp_hint` makes Keycloak skip its own login
  page and jump **straight to Google**. The shared `runBrowserAuth()` then exchanges the
  returned code for tokens.
- Requirements on the Keycloak **client** (§4) for this to work: **Standard flow = On**,
  **PKCE = S256**, and the redirect URIs include `hungrycustomer://auth/callback` — the same
  value in dev and release builds, see the §4 caveat.
- To show a **single page with both** email/password and a Google button instead of jumping
  straight to Google, remove the `kc_idp_hint` extra param — Keycloak then renders its hosted
  login page (which lists Google as a social button).

#### What happens after the token exchange

A Google sign-in never sees the e-mail verification screen, and only stops for a form on its
**first** sign-in. The root navigator (`app/_layout.tsx`) decides, in this order:

```
tokens in hand
  ├─ verification gate ....... SKIPPED for Google (see below)
  ├─ customer record?
  │    ├─ exists  ─────────────► straight into the app (or /location if it has no address)
  │    └─ none (404) ─────────► /complete-profile ──► /map-select ──► /address-info ──► tabs
```

- **No verification screen.** Keycloak marks a brokered account's e-mail unverified unless the
  Google IdP has **Trust Email = On** (§6.2), and the app used to route on that claim alone —
  which sent every Google user to a code screen for a code that was never mailed. The session's
  origin is now recorded at token-exchange time (`saveAuthMethod('google')` in
  `services/keycloak/auth-service.ts`, persisted beside the tokens so it survives a restart)
  and the gate is skipped for it. Turning **Trust Email** on is still the right setting; the
  app simply no longer depends on it.
- **`/complete-profile` creates the customer record.** Keycloak provisions the account itself
  when brokering, so nothing ever called `POST /customers` for it and a lookup answers 404.
  The screen asks for first name, last name and phone — pre-filling the name from the
  `given_name`/`family_name` claims (falling back to splitting `name`) — and creates the record
  through `POST /customers/me`. A phone number is always asked for: it is never in an OIDC
  token. There is no password field, because the account has none.
- **The record is not created before that form.** An earlier version created an empty record
  right after login, which satisfied the "has a record" test with a nameless, phoneless
  customer and left no later moment to ask. `resolveCustomerForAccount` now only reads.
- **Then straight to the map.** `/location` is skipped — it exists to ask for the location
  permission, which `/map-select` requests itself — so the user lands on the picker and
  continues through the normal address onboarding.

> Getting a Google account back to the first-run state for testing means deleting **both** the
> Keycloak user and its customer record. Deleting only the Keycloak user leaves an orphaned
> record that the next sign-in will not match; deleting only the record sends the account back
> through `/complete-profile`, which is the useful half of the reset.

### 6.3.1 `KC_HOSTNAME=localhost` and the emulator (dev only)

Keycloak runs with `KC_HOSTNAME=http://localhost:8081`. That setting does **not** only affect
the token issuer (§9) — it makes Keycloak stamp `localhost` into **every absolute URL it
generates**, including the `/realms/hungry/broker/google/login` redirect in hop 1. So even if
the app calls Keycloak on the LAN IP, Keycloak answers with a redirect to
`http://localhost:8081/...`, and the phone/emulator browser dies there with
*"localhost refused to connect"*.

Password login is unaffected — it is a single `POST` to the token endpoint with no redirects.
**Only the browser-based flows (Google, hosted registration) break.** That is the tell.

Do **not** "fix" this by pointing `KC_HOSTNAME` at the LAN IP. It breaks two other things:
1. Google rejects non-HTTPS redirect URIs except `http://localhost` (§6.1) — hop 2 would stop
   working. `localhost` is what makes plain HTTP acceptable to Google in dev.
2. The issuer would no longer match `KEYCLOAK_ISSUER_URI` on the gateway and hungry-app (§9).

Instead, make the emulator's own `localhost:8081` reach Keycloak on the host:

```bash
adb reverse tcp:8081 tcp:8081
# Windows: %LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe reverse tcp:8081 tcp:8081
adb reverse --list   # verify; Metro's own tunnel is listed here too
```

and point the app at the same host, so the browser flow starts and ends on one origin:

```bash
EXPO_PUBLIC_KEYCLOAK_URL=http://localhost:8081
```

Both halves are required. If the app starts the flow on `192.168.x.x:8081` while Keycloak
redirects to `localhost:8081`, the Keycloak session cookie is set on the wrong origin, is not
sent on the next hop, and the login fails a step later with no useful error.

> `EXPO_PUBLIC_*` values are inlined at **bundle** time — restart with `npx expo start -c`
> after editing `.env`, a hot reload will not pick it up.

> **Caveats.** `adb reverse` is per-device and does not survive an emulator restart or
> `adb kill-server` — re-run it if Google login suddenly returns to the dead localhost page.
> It also only works on an emulator or a USB-attached device. `EXPO_PUBLIC_API_URL` stays on
> the LAN IP; only Keycloak needs this treatment, because only Keycloak redirects the browser.
>
> **On a physical device over Wi-Fi** there is no tunnel and no way to satisfy both Google and
> the emulator with `localhost`. Put Keycloak behind an HTTPS tunnel (ngrok / Cloudflare), set
> `KC_HOSTNAME` to that HTTPS URL, register it as the broker redirect in Google (§6.1), and
> update `KEYCLOAK_ISSUER_URI` on the gateway and hungry-app to match (§9).

### 6.4 Test & troubleshoot

| Symptom | Likely cause / fix |
|---------|--------------------|
| `redirect_uri_mismatch` from Google | Google's Authorized redirect URI ≠ Keycloak broker endpoint. Copy it verbatim from the Keycloak provider page (§6.2.4). |
| Google rejects the URI on save | Not HTTPS / using a LAN IP. Use `localhost` or an HTTPS tunnel (§6.1 warning). |
| `Access blocked: app not verified` / only some accounts work | Consent screen still in **Testing** — add the account under **Test users**, or publish. |
| Browser returns to app but not logged in | App-side redirect `hungrycustomer://auth/callback` missing from the **client's** Valid redirect URIs (§4). |
| **"localhost refused to connect"** on `…/broker/google/login` | `KC_HOSTNAME=localhost` and nothing is listening on the device's `localhost:8081`. Run `adb reverse tcp:8081 tcp:8081` and set `EXPO_PUBLIC_KEYCLOAK_URL=http://localhost:8081` (§6.3.1). |
| Redirect URI contains a host, e.g. `hungrycustomer://localhost:8081/auth/callback` | `makeRedirectUri` was called without `native`, so Metro's dev-server host leaked in (§4 caveat). |
| Google login worked, then broke after an emulator restart | `adb reverse` does not persist — re-run it (§6.3.1). |
| Lands on Keycloak login page instead of Google | `kc_idp_hint` not sent, or the provider alias isn't `google`. |
| Google login lands on the **verification** screen | Stale build: the session's origin is recorded at token exchange, so re-login after updating. Setting **Trust Email = On** (§6.2) fixes the underlying `email_verified` claim too. |
| Google login lands on **/complete-profile** every time | The record is not being created — check `POST /customers/me` in the Metro network log; a 4xx there leaves the lookup at 404 and the router sends the user straight back. |
| Google user reaches the tabs with no name or phone | A customer record was created empty by an older build. Delete it so the account goes through `/complete-profile` again (§6.3). |

---

## 7. (Optional) Custom user attributes — phone number

Signup collects a phone number. With self-registration you have two options:

- **Simple:** add a `phoneNumber` attribute via **Realm settings → User profile → Create
  attribute** (name `phoneNumber`, display name "Phone number", optionally required). It then
  appears on the hosted registration form automatically.
- **Token claim:** **Client scopes → (dedicated scope) → Mappers → Add mapper → User Attribute**
  → map `phoneNumber` into the ID/userinfo token so the app can read it from `fetchUserInfo`.

---

## 8. Verify the configuration

The OIDC discovery document should list the endpoints the app uses:

```
GET http://<keycloak-host>:8081/realms/hungry/.well-known/openid-configuration
```

Confirm it returns `authorization_endpoint`, `token_endpoint`, `end_session_endpoint`,
`userinfo_endpoint` for realm `hungry`. These match `services/keycloak/config.ts`.

Quick manual smoke test of the browser flow (replace host):
```
http://<keycloak-host>:8081/realms/hungry/protocol/openid-connect/auth
  ?client_id=hungry-customer-app
  &redirect_uri=hungrycustomer://auth/callback
  &response_type=code
  &scope=openid%20profile%20email
  &code_challenge=<challenge>
  &code_challenge_method=S256
```
You should land on Keycloak's hosted login/registration page.

---

## 9. App environment variables

`.env` (note: `EXPO_PUBLIC_*` values are **embedded in the app bundle in plaintext** — only
put non-secret config here). See `.env.example` for the committed template:

```dotenv
EXPO_PUBLIC_KEYCLOAK_URL=https://auth.yourdomain.com   # https in prod
EXPO_PUBLIC_KEYCLOAK_REALM=hungry
EXPO_PUBLIC_KEYCLOAK_CLIENT_ID=hungry-customer-app

EXPO_PUBLIC_API_URL=http://<dev-machine-lan-ip>:8082   # the gateway, not hungry-app
```

### 9.1 The backend now sits behind the jfwk-gateway

The backend added a Spring Cloud Gateway edge (`jfwk-platform/jfwk-gateway`). The topology
the app must target is:

```
app ──► jfwk-gateway :8082 ──► hungry-app :8080 (internal network, no host port)
 └────► Keycloak :8081 (direct — the gateway has no /realms/** route)
```

- **`EXPO_PUBLIC_API_URL` must be the gateway (`:8082`).** The backend's `compose.yaml`
  deliberately publishes no host port for hungry-app, so `:8080` is simply unreachable
  from the device; the gateway is the only published application port.
- **`EXPO_PUBLIC_KEYCLOAK_URL` stays on `:8081`.** Login, refresh, userinfo and logout do
  not go through the gateway.
- **Every request now needs a token.** The gateway is an OAuth2 resource server and
  answers `401` before the request reaches hungry-app. The only endpoint this app calls
  unauthenticated is `POST /customers` (self-registration), which `GatewaySecurityConfig`
  explicitly permits. hungry-app then re-validates the same token
  (`hungry.security.enabled=true` in its dev profile too, since the gateway landed).
- **Issuer.** Keycloak runs with `KC_HOSTNAME=http://localhost:8081`, so it stamps
  `iss=http://localhost:8081/realms/hungry` into every token *regardless of the host the
  device used to log in* — which is exactly what the gateway and hungry-app are configured
  to trust. Reaching Keycloak over the LAN IP therefore works unchanged **for the direct
  password/refresh calls**; do not "fix" the issuer to the LAN IP without changing
  `KEYCLOAK_ISSUER_URI` on both services. The same setting *does* break the browser-based
  flows (Google, hosted registration), because Keycloak also puts `localhost` in the redirects
  it generates — see §6.3.1 for why the fix is `adb reverse`, not a new `KC_HOSTNAME`.
- **503 with `"hungry-app is currently unavailable"`** comes from the gateway's
  circuit-breaker fallback (4s time limiter), not from a bug in the app — it means
  hungry-app is down or slow to start.

**Delete** `EXPO_PUBLIC_KEYCLOAK_ADMIN_USERNAME` / `EXPO_PUBLIC_KEYCLOAK_ADMIN_PASSWORD` —
they must never ship in a client. The client id, realm and URL are public by design and are
safe to expose.

---

## Migration notes (app code status)

### ✅ Done
1. **Admin credentials removed from the app.** `getAdminToken` and the Admin-REST-API
   registration path were deleted from `auth-service.ts`. No `EXPO_PUBLIC_KEYCLOAK_ADMIN_*`
   vars are read anywhere.
2. **Registration moved to the backend.** `app/signup.tsx` keeps the native form and POSTs
   to the backend (`POST /customers`, see `services/api/customer-service.ts`), which
   provisions the Keycloak login account and the `Customer` entity atomically — the same
   sync flow the back-office uses for employees. The backend's `hungry-admin`
   service-account client holds the `manage-users` credentials, never the app.
3. **Profile updates moved to the backend.** Account settings sends one `PUT /customers`
   (resolved by `code` = the token's `sub`); the backend mirrors name/email/phone onto the
   Keycloak user in the same transaction, then the app refreshes `userinfo`.
4. **Logout hardened.** `logout()` now sends `id_token_hint` so the browser SSO session is
   terminated, not just the refresh token revoked.
5. **Config de-duplicated.** Single client id default `hungry-customer-app`; the dead admin
   `registrationEndpoint` was removed from `config.ts`.

### ⏳ Remaining / optional
1. **Retire the password grant (recommended).** `loginWithPassword` (ROPC) is still used by
   the native login form per product choice. To fully harden, replace it with the same browser
   flow as registration (no `kc_idp_hint`), then set **Direct Access Grants = Off** in Keycloak.
2. **Update `.env`** so `EXPO_PUBLIC_KEYCLOAK_CLIENT_ID` matches the realm client
   (`hungry-customer-app`).
3. **Wire real email verification** instead of the mocked `verification.tsx` screen, or remove
   the screen and rely on Keycloak's "Verify email" page.
4. **Web token storage:** if a web build is shipped, move tokens out of `localStorage`
   (in-memory, or httpOnly cookie via a backend). Native `SecureStore` is fine.
5. **Set `BYPASS_AUTH = false`** in `contexts/auth-context.tsx` — it is currently `true`, which
   boots a guest user and skips auth entirely. Nothing above runs until this is flipped.
