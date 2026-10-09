# Security & design review — hungry-customer (October 2026)

Branch: `audit/security-and-design` (cut from `redesign/09-cleanup` @ `0235d19`).
Scope: the whole customer app — auth, token handling, API/realtime clients,
persisted state, navigation guards, push, deep links, dependencies, build
config — plus a design pass of the shipped UI against the `frontend-design`
skill and the designer handoff (`design system/handoff/DESIGN_SYSTEM.md`).

**Method.** Security: a manual full-codebase review against the vulnerability
classes the `security-guidance` plugin checks (injection, XSS, SSRF, secrets,
IDOR, auth bypass, unsafe deserialization, path traversal), extended with the
mobile-specific ones (token storage and leakage, shared-device data, deep links,
backups, cleartext transport), plus `npm audit`. The plugin itself is
hook-driven (pattern checks on edits, LLM review at turn end and on
`git commit`), but its log (`~/.claude/security/log.txt`) shows it did **not**
fire during this review. Its earlier runs logged "LLM review disabled or no
API credentials". Re-enable it and let it review this branch's commits (see
the note at the end).
Design: the skill's quality floor (contrast, reduced motion, copy that explains
failures, no template leftovers) and its "generic tells", each checked against
the handoff spec first. Where the spec decides something, the spec wins.

Status legend: **Fixed** (on this branch) · **Backend** (needs a change in the
backend/gateway/Keycloak; the app can't fix it alone) · **Ops** (console or
config outside the repo) · **Designer** (needs a design decision) · **Accepted**
(intentional; no change).

---

## Summary

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| S-01 | Critical | Order history downloads **every customer's orders** and filters on the phone | Backend |
| S-02 | High | Access token sent to any host named by an absolute image URL | Fixed |
| S-03 | High | Shared device: previous account's cart is pushed into the next account's server cart; favourites, receipts and searches carry over | Fixed |
| S-04 | High | Realtime (STOMP) socket survives sign-out, still authenticated as the previous user | Fixed |
| S-05 | Medium | Parallel requests each refresh the token at once (refresh-token rotation race, random sign-outs) | Fixed |
| S-06 | Medium | `axios@1.18.1` — 12 advisories incl. prototype-pollution gadgets (fixed in 1.20.0) | Fixed |
| S-07 | Medium | Release builds can silently fall back to hard-coded cleartext `http://` LAN endpoints | Fixed (guard) / Ops (TLS) |
| S-08 | Medium | Raw server text and developer hints shown to users (`Request failed (500)`, "Check the Keycloak URL") | Fixed |
| S-09 | Medium | Password policy: 6 characters minimum | Fixed (app) / Ops (realm) |
| S-10 | Medium | Android `allowBackup` on — AsyncStorage (orders, addresses, notifications) goes into cloud/adb backups | Fixed |
| S-11 | Medium | Google Maps key used from the client for Places web-service calls; can't be app-restricted | Ops / Backend |
| S-12 | Low | Push-tap payload `orderId` spliced into a route without validation | Fixed |
| S-13 | Low | `/dev/design-system` reachable by deep link in release builds | Fixed |
| S-14 | Low | `BYPASS_AUTH` switch could ship in a release build | Fixed |
| S-15 | Low | Debug logging in release (redirect URI on every render, Keycloak error bodies) | Fixed |
| S-16 | Low | Token expiry checked with no clock-skew margin | Fixed |
| S-17 | Info | Server-side controls the app relies on (verification gate, topic auth, enumeration, ROPC) | Backend |
| S-18 | Info | Secrets hygiene — admin SDK key on disk, `google-services.json` committed | Accepted / Ops |
| D-01 | High | App icon and splash are still the Expo template placeholders | Fixed (splash) / Designer (icon) |
| D-02 | Medium | Error copy is vague ("Something went wrong.") or written for developers | Fixed |
| D-03 | Medium | Light-only theme, but the app declares `automatic` and a black dark-mode splash | Fixed |
| D-04 | Low | Notification accent `#F5A623` and adaptive-icon `#E6F4FE` are off-palette | Fixed |
| D-05 | Low | Version caption uses `inkSubtle` (≈2.9:1), which the spec reserves for placeholders | Fixed |
| D-06 | Info | Uppercase overlines, middle-dot meta, mono coordinates — skill "tells", but spec-mandated | Accepted |
| D-07 | Info | Things already right: reduced motion, font-scale caps, 44pt targets, tabular numerals | — |

