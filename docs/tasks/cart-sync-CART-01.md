---
suffix: CART-01
title: Add products to a cart and persist it in the backend
status: done
plan: docs/plans/cart-backend-sync-plan.md
depends_on: MENU-01
---

# CART-01 — Add products to a cart and persist it in the backend

Give each restaurant cart a durable server-side identity: adding a product from a restaurant
menu creates or replaces a real `Cart` row in the Hungry backend, one per restaurant.

Read [`docs/plans/cart-backend-sync-plan.md`](../plans/cart-backend-sync-plan.md) in full
before starting. §2 documents **two backend gaps that shape the entire client design** —
understand both before writing any code.

## Dependency — MENU-01 must be done first

This task builds on [`MENU-01`](./restaurant-products-MENU-01.md) (which itself requires
[`RESTO-01`](./restaurants-catalog-RESTO-01.md)) and reuses:

- the **jest harness** (RESTO-01 Phase 1) — do NOT reinstall it,
- the `pageSchema` helper — `/carts/all` returns the same flat `PageImpl` envelope,
- `selectPrice` and `formatAmount` from `services/api/product-view-model.ts` — hydration
  needs them to recover a line's unit price,
- `fetchProductById` from `services/api/product-service.ts`,
- the restaurant fetch and `RestaurantDetail` view model from RESTO-01,
- the `restaurantKeys` / `productKeys` factory style in `services/api/query-keys.ts`,
- `ApiError` / `isApiError` from `services/api/client.ts`.

Above all, it depends on MENU-01 for **real product ids**. Until the menu renders live
products, `app/food/[id].tsx` has only mock ids, and a mock id sent as `productId` returns
**500** (plan §3.5).

**Before starting**, verify MENU-01 is complete:

```bash
grep "^status:" docs/tasks/restaurant-products-MENU-01.md
ls schemas/product.ts services/api/product-service.ts services/api/product-view-model.ts hooks/use-products.ts
npm test
```

If `status:` is not `done`, or those files do not exist, **STOP** and report that CART-01 is
blocked on MENU-01. Do NOT implement MENU-01's scope, and do NOT recreate its files.

## The two blockers you must understand (plan §2)

### 1. `PUT /carts` is a silent no-op

`CartCrudService` never overrides `DefaultCrudService.update()`, which is literally
`return null;`. `DefaultCrudController` wraps it in `ResponseEntity.ok(null)`. So
`PUT /carts` answers **200 OK, empty body, and writes nothing**.

- **DO NOT** call `PUT /carts` or `PUT /carts/batch` anywhere in this task.
- **DO NOT** copy the `PUT /customers` pattern from `services/api/customer-service.ts` —
  `CustomerCrudService` is one of only two services that override `update`.
- Every mutation is **delete-then-create** (plan §4.3).

### 2. `Cart` has no restaurant field

`Order` has `@ManyToOne private Restaurant restaurant`. `Cart` does not. The
one-cart-per-restaurant rule therefore cannot be stored in the model as it stands, so the
client encodes it in the client-supplied `code`:

```
code = "hc:<customerId>:<restaurantId>"
```

