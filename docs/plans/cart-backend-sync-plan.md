# Plan — Cart: Adding Products and Persisting Carts in the Backend

**Status:** Ready for implementation — with two backend gaps, see §2
**Task file:** [`docs/tasks/cart-sync-CART-01.md`](../tasks/cart-sync-CART-01.md) — trigger with `/task "CART-01"`
**Depends on:** [`MENU-01`](../tasks/restaurant-products-MENU-01.md) — must be `status: done` first (which in turn requires `RESTO-01`)
**Date:** 2026-08-23
**Backend studied:** `C:\projects\hungry-web\hungry-backend` @ `0e5bb3c`

> **Verification note.** Unlike `RESTO-01` and `MENU-01`, whose contracts were exercised
> against a running backend, this plan is **derived from backend source only**. The Hungry
> stack was not running while it was written (`:8081` and `:8082` both refused connections;
> the container on `:8080` belongs to an unrelated project), and bringing up `compose.yaml`
> would have collided on `5432` with another project the developer had running. Every claim
> below cites the file and mechanism it comes from, and §7 lists the exact probes to run
> once the stack is up. Claims marked **[unverified]** are the ones that could plausibly
> behave differently at runtime — check those first.

---

## 1. Goal

Let a customer add products from a restaurant menu to a cart, and have that cart exist as a
real `Cart` row in the backend rather than only in device storage.

The product rule from the request, stated precisely:

> A cart holds products from exactly one restaurant. Adding a product from a different
> restaurant does not replace or clear the current cart — it creates a **second, parallel
> cart**. A customer can therefore have several active carts at once, one per restaurant.

This is already the shape of the UI: `store/cart-store.ts` exposes `groupByRestaurant()`,
`app/(tabs)/cart.tsx` renders one `RestaurantCartCard` per group, and `app/cart/[id].tsx`
opens a single restaurant's cart by id. **One UI group == one backend `Cart` row.** The work
is to give each group a durable server-side identity, not to change the interaction model.

## 2. The two backend gaps you must know about first

Both are load-bearing: the entire client design below follows from them. Neither is fixed in
this repository.

### 2.1 `PUT /carts` is a silent no-op — 200 OK, empty body, nothing written

This is the single most important fact in this plan.

`CartCrudService` extends the framework's `DefaultCrudService` and **does not override
`update`**:

```java
// jfwk-core/.../application/service/base/impl/DefaultCrudService.java
@Override
public O update(I input) {
    return null;          // not "unimplemented", not a throw. Returns null.
}

@Override
public List<O> updateAll(List<I> inputs) {
    return List.of();
}
```

and the controller wraps that return value without inspecting it:

```java
// jfwk-core/.../adapter/rest/base/impl/DefaultCrudController.java
@Override
public ResponseEntity<O> update(I model) {
    return ResponseEntity.ok(crudService.update(model));   // ResponseEntity.ok(null)
}
```

So `PUT /carts` answers **200 OK with an empty body and persists nothing**. It does not
error. It does not warn. A client that treats 200 as success will silently lose every cart
mutation the user makes.

Only two services in the whole backend override `update`: `CustomerCrudService` and
`DriverCrudService`. That is why `services/api/customer-service.ts` can call
`PUT /customers` and get a real result — and why the same pattern must **not** be copied for
carts.

> **Consequence:** the only write operations that actually work on `/carts` are
> **`POST` (create)** and **`DELETE`**. Every cart change must be expressed as
> *delete-then-recreate*. This is not a preference; it is the only path that persists.

### 2.2 `Cart` has no restaurant — but `Order` does

`Cart`'s complete field list is `customer`, `status`, `comment`, `items`, plus the
`CoreModel` base (`id`, `code`, `name`) and `TraceabilityModel` audit columns. There is no
`restaurant`, no `restaurantId`, and `CartItem` holds only `cart`, `product`, `quantity`.

Meanwhile, in the same module tree:

```java
// hungry-core/.../order/application/model/Order.java
@Entity @Table(name = "orders") @AggregateRoot
public class Order extends CoreModel {
    @ManyToOne
    private Restaurant restaurant;       // Order has it. Cart does not.
    @ManyToOne @JoinColumn(name = "customer_id")
    private Customer customer;
    private OrderStatus status;
    ...
}
```

So the one-cart-per-restaurant rule **cannot be expressed in the backend model as it
stands**, even though the precedent for expressing it sits one package away.

#### The backend fix, precisely

Mirror `Order`. In `delivery.hungry.cart`:

1. `Cart` — add `@ManyToOne private Restaurant restaurant;`
2. `CartInputData` — add `String restaurantId`; `CartOutputData` — add `restaurantId`,
   `restaurantName`, `restaurantLogoUrl`
3. Add `CartRestaurantPopulator`, a direct copy of the existing `CartCustomerPopulator`
   with the restaurant repository swapped in, and register both directions in
   `CartConverterConfig`
4. `CartFilter` / `CartSpecification` — add `restaurantIds`, and **join** on it (see the
   bug in §3.5 before copying the existing `customerIds` line)

That is one field and one populator, following a pattern already in the codebase. Raise it
with the backend team. **Do not attempt it from this repository.**

### 2.3 How this task ships anyway — `code` as the composite key

`CoreModel.code` is a plain `String` column, it is **client-supplied** (nothing in the
backend generates it — `CoreModelBasePopulator` just copies `source.getCode()` through), and
`CoreModelFilter.codes` maps to `root.get("code")`, a real String attribute. It is therefore
the one field on `Cart` that the client fully controls *and* can query by.

So the client owns cart identity:

```
code = "hc:<customerId>:<restaurantId>"
```

- Find one restaurant's cart → `filter={"codes":[{"operator":"EQUALS","fieldValue":"hc:<cid>:<rid>","fieldType":"STRING"}]}`
- Find all of a customer's carts → same key with `"operator":"LIKE"` and `fieldValue` set to
  `"hc:<cid>:"` (`SpecificationUtils` renders `LIKE` as `%value%`; customer ids are UUIDs,
  so the prefix cannot collide)

This gives a fully working per-restaurant cart with **zero backend changes**, using only
`POST`, `DELETE` and `GET /carts/all`. When §2.2 lands, `restaurantId` becomes a real column
and the code scheme degrades to a legacy read path — one function changes.

**Do not** try to recover the restaurant by reading a cart's products and inferring
ownership. Per `MENU-01` §2 there is no product→restaurant link either; that inference is
not available, and guessing it produces carts attributed to the wrong restaurant.

## 3. Ground truth — from backend source

### 3.1 Endpoints

| Method | Path | Works? | Notes |
| --- | --- | --- | --- |
| `POST` | `/carts` | yes | **201 Created** + `Location` header, body = `CartOutputData` |
| `GET` | `/carts/{id}` | yes | id must be a well-formed UUID; see §3.5 |
| `GET` | `/carts/all` | yes | flat `PageImpl` envelope, same as `RESTO-01` §2.3 |
| `PUT` | `/carts` | **no-op** | §2.1 — 200, empty body, nothing written |
| `PUT` | `/carts/batch` | **no-op** | same, returns `[]` |
| `DELETE` | `/carts/{id}` | yes | 204 No Content |
| `DELETE` | `/carts/batch` | yes | 204; body is a JSON array of id strings |
| `POST` | `/carts/batch` | yes | 201; array in, array out |

Default sort on `/carts/all` is `[{"field":"createdAt","direction":"desc"}]` — valid, since
`createdAt` is a real column on `TraceabilityModel`.

### 3.2 Shapes