---

## Security findings

### S-01 · Critical · Order history exposes every customer's orders — Backend

`services/api/order-service.ts` → `fetchCustomerOrders` pages through
`GET /orders/all` and keeps `order.customerId === customerId` **on the
device**. So the gateway is serving every customer's orders (names, delivery
addresses, phone numbers, contents, totals) to any signed-in customer token.
Anyone with a proxy sees them all, and the client-side filter protects nothing.

**Fix (backend).** Add `GET /orders/mine` (or force `customerId` from the
token's `sub` on `/orders/all` for the customer role). Return 403 on
`GET /orders/{id}` and `/orders/{id}/delivery[/location]` when the order isn't
the caller's. Then point `fetchCustomerOrders` at the scoped endpoint and drop
the client-side filter. Until the backend changes, the app can't fix this:
the data is already in the response.

### S-02 · High · Access token leaks to third-party image hosts — Fixed

`hooks/use-restaurant-image.ts` attached `Authorization: Bearer …` to every
image source, and `resolveImageUrl` passes **absolute** URLs straight through.
Any `logoUrl`/`coverImageUrl` naming another host — one restaurant-editable
field is enough — would collect customers' live access tokens.

*Fix:* `imageAuthHeaders(url)` only returns the header when the URL's origin
is the API origin. Other images load without credentials.

### S-03 · High · Cross-account data on a shared device — Fixed

Plain sign-out kept the cart (including `remote.cartId`), favourites, receipt
snapshots, recent searches and the payment choice. On a shared phone, account
B then saw A's favourites and searches, and `useCartSync` **pushed A's cart
lines into B's server cart**.

*Fix:* `services/session/account-owner.ts` records which account the
device-local data belongs to. When a session starts for a *different* account,
that data is wiped before anything syncs. Same-account re-login still keeps it,
which was the reason it survives sign-out.

### S-04 · High · STOMP connection outlives the session — Fixed

`services/realtime/stomp-client.ts` kept one module-level client with no
teardown. After sign-out it stayed connected (and auto-reconnected) with the
previous user's CONNECT credentials, and the next user's subscriptions rode on
that session.

*Fix:* `disconnectRealtime()` deactivates the client and drops registrations.
It runs from `clearSession` on sign-out and account deletion.

### S-05 · Medium · Token-refresh stampede — Fixed

The axios interceptor, the STOMP `beforeConnect` and `fetchUserInfo` each
called `refreshAccessToken()` on their own. A screen firing five queries with an
expired token sent five refreshes with the same refresh token. With Keycloak's
"Revoke refresh token" on, every refresh after the first fails, and the failure
path calls `clearTokens()`, so the user is randomly signed out.

*Fix:* `refreshAccessToken` is single-flight. Concurrent callers share one
in-flight promise.

### S-06 · Medium · Vulnerable `axios` — Fixed

`npm audit` lists 12 advisories against `axios <1.20.0` (GHSA-vh66-26gq-q6x8,
GHSA-9fr6-4gfg-395g, GHSA-j8rh-479h-cp32 …), including prototype-pollution
gadgets that can rewrite outbound requests. Bumped to `^1.20.0`. The other ~60
advisories are in build/test tooling (Metro, Jest, Expo CLI, svgo), don't ship
in the bundle, and come with the next Expo SDK patch upgrade.

### S-07 · Medium · Cleartext / hard-coded endpoints — Fixed (guard), Ops (TLS)

Keycloak, API and WebSocket URLs fell back to hard-coded `http://192.168.x.x`
addresses, so a release build with no `.env` shipped with internal IPs and
plaintext auth traffic. *Fix:* `services/config/endpoints.ts` is the single
source. The LAN fallbacks apply only under `__DEV__`, and a release build with a
non-HTTPS endpoint logs a loud error at startup. **Ops:** put Keycloak and the
gateway behind TLS before any store build. Once that's done, the guard can be
changed to throw.

### S-08 · Medium · Server internals in the UI — Fixed

`ApiError` surfaced `data.message`/`data.error` for any status, plus
`Request failed (500)`. Network failures told end users to "check that the API
gateway URL is correct", and the Keycloak path said the same about "the
Keycloak URL". *Fix:* only 4xx ProblemDetail `detail`/`message` (the backend's
curated, user-facing text) reaches the screen. 5xx and transport errors get
plain user copy. Raw detail stays on `error.data` and in `__DEV__` logs.