filtered via `codes` + `EQUALS` (one cart) or `codes` + `LIKE` (all of a customer's carts).

- **DO NOT** modify the backend to add `restaurantId` — out of scope (plan §8).
- **DO NOT** infer a cart's restaurant from its products. There is no product→restaurant
  link either (MENU-01 §2).

## Verification status — read this before trusting the contract

Unlike RESTO-01 and MENU-01, **this plan was written from backend source, not from live
requests** — the Hungry stack was down and could not be started without colliding with an
unrelated project on `5432`. The contract below is derived from the exact classes named in
plan §3, but claims marked **[unverified]** could behave differently at runtime.

Plan §7 lists seven cheap probes. **If the gateway is reachable when you run, execute them
first** and correct the plan if reality differs. If it is not reachable, say so plainly in
your report — do not describe a live check as passed.

## Backend contract

```
POST   /carts            -> 201 Created + Location, body = CartOutputData
GET    /carts/{id}       -> 200 | 500 (not 404) for unknown/malformed ids
GET    /carts/all        -> flat PageImpl envelope (same as RESTO-01 §2.3)
DELETE /carts/{id}       -> 204 No Content
PUT    /carts            -> 200 with an EMPTY body, writes nothing. NEVER CALL.
```

```
CartInputData  { code (REQUIRED), name, customerId, comment, items: CartItemInputData[] }
CartItemInputData { code, name, productId, quantity }

CartOutputData { id, code, name, customerId, customerCode, customerFullName,
                 status, comment, items: CartItemOutputData[], createdAt }
CartItemOutputData { id, code, name, productId, productCode, productName, quantity }
```

Filter keys:

| Key | Status |
| --- | --- |
| `codes`, `names` | works — real String columns |
| `customerIds` | **500 — never send it.** `root.get("customerId")` on an entity whose field is `customer` |
| `statuses` | **500 [unverified] — never send it.** Bare ORDINAL enum compared to a String |
| `ids` | **[unverified]** — UUID path vs String value. Use `GET /carts/{id}` instead |

Things the backend ignores or drops (plan §3.4):

- `status` on input — always forced to `ACTIVE`
- `CartItemInputData.code` / `.name` — dropped; `CartItemOutputData.name` is always `null`,
  use `productName`
- addons, per-line notes, prices — **no fields exist**; client-only for this whole task

`customerId` is the backend `Customer.id` UUID from `useCustomer(user.sub).data.id` — **not**
the Keycloak `sub`.

## Phases

Use TodoWrite with one todo per phase. Mark each complete immediately on finishing it,
never batched.

### Phase 1 — Schemas

Create `schemas/cart.ts` in the style of `schemas/product.ts`.

- `cartStatusSchema` = `z.enum(['ACTIVE','SUBMITTED','ABANDONED'])`, `.nullish()` at use
  sites — an unknown status must not fail the whole parse.
- `cartItemOutputSchema`, `cartOutputSchema`. Everything `.nullish()` except `id`.
- `.catch([])` on `items`.
- Reuse `pageSchema` — do NOT copy it.
- Input types (`CartInput`, `CartItemInput`) are hand-written interfaces, not schemas: they
  are what the app sends, so there is nothing to validate at runtime.
- Export output types via `z.infer` only.

**Tests** (`schemas/__tests__/cart.test.ts`): a full cart parses; `{id}` alone parses with
`items` defaulting to `[]`; a cart whose item `name` is `null` parses; an unknown `status`
string does not throw away the rest of the cart; a cart missing `id` fails with `id` in the
issue path.

### Phase 2 — Cart identity

In a new `services/api/cart-view-model.ts`:

```ts
export const CART_CODE_PREFIX = 'hc';
export function cartCodeFor(customerId: string, restaurantId: string): string;
export function parseCartCode(code: string | null | undefined): { customerId: string; restaurantId: string } | null;
export function customerCartCodePrefix(customerId: string): string;   // "hc:<customerId>:"
```

- This is the **only** place the `hc:` scheme is written down.
- `parseCartCode` returns `null` — never throws — for `null`, `''`, a wrong prefix, too few
  or too many segments, or empty segments.
- Add a short comment: this exists because `Cart` has no `restaurant` field (plan §2.2), and
  it becomes a legacy read path once the backend adds one.

**Tests** (`services/api/__tests__/cart-view-model.test.ts`): round trip; `null` /
`undefined` / `''` return `null`; `'other:a:b'` returns `null`; `'hc:a'` returns `null`;
`'hc::b'` returns `null`; a code with a different customer still parses (filtering by
customer is the caller's job, and the test must document that).

### Phase 3 — Mapping local lines to a cart payload

Also in `services/api/cart-view-model.ts`:

```ts
export function toCartInput(args: { customerId: string; restaurantId: string; restaurantName: string; lines: CartLine[]; comment?: string }): CartInput;
export function syncSignature(lines: CartLine[]): string;
```

`toCartInput` must:

- **Group lines by `productId` and sum their quantities** (plan §4.4). Two local lines for
  the same product with different addons collapse into ONE `CartItemInputData`, because the
  backend has no addon concept and two rows would read back as a duplicated product.
- Drop lines with `quantity <= 0`.
- Always set `code` to `cartCodeFor(...)` — never omit it (plan §3.3).
- Set `name` to the restaurant name (a human-readable label for the back-office; it is
  persisted, unlike the item-level `name`).
- **Never** set `status`, and never send an addon, note or price field.
- Carry a comment recording exactly which local information is discarded here.

`syncSignature` returns a stable string from product ids and quantities, sorted so line
order does not matter. It must **not** include addons, notes or prices — the backend cannot
store them, so a change to one must not trigger a pointless delete-and-recreate.

**Tests**: two lines, same `productId`, different addons → one item, summed quantity; two
products → two items, and assert the mapped quantities; `quantity: 0` is excluded; an empty
`lines` array → `items: []` (not `undefined`); the payload always has a non-empty `code`;
the payload contains no `status`/`addons`/`note`/`price` keys. For `syncSignature`: stable
across reordering; changes on a quantity change; changes when a product is added or removed;
**unchanged** when only a note or an addon set changes.

### Phase 4 — Service layer

Create `services/api/cart-service.ts` using the existing `apiClient`.

```ts
export async function createCart(input: CartInput): Promise<Cart>
export async function fetchCartByCode(code: string): Promise<Cart | null>
export async function fetchCustomerCarts(customerId: string): Promise<Cart[]>
export async function deleteCart(cartId: string): Promise<void>
export async function replaceCart(input: CartInput, knownCartId?: string): Promise<Cart | null>
```

- Parse every response through the Phase 1 schemas; on parse failure throw an `ApiError`
  naming the offending field path.
- `fetchCartByCode` → `GET /carts/all` with
  `filter={"codes":[{"operator":"EQUALS","fieldValue":code,"fieldType":"STRING"}]}`,
  returning the first entry or `null`. If more than one row comes back, take the newest by
  `createdAt` and log a warning — duplicates are possible (plan §3.3).
- `fetchCustomerCarts` → the same filter with `"operator":"LIKE"` and
  `customerCartCodePrefix(customerId)`. **Then filter the results client-side** by
  `parseCartCode(...)?.customerId === customerId`; `LIKE` is a substring match and
  `/carts/all` is not scoped to the caller. Comment this as query correctness, **not** as a
  security measure (plan §3.6).
- `replaceCart` implements plan §4.3: resolve the id (from `knownCartId`, else
  `fetchCartByCode`) → `DELETE` if found → `POST` if `input.items.length > 0`. **Delete
  strictly before create.** An empty item list deletes and returns `null` without creating.
  A failed delete of a well-formed UUID must not abort the create — treat it as
  already-gone and continue.
- Treat 500 on a well-formed UUID as not-found, with a comment noting that a genuine server
  fault is indistinguishable here (plan §3.5).
- Guard `deleteCart` / `GET /carts/{id}` behind a UUID-shape check so a malformed id never
  leaves the device.
- **NEVER** emit `customerIds` or `statuses` in a filter. **NEVER** call `PUT /carts`.
- `sort` restricted to a whitelist union `'createdAt' | 'code' | 'name'`.

**Tests** (`services/api/__tests__/cart-service.test.ts`): mock `apiClient`. Assert the
`codes` filter JSON for both `EQUALS` and `LIKE`; assert no request payload or query string
ever contains `customerIds`, `statuses` or a `put` call; assert every create payload has a
non-empty `code`; assert `replaceCart` calls delete before create (check call order, not
just that both happened); assert an empty item list deletes and does not create; assert a
delete that rejects with 500 still proceeds to create; assert 500 on a valid UUID read maps
to `null`; assert a schema-invalid response throws `ApiError`; assert `fetchCustomerCarts`
drops a row belonging to another customer.

### Phase 5 — Store: sync state and the one-restaurant invariant

Modify `store/cart-store.ts`.

- Add a persisted `remote` slice keyed by `restaurantId`:
  `{ cartId: string | null; syncedSignature: string | null; status: 'idle'|'syncing'|'synced'|'error'; error?: string }`,
  with actions `setSyncState(restaurantId, patch)` and `clearSyncState(restaurantId)`.
- The persisted shape changes, so add `version: 1` and a `migrate` that returns
  `{ ...persisted, remote: {} }` for version `0`. Existing carts on device must survive the
  upgrade — do not silently drop them.
- Guard `addItem`: reject (no-op) a line with an empty or missing `restaurantId`. Without
  the guard, every restaurant collapses into one group and the core product rule breaks.
- Have `clearRestaurant` and `clear` also clear the matching sync state.
- Add a `hydrated?: boolean` flag to `CartLine` for Phase 6.
- Replace `image: any` and `restaurantLogo?: any` with the `FavoriteImage`-style union
  RESTO-01 introduced (`string | number`). Do NOT widen it back to `any`.

**Tests** (`store/__tests__/cart-store.test.ts`): reset the store between tests. Adding from
restaurant B leaves restaurant A's group unchanged (deep-equal the whole group); the same
`foodId` added under two different `restaurantId`s produces two groups, never one line; two
groups both survive `groupByRestaurant`; `clearRestaurant('A')` leaves B's items and B's
sync state intact; `addItem` with `restaurantId: ''` does not change `items`; the `migrate`
function turns a version-0 persisted blob into one with `remote: {}` and identical `items`.

### Phase 6 — Sync engine and hydration

Add a `cartKeys` factory to `services/api/query-keys.ts` mirroring `restaurantKeys`
(`all` / `lists()` / `list(customerId)` / `details()` / `detail(code)`).

Create `hooks/use-cart-sync.ts`:

- `useCartSync()` — watches `groupByRestaurant(items)`; for each group whose
  `syncSignature` differs from its stored `syncedSignature`, runs `replaceCart` through a
  mutation. Debounce ~800ms so tapping `+` five times issues one sync, not five. Skip
  entirely when there is no `customerId` (signed out) and leave the local cart untouched.
  Write `syncedSignature` only after a successful create.
- `useHydrateCarts()` — runs once when a `customerId` becomes available **and the local
  cart is empty**. Fetches the customer's carts, resolves each `restaurantId` via
  `parseCartCode`, and rebuilds lines via `fetchProductById` + `selectPrice` (MENU-01) and
  the restaurant fetch (RESTO-01). Lines get `addons: []`, `note: undefined` and
  `hydrated: true`. Skip any cart whose restaurant or products no longer resolve rather
  than rendering a nameless or unpriced line.
- A non-empty local cart suppresses hydration entirely — local wins (plan §4.5).
- `retry: false` on cart reads that map 500 to not-found: `query-client.ts` retries 500s
  twice by default, which would triple every not-found probe.

**Tests** (`hooks/__tests__/use-cart-sync.test.ts`): mock the service. A signature match
issues no request; a quantity change issues exactly one `replaceCart` after the debounce; no
`customerId` issues nothing; a failed sync sets `status: 'error'` and leaves
`syncedSignature` unchanged so the next attempt retries; hydration is skipped when local
items exist; a hydrated line has `addons: []` and `hydrated: true`; a cart whose restaurant
does not resolve is skipped rather than added.

### Phase 7 — Screens

`app/food/[id].tsx`:

- Pass the real backend product id as `foodId` and the real restaurant identity into
  `addItem` (both come from MENU-01's fetches — do not reintroduce `RESTAURANT_ID` /
  `RESTAURANT_NAME` / `RESTAURANT_LOGO` constants).
- Disable add-to-cart when the product has no applicable price (MENU-01 already establishes
  this) or when no backend product id is available.

`app/(tabs)/cart.tsx`:

- Mount `useCartSync()` and `useHydrateCarts()`.
- Render a `components/cart/sync-badge.tsx` per group: `synced` / `syncing` / `not saved`.
  On `error`, show `not saved` with a retry affordance. Never show a success state for an
  unsynced cart.
- The hard-coded `rating="92%"` / `reviewCount="1000+"` props on `RestaurantCartCard` have
  no backing data (RESTO-01's `UNBACKED_FIELDS`). Omit them rather than passing invented
  values.

`app/cart/[id].tsx`:

- Delete `SUGGESTED_ITEMS` and the `SuggestedItems` block — no recommendations source
  exists (plan §8). Render nothing there.
- Keep `SERVICE_FEE = 3` as-is with a comment saying it is a placeholder with no backend
  concept. Do not invent a fee API.
- If any visible line is `hydrated`, show one plain note that customisations from a previous
  device were not restored. Do not imply the addons still apply.

Use `constants/theme` tokens, `PressableScale` over `TouchableOpacity` in new code, and
double-quoted imports in `components/`.

### Phase 8 — Verification

```bash
npx tsc --noEmit          # must be 0 errors
npm test                  # all tests pass
npx eslint .              # no new errors
```

Confirm the forbidden write path is absent:

```bash
grep -rn "put(" services/api/cart-service.ts
grep -rn "customerIds\|statuses" services/api/cart-service.ts
```

Both must return **no matches**.

Confirm the mocks are gone:

```bash
grep -rn "SUGGESTED_ITEMS\|RESTAURANT_ID\|RESTAURANT_NAME\|RESTAURANT_LOGO" \
  app components --include=*.tsx
```

Must return **no matches**.

If the gateway is reachable, run the plan §7 probes and report what each returned. If it is
not reachable, say so plainly — do not describe a live check as passed.

## Definition of done

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test` → all pass, including every `toCartInput` collapsing case in Phase 3
- [ ] `npx eslint .` → no new errors
- [ ] All three Phase 8 greps return no matches
- [ ] `PUT /carts` is called nowhere in the repository
- [ ] No filter anywhere sends `customerIds` or `statuses`
- [ ] Every create payload carries a non-empty `code`
- [ ] `replaceCart` provably deletes before creating (asserted by call order, not by both
      calls merely happening)
- [ ] Adding a product from a second restaurant creates a second cart and leaves the first
      untouched
- [ ] Existing on-device carts survive the persist `migrate`
- [ ] No `any` introduced; no hand-written type duplicating a zod output schema
- [ ] The UI never claims addons, notes or prices are saved on the server

## Constraints

- **DO NOT** modify anything under `C:\projects\hungry-web\hungry-backend`.
- **DO NOT** implement MENU-01's or RESTO-01's scope, or recreate their files. If MENU-01 is
  not done, STOP.
- **DO NOT** call `PUT /carts` or `PUT /carts/batch` — 200 OK, empty body, writes nothing.
- **DO NOT** send a `customerIds` or `statuses` filter — both 500.
- **DO NOT** omit `code` from a create payload; nothing on the backend generates it.
- **DO NOT** create before deleting when replacing a cart — `code` has no unique constraint.
- **DO NOT** send two cart items with the same `productId`; group and sum instead.
- **DO NOT** infer a cart's restaurant from its products, or add a restaurant→cart mapping
  table in the app.
- **DO NOT** describe the client-side customer filter as a security measure. It is query
  correctness; the backend enforces no cart ownership at all (plan §3.6).
- **DO NOT** add a "clear cart from another restaurant?" prompt — parallel carts are the
  requested behaviour, not a conflict to resolve.
- **DO NOT** implement checkout, `/orders`, `CartStatus.SUBMITTED`, fees or promotions.
- **DO NOT** commit or push unless explicitly asked.
- Match surrounding code: double-quoted imports in `components/`, `constants/theme` tokens
  over literal colours, `PressableScale` over `TouchableOpacity` in new code.

## Report

On completion, report: files created and modified; the exact output of the three
verification commands; whether the plan §7 live probes were run and what each returned (or
that the backend was unreachable); which **[unverified]** claims you confirmed or corrected;
what the app does today when a sync fails; and a clear restatement of the two backend
changes from plan §2.2 and §3.6 that this task works around rather than fixes.