```
CartInputData                       CartOutputData
  code          string  <- REQUIRED   id                string   (UUID)
  name          string                code              string
  customerId    string  (UUID)        name              string
  comment       string                customerId        string
  items         CartItemInputData[]   customerCode      string
                                      customerFullName  string
CartItemInputData                     status            'ACTIVE'|'SUBMITTED'|'ABANDONED'
  code       string                   comment           string
  name       string                   items             CartItemOutputData[]
  productId  string  (UUID)           createdAt         date-time
  quantity   int
                                    CartItemOutputData
                                      id, code, name, productId, productCode,
                                      productName, quantity
```

`customerId` is the **backend `Customer.id` (a UUID)** — not the Keycloak `sub`. The app
resolves it with the existing `useCustomer(user.sub)` hook, whose data carries `id`.

### 3.3 `code` is required in practice, and nothing generates it

`CoreModelBasePopulator.CoreModelBaseDirectPopulator` copies `code` and `name` straight from
the input; `IdentityModel.code` has no generator, no `@PrePersist`, and no uniqueness
constraint. Omit `code` on create and the cart is written with `code = null` — findable only
by its `id`, which the app would then have to store locally, defeating the point.
**Always send `code`.**

Because there is no unique constraint, two `POST`s with the same `code` produce **two rows
with the same code**. The delete-before-create ordering in §4.3 is what prevents duplicates;
it is not merely an optimisation.

### 3.4 Fields the backend silently ignores or overwrites

| Client sends | What actually happens |
| --- | --- |
| any `status` | ignored — `CartBasePopulator` hard-codes `target.setStatus(CartStatus.ACTIVE)` on every create |
| `CartItemInputData.code` / `.name` | **dropped** — `CartItemPopulator`'s direct populator sets only `quantity` and `product`; it never calls `CoreModelBasePopulator`. `CartItemOutputData.name` therefore always comes back `null`. Use `productName`. |
| addon / option selections | **no field exists.** `CartItem` is `{cart, product, quantity}` only |
| per-line note | **no field exists** (`comment` is per-cart, not per-line) |
| any price or total | **no field exists** anywhere on `Cart` or `CartItem` |

The `Order` aggregate models exactly what `CartItem` is missing — `OrderedProduct` holds a
`List<OrderedProductAttribut>`, each pairing a `Product` with an `Attribute`. Cart has no
equivalent. So **addons, notes and money are client-only for the whole of this task**, and
the UI must never imply the server knows about them.

### 3.5 Sharp edges

| Edge | Cause | Client rule |
| --- | --- | --- |
| `filter={"customerIds":…}` → **500** | `CartSpecification` calls `addFilterPredicate(…, customerIds, "customerId", root, cb)`, but `Cart` has a `customer` association and **no `customerId` attribute**. `root.get("customerId")` throws `IllegalArgumentException`. Same bug class as the restaurant `cuisines` filter. | **Never send it.** Scope by `codes` instead (§2.3). |
| `filter={"statuses":…}` → **500 [unverified]** | `status` is a bare enum with no `@Enumerated`, so JPA maps it **ORDINAL** (an integer column). `createPredicate` builds `cb.equal(root.get("status"), "ACTIVE")` from a `STRING` fieldType — comparing an enum path to a String literal. | **Never send it.** Filter `status` client-side from the response field. |
| `filter={"ids":…}` → **[unverified]** | `root.get("id")` is a `UUID` path compared against a `String` value. | Prefer `codes`. Use `GET /carts/{id}` for a single cart. |
| `GET /carts/{unknown-uuid}` → **500**, not 404 | `DefaultCrudRepository.find` is `findById(...).orElseThrow()` → `NoSuchElementException`, and `CartControllerAdvice` registers **only** the filter editor — no `@ExceptionHandler` at all. | Treat 500-on-a-well-formed-UUID as not-found. |
| `GET /carts/abc` → **500**, not 400 | `IdResolver` calls `UUID.fromString("abc")` → `IllegalArgumentException`, same missing advice. | Validate the UUID shape client-side before calling. |
| bad `productId` on create → **500** | `CartItemPopulator` wraps `productRepository.find(...)` failures in `PopulatorException`; no handler. | Only send product ids that came from a `MENU-01` fetch. |
| unknown `sort` field → **500** | `Sort.Order` on a non-existent property. | Whitelist `createdAt` / `code` / `name`. |