### S-09 · Medium · Weak password minimum — Fixed (app) / Ops (realm)

Sign-up and reset accepted 6 characters. Raised to 8 (with a 128 maximum), per
NIST SP 800-63B. **Ops:** set the `hungry` realm's password policy to
`length(8)`, or the hosted/registration paths still accept 6. Existing
passwords are unaffected: the sign-in form keeps its old 6-character check, so
current 6–7 character passwords still sign in.

### S-10 · Medium · Android backups — Fixed

Expo leaves `android:allowBackup` on, so the AsyncStorage stores (notification
inbox with order details, receipts, the account-owner marker) went into Google
Drive and `adb backup`. SecureStore keys are Keystore-bound and are already
excluded. *Fix:* `android.allowBackup: false` in `app.json` (applies on the
next native build).

### S-11 · Medium · Maps key in the bundle used for web-service calls — Ops/Backend

`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` ships in the bundle, and
`services/api/places-service.ts` calls the Places **web service** with it. Web
service requests can't be restricted to the Android/iOS app, so whoever
extracts the key can bill Places/Geocoding against the project. **Fix:** use
two keys. Restrict the native Maps SDK key by package/SHA-1 and bundle ID.
Proxy Places and Geocoding through the backend with a server-held key, or at
least restrict that key to the Places API with a quota cap.

### S-12 · Low · Unvalidated push payload routing — Fixed

`router.push(`/orders/${data.orderId}`)` took `orderId` straight from the
notification payload. A crafted payload such as `../dev/design-system` could
steer navigation. *Fix:* `orderId` must match `^[A-Za-z0-9-]{1,64}$` and is
URI-encoded.

### S-13 · Low · Dev gallery in release — Fixed

The root guard skips `/dev` only under `__DEV__`, but a signed-in user could
still deep-link to `hungrycustomer://dev/design-system` in a release build. The
screen now redirects home unless `__DEV__`.

### S-14 · Low · `BYPASS_AUTH` — Fixed

It's `false` today, but one flipped literal would ship an app that boots
without auth. Now it's `__DEV__ && false`, so release builds can never take
that path.

### S-15 · Low · Release logging — Fixed

`console.log('[Auth] OAuth redirect_uri …')` ran on **every render** of the
provider, and failed logins logged the Keycloak error body. Both are now
`__DEV__` only.

### S-16 · Low · No expiry skew — Fixed

`isTokenExpired` compared `exp` against "now". A token that expires in transit
got sent anyway and came back 401. It now treats tokens within 30 s of expiry
as expired.

### S-17 · Info · Controls that must live server-side — Backend

- **E-mail verification gate** is enforced by the client router only. The
  backend must refuse checkout for `email_verified=false` password accounts.
- **STOMP topics** `/topic/orders/{id}/driver-location` and
  `/topic/customers/{id}/notifications` are keyed by order id. The
  `StompAuthChannelInterceptor` must authorize SUBSCRIBE frames against order
  ownership, not just authenticate CONNECT.
- **`POST /customers/verification/lookup`** answers "account exists or not" for
  any address, which enables enumeration. Rate-limit it per IP/device. The same
  goes for `/verification/send` and `/password-reset/*`, which mail codes.
- **`GET /customers/by-account/{sub}`** must only resolve the caller's own sub.
- **Resource-owner password grant** (`grant_type=password`) is deprecated by
  the OAuth 2.0 Security BCP and OAuth 2.1. It works, but moving e-mail login to
  the same Authorization Code + PKCE flow Google already uses would let
  Keycloak own brute-force protection, MFA and password policy end to end.

### S-18 · Info · Secrets hygiene — Accepted / Ops

- `hungry-delivery-app-…-firebase-adminsdk-….json` (a **private key**) sits in
  the repo root. It is gitignored and has never been committed (`git log --all`
  is empty). Keep it outside the working tree anyway, since any tool that
  zips the folder will include it.
- `google-services.json` is committed. That's normal: it's public client
  config. Restrict its API key in GCP to the Android app.
- EAS / FCM credentials are uploaded via `eas credentials`, not stored in the
  repo. Good.

---

## Design findings (frontend-design skill × handoff spec)

### D-01 · High · Template app icon and splash — Fixed (splash) / Designer (icon)

