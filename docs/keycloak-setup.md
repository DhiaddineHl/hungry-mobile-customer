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

> **Expo dev caveat:** in Expo Go / dev client the redirect can be an `exp://…` proxy URL
> instead of the custom scheme. During development add the exact URI that
> `AuthSession.makeRedirectUri(...)` logs (e.g. `exp://192.168.x.x:8081/--/auth/callback`) as
> an additional **Valid redirect URI**. Standalone/EAS builds use `hungrycustomer://auth/callback`.

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

- **Hop 1** (App ↔ Keycloak): redirect URI `hungrycustomer://auth/callback` (or the `exp://…`
  dev URL). Configured on the **client** in §4.
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
  **PKCE = S256**, and the redirect URIs include `hungrycustomer://auth/callback` (plus the
  `exp://…` dev URL).
- To show a **single page with both** email/password and a Google button instead of jumping
  straight to Google, remove the `kc_idp_hint` extra param — Keycloak then renders its hosted
  login page (which lists Google as a social button).

### 6.4 Test & troubleshoot

| Symptom | Likely cause / fix |
|---------|--------------------|
| `redirect_uri_mismatch` from Google | Google's Authorized redirect URI ≠ Keycloak broker endpoint. Copy it verbatim from the Keycloak provider page (§6.2.4). |
| Google rejects the URI on save | Not HTTPS / using a LAN IP. Use `localhost` or an HTTPS tunnel (§6.1 warning). |
| `Access blocked: app not verified` / only some accounts work | Consent screen still in **Testing** — add the account under **Test users**, or publish. |
| Browser returns to app but not logged in | App-side redirect (`hungrycustomer://auth/callback` / `exp://…`) missing from the **client's** Valid redirect URIs (§4). |
| Lands on Keycloak login page instead of Google | `kc_idp_hint` not sent, or the provider alias isn't `google`. |

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
put non-secret config here):

```dotenv
EXPO_PUBLIC_KEYCLOAK_URL=https://auth.yourdomain.com   # https in prod
EXPO_PUBLIC_KEYCLOAK_REALM=hungry
EXPO_PUBLIC_KEYCLOAK_CLIENT_ID=hungry-customer-app
```

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