Only `codes` and `names` are safe filter keys on this resource. Both resolve to real String
columns on `Cart`.

### 3.6 Authorization — every authenticated user can read and delete every cart

There is no ownership check anywhere in the request path:

- **Gateway** (`GatewaySecurityConfig`): `/carts/**` falls through to
  `anyExchange().authenticated()`. No role, no owner.
- **hungry-app** (`jfwk-security/SecurityConfig`): `anyRequest().authenticated()`.
- **Method security**: grepping the entire backend for `@PreAuthorize`,
  `@EnableMethodSecurity` and `@Secured` returns **zero matches**.

So any customer's valid token can `GET /carts/all` and page through every other customer's
carts, read them by id, and `DELETE` them.

Two consequences, and they are different in kind:

1. **For this task (client):** always scope reads by the current customer's `code` prefix,
   and never assume `/carts/all` is pre-filtered. This is correctness, not security — a
   client-side filter protects nobody.
2. **For the backend team:** this is a real horizontal-privilege gap and should be raised
   alongside §2.2. Fixing it belongs with the `restaurantId` change, since scoping
   `CartFilter` to the authenticated principal needs the association to exist.

Do not describe the client-side scoping as a security measure in code comments or in the
final report. It is a query-correctness measure.

### 3.7 Dates

Nothing in the backend configures Jackson — no `JavaTimeModule` registration, no
`write-dates-as-timestamps` property. Spring Boot's auto-configuration therefore applies,
which disables `WRITE_DATES_AS_TIMESTAMPS`, so `createdAt` should arrive as an ISO-8601
**local** date-time string with no offset (`"2026-08-23T12:34:56"`). **[unverified]** — and
note the missing zone: never feed it straight to `new Date()` and compare against a UTC
instant. Parse it as local wall-clock time or ignore it; this task only uses it for display
ordering.

## 4. Architecture

### 4.1 Two layers, one direction of truth

```
  user taps "Add to cart"
        |
        v
  useCartStore (Zustand + AsyncStorage)      <- source of truth for the UI
        |   holds addons, notes, unit prices: things the backend cannot store
        |
        |  debounced, per restaurant group
        v
  useCartSync  -->  cart-service  -->  POST /carts  /  DELETE /carts/{id}
        |                                    ^
        |                                    |  code = "hc:<customerId>:<restaurantId>"
        +--->  syncState in the store  ------+
```

The local store stays authoritative. The backend cart is a **projection** of it — a durable
copy so the cart survives reinstall and is available to a future checkout, not a second
opinion about what is in the cart. Every design question below resolves by asking which side
holds information the other cannot represent, and §3.4 answers that unambiguously.

### 4.2 Identity

`cartCodeFor(customerId, restaurantId)` and `parseCartCode(code)` are pure functions and the
only place the `hc:` scheme is written down. `parseCartCode` returns `null` for anything it
does not recognise, so foreign or legacy rows are skipped rather than mis-attributed.

### 4.3 Writing — replace, never update

Because of §2.1, one sync of one restaurant group is:

1. Resolve the remote cart id: from `syncState` if known, else `GET /carts/all` filtered by
   the exact `code`.
2. If it exists → `DELETE /carts/{id}`.
3. `POST /carts` with the full item list.
4. Store the returned `id` and the signature that was synced.

**Order matters.** `code` has no unique constraint (§3.3), so create-then-delete leaves a
window where a crash duplicates the cart, while delete-then-create at worst loses a
server-side copy the local store can immediately rebuild. If the group is empty, step 3 is
skipped — an empty cart is a deleted cart.