`assets/images/icon.png`, the Android adaptive layers and `splash-icon.png` are
Expo's starter art: a blue "A" on a blueprint grid, and a grey target on a
grid. They're the first and most-seen surfaces of the product, and they say
"unbranded template".

*Fixed:* the splash is now the brand logo on `ink` (`#003049`), the same
treatment as the AuthShell header and the OAuth "Signing you in…" screen, so
launch flows straight into sign-in without a white flash.
*Designer:* the launcher icon needs proper art. The logo is a 232×76 wordmark,
not an icon, so a mark needs designing (it must work at 48 px inside the
adaptive-icon safe zone, plus a monochrome variant for Android 13 themed
icons). The handoff contains none. The same monochrome file is the Android
**notification small icon** (`expo-notifications` plugin), so order pushes
currently show the Expo "A" in the status bar too.

The `app.json` changes (splash, colours, `allowBackup`, `userInterfaceStyle`)
are native config. They take effect after `npx expo prebuild --clean` or the
next EAS build, not on a Metro reload.

### D-02 · Medium · Failure copy that doesn't direct — Fixed

The skill: *"Explain what went wrong and how to fix it … never vague."* Five
screens fell back to "Something went wrong.", and transport errors spoke to
developers (see S-08). Each fallback now says what failed and what to do next
("Your changes weren't saved. Check your connection and try again.").
`app/restaurant/[id]/index.tsx` still has one "Something went wrong." fallback.
It was left alone because that file has uncommitted fly-to-cart work in
progress. It's mostly unreachable now, because API failures arrive as
`ApiError`s that carry their own message.

### D-03 · Medium · Dark-mode mismatch — Fixed

`theme.tsx` is light-only by design ("a dark Theme can be passed here later"),
but `app.json` declared `userInterfaceStyle: "automatic"` and a **black**
dark-mode splash. Dark-mode phones got a black splash, then a white app, plus
dark system keyboards and date pickers over light screens. Set to `"light"`
until a dark theme exists.

### D-04 · Low · Off-palette platform colours — Fixed

The notification accent was `#F5A623` (not a palette colour) and the adaptive
icon background `#E6F4FE` (Expo's default). Both are now on brand: `#EA8608`
`primary` and `#003049` `ink`.

### D-05 · Low · Contrast — Fixed

The profile version caption used `inkSubtle` `#8A969C` on white (≈2.9:1). The
spec (§ Accessibility) reserves `inkSubtle` for placeholders. Changed to
`inkMuted`.

### D-06 · Info · Spec-mandated "tells" — Accepted

The skill lists uppercase tracked overlines, `A · B` meta strings and a
monospace face for small data labels as generic tells. All three are explicit
in the handoff (`overline` token for list group headers; § Copy "Counts with a
middle dot"; JetBrains Mono for map coordinates only), and the skill's own rule
is that the brief's words win. Leave them as they are, but raise them with the
designer at the next revision: the overlines are the most template-like of the
three.

### D-07 · What's already right

- Reduce Motion is honoured: skeleton pulse, spinner and the fly-to-cart
  animation all check `useReducedMotion`. Layout animations use Reanimated's
  system default.
- One orchestrated motion moment (fly-to-cart) rather than per-section
  fade-ins. Only two `entering=` animations in the whole app.
- `maxFontSizeMultiplier` is capped centrally in `Text`/`TextField`, so Dynamic
  Type scales without breaking layouts.
- Touch targets ≥ 44 pt and tabular numerals for prices and counters, both via
  tokens. No inline hex values in screens or components (lint-guarded).
- Copy is sentence case, buttons are verbs, and empty states invite action, as
  the skill asks.

---

## Note — getting the security-guidance plugin to actually run

The plugin was installed but inactive for this review. To have it check this
branch and future work:

1. Restart Claude Code so the plugin's hooks load (`/plugin` should list
   `security-guidance` as enabled).
2. Make sure an API path is available to it: its earlier runs logged "LLM
   review disabled or no API credentials". The README covers
   `SECURITY_REVIEW_MODEL` for gateways and third-party providers.
3. Confirm with `tail ~/.claude/security/log.txt`: you should see `Stop` and
   commit-review entries for the session.
4. Optional: add `.claude/claude-security-guidance.md` with this app's rules
   (only API-origin URLs get the bearer token; device-local data must go
   through `claimDeviceData`; endpoints come from `services/config/endpoints`)
   so the diff reviewer enforces them.