A small `syncSignature(lines)` (product ids plus quantities, sorted) gates the whole thing:
if it equals the last synced signature, do nothing. Without it, every render of the cart
screen issues a delete and a create.

### 4.4 Collapsing lines — the case that is easy to get wrong

Locally, "Pizza + extra cheese" and "Pizza, no addons" are two `CartLine`s with the same
`foodId`. The backend has no addons, so both map to the same `productId`.

Sending them as two `CartItemInputData` entries writes **two `h_cart_item` rows for one
product** — which then reads back as a cart that looks like it contains the pizza twice
under two identical names.

So `toCartInput` must **group local lines by `productId` and sum their quantities**. This is
lossy, and that is unavoidable; the loss is documented, tested, and confined to one
function.

### 4.5 Reading back

On sign-in with an **empty** local cart, remote carts are hydrated:

- `GET /carts/all` with the `LIKE "hc:<customerId>:"` code filter
- `parseCartCode` recovers each cart's `restaurantId`
- `RESTO-01`'s restaurant fetch supplies the restaurant name and logo
- `MENU-01`'s `fetchProductById` + `selectPrice` supply each line's name and unit price

Addons and per-line notes are **not recoverable** — they were never stored. Hydrated lines
carry `addons: []` and a `hydrated: true` marker so the UI can say so plainly rather than
implying the user's customisations survived.

If the local cart is **not** empty, local wins: push local state over remote and do not
merge. Merging two carts that disagree about addons has no correct answer, and the device
the customer is holding is the better source.

### 4.6 The one-cart-per-restaurant rule

Enforced entirely in the local store, which already does it: `lineSignature` is prefixed
with `restaurantId`, and `groupByRestaurant` partitions by it. This task adds the invariant
as an explicit, tested property rather than an emergent one, and adds a guard in `addItem`
so a line whose `restaurantId` is empty is rejected instead of collapsing every restaurant
into one group.

**There is no "your cart contains items from another restaurant — clear it?" prompt.** That
is a different product rule (single active cart), and it is not the one requested here.

## 5. Files

**New**

| File | Purpose |
| --- | --- |
| `schemas/cart.ts` | zod schemas + inferred types for `CartOutputData` / `CartItemOutputData` |
| `services/api/cart-service.ts` | `createCart`, `fetchCartByCode`, `fetchCustomerCarts`, `deleteCart`, `replaceCart` |
| `services/api/cart-view-model.ts` | `cartCodeFor`, `parseCartCode`, `toCartInput`, `syncSignature`, `toLocalLines` |
| `hooks/use-cart-sync.ts` | `useCartSync`, `useHydrateCarts` |
| `components/cart/sync-badge.tsx` | Per-group `synced / syncing / offline` indicator |

**Modified**

| File | Change |
| --- | --- |
| `store/cart-store.ts` | Add the persisted `remote` slice (`version: 1` + `migrate`), the `restaurantId` guard, and `image` / `restaurantLogo` typed off `any` |
| `services/api/query-keys.ts` | Add `cartKeys` |
| `app/(tabs)/cart.tsx` | Mount the sync engine and hydration; render `SyncBadge` per group |
| `app/cart/[id].tsx` | Show the sync state; delete `SUGGESTED_ITEMS` (no backend concept) |
| `app/food/[id].tsx` | Pass real `productId` / restaurant identity into `addItem` |

## 6. Testing

Priorities, highest value first:

1. **`toCartInput` collapsing (§4.4)** — two lines, same `productId`, different addons →
   **one** item with summed quantity; three lines across two products → two items; an empty
   group → `items: []`; quantity-`0` lines never reach the payload.
2. **The one-cart-per-restaurant invariant (§4.6)** — adding from restaurant B leaves
   restaurant A's group byte-identical; the same product from two restaurants never merges;
   `addItem` with an empty `restaurantId` is rejected.
3. **`cartCodeFor` / `parseCartCode`** — round trip; a foreign code returns `null`; a code
   with the wrong customer returns `null`; a malformed code does not throw.
4. **`syncSignature`** — stable across line reordering; changes on quantity change; changes
   on product add/remove; **unchanged** when only a note or an addon changes (the backend
   cannot store those, so re-syncing would be pure waste).
5. **`replaceCart` ordering** — asserts `DELETE` is called before `POST`; a 500 on the
   delete of a well-formed UUID still proceeds to create; an empty item list deletes and
   does **not** create.
6. **Service layer** — asserts the emitted filter JSON uses `codes`; asserts **no request
   ever contains `customerIds` or `statuses`**; asserts `code` is present on every create
   payload; asserts a 500 on a well-formed UUID maps to not-found; asserts a schema-invalid
   response throws `ApiError`.
7. **Hydration** — a remote cart maps to local lines with `addons: []` and `hydrated: true`;
   a remote cart whose restaurant no longer resolves is skipped, not rendered nameless; a
   non-empty local cart suppresses hydration entirely.

## 7. Live probes to run once the stack is up

Every one of these is cheap, and each resolves an **[unverified]** claim above. Run them
before trusting the corresponding code path, and correct this plan if reality differs.

```bash
# 0. token
TOKEN=$(curl -s -X POST http://localhost:8081/realms/hungry/protocol/openid-connect/token \
  -d grant_type=password -d client_id=hungry-customer-app \
  -d username=<user> -d password=<pass> | jq -r .access_token)
A="Authorization: Bearer $TOKEN"

# 1. §2.1 — does PUT really no-op? Create, PUT a change, re-read.
#    Expect: 200 with an EMPTY body, and the re-read unchanged.

# 2. §3.5 — confirm the broken filters (both should be 500)
curl -s -o /dev/null -w '%{http_code}\n' -H "$A" \
  'http://localhost:8082/carts/all?filter=%7B%22customerIds%22%3A%5B%7B%22operator%22%3A%22EQUALS%22%2C%22fieldValue%22%3A%22x%22%2C%22fieldType%22%3A%22STRING%22%7D%5D%7D'
curl -s -o /dev/null -w '%{http_code}\n' -H "$A" \
  'http://localhost:8082/carts/all?filter=%7B%22statuses%22%3A%5B%7B%22operator%22%3A%22EQUALS%22%2C%22fieldValue%22%3A%22ACTIVE%22%2C%22fieldType%22%3A%22STRING%22%7D%5D%7D'

# 3. §2.3 — confirm the codes filter works with both EQUALS and LIKE
# 4. §3.5 — GET /carts/<random-uuid> and GET /carts/abc; expect 500 for both
# 5. §3.7 — inspect createdAt in a create response: ISO string, or a [y,m,d,...] array?
# 6. §3.3 — POST the same code twice with no delete between; confirm two rows come back
# 7. §3.4 — POST an item with code/name set; confirm CartItemOutputData.name is null
```

## 8. Out of scope

- **The backend changes in §2.2 and §3.6.** This task works within the model as it is.
- Implementing `PUT /carts` properly. Work around it (§4.3); raise it separately.
- Ordering and checkout — `/orders`, `OrderStatus`, `CartStatus.SUBMITTED`. Nothing in this
  task sets a cart to `SUBMITTED`; that transition belongs to the order task, and cannot be
  done from the client anyway (§3.4: `status` is forced to `ACTIVE` on every create).
- Delivery fees, service fees and promotions. The `SERVICE_FEE = 3` constant in
  `app/cart/[id].tsx` stays as-is — there is no backend concept to replace it with, and
  inventing one is worse than an obvious placeholder.
- "Based on your choice" suggestions (`SUGGESTED_ITEMS`) — no recommendations source exists.
  Delete the mock and render nothing.
- Multi-device real-time cart sync. The model here is last-writer-wins per device.
- Persisting addons, per-line notes or prices server-side — impossible until `CartItem`
  grows the `OrderedProduct`-style structure `Order` already has (§3.4).
