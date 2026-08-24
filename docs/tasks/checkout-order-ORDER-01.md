---
suffix: ORDER-01
title: Checkout — fee modals, payment method, and order creation
status: todo
plan: docs/plans/checkout-order-creation-plan.md
depends_on: CART-01
---

# ORDER-01 — Checkout: fee modals, payment method, and order creation

Finish the checkout screen at `app/order-details/[id].tsx`: add the three modals from
`design/`, feed the screen from the real cart, customer and restaurant instead of the
hard-coded `ORDER_DATA`, and create an order through the backend `/orders` controller when
the customer taps **Continue to Checkout**.

Read [`docs/plans/checkout-order-creation-plan.md`](../plans/checkout-order-creation-plan.md)
in full before starting. §2 documents **three backend persistence defects that likely make
order creation with line items impossible today** — understand them before writing code, and
confirm them with the §7 probes if the backend is reachable.

## Dependency — CART-01 must be done first

This task is the end of the chain
[`RESTO-01`](./restaurants-catalog-RESTO-01.md) → [`MENU-01`](./restaurant-products-MENU-01.md)
→ [`CART-01`](./cart-sync-CART-01.md) → **ORDER-01**, and reuses:

- the **jest harness** (RESTO-01 Phase 1) — do NOT reinstall it,
- `pageSchema` and the zod-at-the-boundary convention,
- the cart store, `groupByRestaurant`, and `CART-01`'s `deleteCart` (to clear the backend
  cart after a successful checkout),
- `selectPrice` / `formatAmount` from `services/api/product-view-model.ts` for line totals,
- the restaurant fetch and `RestaurantDetail` view model from RESTO-01,
- `useCustomer` for the customer id, default address and phone,
- `ApiError` / `isApiError` from `services/api/client.ts`.

**Before starting**, verify CART-01 is complete:

```bash
grep "^status:" docs/tasks/cart-sync-CART-01.md
ls schemas/cart.ts services/api/cart-service.ts services/api/cart-view-model.ts hooks/use-cart-sync.ts
npm test
```

If `status:` is not `done`, or those files do not exist, **STOP** and report that ORDER-01 is
blocked on CART-01. Do NOT implement CART-01's scope, and do NOT recreate its files.

## The blocker you must understand (plan §2)

`POST /orders` with a non-empty `items` list is expected to fail with **500**. Three
independent defects in one chain:

1. **No cascade past `OrderItem`.** `Order.items` cascades `ALL`, but `OrderItem.product`
   (`@ManyToOne OrderedProduct`) has no cascade and the populator builds a brand-new
   transient `OrderedProduct` → `TransientPropertyValueException`.
2. **The back-reference is never set.** `Order.items` is `mappedBy = "order"`, but
   `OrderItemsDirectPopulator` never calls `item.setOrder(target)` — the cart module's
   equivalent populator does. So `order_item.order_id` stays `NULL`: the create response
   shows the items, but a re-read returns `items: []`.
3. **`OrderedProductAttribut.product` is `nullable = false` and never populated.** Any order
   carrying addon attributes violates the constraint. `checked` is ignored too.

Plus NPE landmines: both inverse populators and the synchronous `OrderConsumer` dereference
`getRestaurant()`, `getCustomer()` and `.getAddress().getCoordinates()` with no guards. A
customer with no default address **cannot create an order**. The create is `@Transactional`,
so a failure rolls back — no orphan row.

**How you ship anyway:** everything except a persisting order is unblocked. Build the modals,
the real-data checkout screen and the fully-typed, unit-tested order service. Send the
**correct** payload and treat failure as failure.

- **DO NOT** fall back to `items: []` on error — that writes a real but unfulfillable order.
- **DO NOT** auto-retry a failed create (plan §3.6 — the client cannot check whether the
  order landed, so a retry risks a duplicate *delivery*, not just a duplicate row).
- **DO NOT** modify the backend to fix any of this — out of scope (plan §8).
- **DO** implement the plan §4.5 preflight so the likely failure becomes "Add a delivery
  address to continue" instead of an opaque 500.

## Verification status — read this before trusting the contract

Like CART-01, **this plan was written from backend source, not from live requests** — the
Hungry stack was down and could not be started without colliding with an unrelated project
on `5432`. Claims marked **[unverified]** in the plan could behave differently at runtime.

Plan §7 lists eight probes; **probe 3 is decisive** for the §2.1 claim. If the gateway is
reachable when you run, execute them first, record every outcome in your report, and correct
the plan if the backend behaves better than predicted. If it is not reachable, say so
plainly — do not describe a live check as passed.

## Backend contract

```
POST   /orders        -> 201 Created + Location, body = OrderOutputData   (see §2)
GET    /orders/{id}   -> 200 | 500 (not 404) for unknown/malformed ids
GET    /orders/all    -> 200, but EVERY filter is broken or ignored (below)
PUT    /orders        -> 200 with an EMPTY body, writes nothing. NEVER CALL.
DELETE /orders/{id}   -> 204 (hard delete; out of scope)
```

```
OrderInputData { code, name, restaurantId, customerId, comment, items: OrderItemInputData[] }
OrderItemInputData { code, name, quantity, orderedProduct: OrderedProductInputData }
OrderedProductInputData { code, name, productId, attributes: OrderedProductAttributeInputData[] }
OrderedProductAttributeInputData { code, name, attributeId, checked }   // `checked` is IGNORED

OrderOutputData { id, code, name,
                  restaurantId, restaurantCode, restaurantName, pickupLatitude, pickupLongitude,
                  customerId, customerCode, customerFullName, dropoffLatitude, dropoffLongitude,
                  status, items: OrderItemOutputData[], createdAt, comment }
OrderItemOutputData { id, code, name, quantity, product: OrderedProductOutputData }
OrderedProductOutputData { id, code, name, productId, productName, productCode, attributes: [] }
OrderedProductAttributOutputData { id, code, name }   // empty class body — nothing else
```

Asymmetries that will bite:

- input nests **`orderedProduct`**, output nests **`product`**
- `OrderedProductOutputData.id` is the **product's** id, not the ordered-product row's
- `OrderedProductAttributOutputData` does **not** return `attributeId`; its `id` is the
  attribute's id

Filter keys on `/orders/all`:

| Key | Behaviour |
| --- | --- |
| `restaurantIds`, `customerIds` | **500** — `root.get("restaurantId")` on an entity whose field is `restaurant` |
| `statuses` | **500 [unverified]** — bare ORDINAL enum compared to a String |
| `ids`, `codes`, `names` | **silently ignored** — 200 with *unfiltered* results. `OrderSpecificationPopulator` never copies them |

That last row is why order history is out of scope: there is no way to ask for one
customer's orders, and no ownership enforcement anywhere in the request path.

Other fixed behaviour:

- `status` on input is ignored — always forced to `CREATED`
- **no payment field, no price/fee/total field** exists anywhere on `Order` or `OrderItem`;
  grepping the whole backend for `payment` returns zero files
- a successful create **enqueues the order for driver assignment** (`OrderConsumer`), so a
  duplicate order is a duplicate delivery
- failure bodies say only `"A populator has failed (N errors occurred)"` — never relay the
  server message to the user

`customerId` is the backend `Customer.id` UUID from `useCustomer(user.sub).data.id` — not
the Keycloak `sub`.

## Designs

Three PNGs in `design/`. Read all three before building:

| File | What it shows |
| --- | --- |
| `Cart Service Fee Info.png` | Bottom sheet over the cart: title "Service Fee", one paragraph, full-width orange "Close" button |
| `Cart Delivery Fee Info.png` | Same sheet, title "Delivery Fee", near-identical copy |
| `Order Details - Payment Method.png` | Bottom sheet over order details: title "Payment Method", four rows with icons — Cash (checked), Hungry Points, Bank, SIM Credits — then "Close" |

`components/ui/bottom-sheet.tsx` **already matches these designs** — drag handle, rounded
top, dimmed backdrop, swipe-to-dismiss. `components/restaurant/timings-modal.tsx` is the
precedent for composing it.

- **DO NOT** add a sheet library or hand-roll another modal.
- **DO NOT** duplicate the sheet chrome per modal — build one `InfoSheet` for the two fee
  sheets.

## Phases

Use TodoWrite with one todo per phase. Mark each complete immediately on finishing it,
never batched.

### Phase 1 — Fee constants

Create `constants/fees.ts`:

```ts
export const SERVICE_FEE = 3;        // DT — placeholder, no backend concept (plan §3.3)
export const DELIVERY_FEE = 2.5;     // DT — placeholder
export const DELIVERY_FEE_WAIVED = true;
```

Replace the inlined `SERVICE_FEE = 3` in `app/cart/[id].tsx` with this import. Add a comment
naming the plan section, so there is one place to delete when a pricing service exists.

**DO NOT** invent a fees endpoint or derive fees from distance.

### Phase 2 — The shared info sheet and the two fee modals

Create `components/ui/info-sheet.tsx`: `{ visible, title, body, onClose }` on top of
`BottomSheet`, with the orange full-width Close button from the designs
(`Palette.primary`, the button radius used by other primary CTAs).

Create `components/checkout/service-fee-modal.tsx` and
`components/checkout/delivery-fee-modal.tsx` as thin wrappers with the copy **transcribed
verbatim from its own PNG** — the two paragraphs differ ("delivery cost" vs "service cost"),
so do not share one string.

Add `components/checkout/index.ts` as a barrel, matching `components/cart/index.ts`.

**Tests** (`components/checkout/__tests__/`): each modal renders its title and body when
`visible`; renders nothing when not; `Close` calls `onClose`.

### Phase 3 — Payment method store and modal

Create `store/payment-method-store.ts` — a persisted Zustand store in the style of
`store/customer-store.ts`, holding `method: PaymentMethodId` defaulting to `'cash'`.

```ts
export type PaymentMethodId = 'cash' | 'points' | 'bank' | 'sim';
```

Create `components/checkout/payment-method-modal.tsx`: the four options in design order with
`lucide-react-native` icons, a check mark on the selected row, and the Close button.

Under the list, add **one plain line** stating that only Cash is settled on delivery and the
other methods are not yet processed. Nothing in the backend charges anything (plan §3.3), and
the UI must not imply otherwise.

**Tests**: renders all four options; the check mark sits on the selected one; tapping a row
calls `onSelect` with the right id; `Close` calls `onClose`.

### Phase 4 — Schemas

Create `schemas/order.ts` in the style of `schemas/cart.ts`.

- `orderStatusSchema` = `z.enum(['CREATED','CONFIRMED','PREPARING','READY','CANCELLED'])`,
  `.nullish()` at use sites — an unknown status must not fail the whole parse.
- `orderedProductAttributeOutputSchema`, `orderedProductOutputSchema`,
  `orderItemOutputSchema`, `orderOutputSchema`. Everything `.nullish()` except `id`.
- `.catch([])` on `items` and `attributes`.
- Model the **output** nesting as `product`, not `orderedProduct` — they differ.
- Input types are hand-written interfaces, not schemas.
- Reuse `pageSchema`; do NOT copy it.

**Tests** (`schemas/__tests__/order.test.ts`): a full order parses; `{id}` alone parses with
`items` defaulting to `[]`; an item whose `product.attributes` is null parses; an unknown
status does not discard the rest of the order; missing `id` fails with `id` in the path.

### Phase 5 — Order view model

Create `services/api/order-view-model.ts`:

```ts
export function toOrderInput(args: {
  customerId: string; restaurantId: string; restaurantName: string;
  lines: CartLine[]; paymentMethod: PaymentMethodId; cartComment?: string;
}): OrderInput;

export function buildOrderComment(paymentMethod: PaymentMethodId, cartComment?: string): string;

export type CheckoutBlocker =
  | 'no-customer' | 'no-address' | 'no-address-coords'
  | 'no-restaurant' | 'no-restaurant-coords' | 'empty-cart';

export function checkoutBlockers(args): CheckoutBlocker[];
```

`toOrderInput` must:

- Map each cart line to `{ quantity, orderedProduct: { productId, attributes } }`, with
  `attributes` as `[{ attributeId, checked: true }]` from the line's selected addons and
  `[]` (never `undefined`) when there are none.
- Unlike `CART-01`'s `toCartInput`, **do NOT collapse lines by product id** — the order model
  has per-line `attributes`, so two differently-configured lines of the same product are two
  distinct items. Add a comment contrasting the two, because the difference is easy to get
  backwards.
- Drop lines with `quantity <= 0`.
- Always set a non-empty `code` (one unique value per checkout attempt) and `name`.
- Set `comment` from `buildOrderComment`.
- Never set `status`, and never emit a price, fee, total or `paymentMethod` key.

`checkoutBlockers` implements plan §4.5. Keep `no-address` and `no-address-coords` distinct —
they route the user to different fixes.

**Tests** (`services/api/__tests__/order-view-model.test.ts`): quantities and product ids map
correctly; addons become `attributes[].attributeId`; a line with no addons emits `[]`; two
differently-configured lines of the same product stay **two** items; `quantity: 0` is
dropped; the payload has a non-empty `code`, `restaurantId` and `customerId`; the payload
contains no `status`/`price`/`total`/`paymentMethod` key. For `checkoutBlockers`: each of the
six fires in isolation; a valid input returns `[]`; an address with null coordinates gives
`no-address-coords`, not `no-address`. For `buildOrderComment`: payment label alone; payment
label plus a cart comment; a multi-line cart comment survives intact.

### Phase 6 — Service layer and hooks

Create `services/api/order-service.ts`:

```ts
export async function createOrder(input: OrderInput): Promise<Order>
export async function fetchOrderById(id: string): Promise<Order | null>
```

- Parse every response through the Phase 4 schemas; on parse failure throw an `ApiError`
  naming the offending field path.
- **Treat a 2xx with an empty body as a failure**, not a success — that is the `PUT` no-op
  signature and the check costs one line.
- Treat 500 on a well-formed UUID read as not-found; guard reads behind a UUID-shape check.
- Never relay the raw server message to the user; it says only "A populator has failed"
  (plan §3.7). Map failures to the app's own wording.
- **NEVER** call `PUT /orders`. **NEVER** send a `restaurantIds`, `customerIds` or `statuses`
  filter. Do not use `/orders/all` at all in this task.

Add `orderKeys` to `services/api/query-keys.ts`, mirroring `cartKeys`.

Create `hooks/use-orders.ts`:

- `useCreateOrder()` — **`retry: false`** (plan §3.6). On success: clear that restaurant's
  cart group locally and delete its backend cart via `CART-01`'s `deleteCart`, store the
  created order id locally, and navigate to a confirmation. On failure: leave the cart
  completely intact.
- `useOrder(id)` — `enabled: !!id`, `retry: false`.

**Tests** (`services/api/__tests__/order-service.test.ts`): assert the request body shape;
assert a 200 with an empty body throws; assert a schema-invalid response throws `ApiError`;
assert a 500 read on a valid UUID returns `null`; assert no `put` call and no broken filter
key ever appears in a request; assert the mutation does not retry after a 500.

### Phase 7 — Checkout screen

Rewrite `app/order-details/[id].tsx`. The route param `id` is a **restaurant id**.

- **Delete `ORDER_DATA` entirely.** Source every field per plan §4.3: restaurant from
  RESTO-01, items and subtotal from the cart group, address and phone from `useCustomer`,
  payment from the store, fees from `constants/fees.ts`.
- **Omit the estimated-time and arrival-time rows.** No ETA, prep-time or estimate field
  exists anywhere in the backend — follow RESTO-01's `UNBACKED_FIELDS` convention and render
  nothing rather than an invented number.
- **Fix the existing label bug**: the totals row reads `Delivery Fee` but shows the total. It
  must read `Total`.
- Wire the `Info` icon on the Service Fee and Delivery Fee rows to the Phase 2 sheets.
- Wire the payment row (its `paymentDropdown` placeholder is currently a zero-width `View`)
  to the Phase 3 modal, showing the selected method.
- Run `checkoutBlockers` and disable **Continue to Checkout** while any blocker is present,
  showing the reason next to the button. `no-address` / `no-address-coords` route to the
  existing address flow instead of showing an error.
- On submit, call `useCreateOrder`. Show a pending state; on failure keep the cart and offer
  a **manual** retry only.

Also update `app/cart/[id].tsx` and `components/cart/order-summary.tsx`: add
`onServiceFeeInfo` / `onDeliveryFeeInfo` callbacks and open the same sheets there — the two
fee designs are drawn over the cart screen.

Use `constants/theme` tokens, `PressableScale` over `TouchableOpacity` in new code, and
double-quoted imports in `components/`.

### Phase 8 — Verification

```bash
npx tsc --noEmit          # must be 0 errors
npm test                  # all tests pass
npx eslint .              # no new errors
```

Confirm the mock is gone and the forbidden calls are absent:

```bash
grep -rn "ORDER_DATA" app --include=*.tsx
grep -rn "put(" services/api/order-service.ts
grep -rn "restaurantIds\|customerIds\|statuses\|/orders/all" services/api/order-service.ts
```

All three must return **no matches**.

Confirm the fee constants have one home:

```bash
grep -rn "SERVICE_FEE = \|DELIVERY_FEE = " app components constants --include=*.ts --include=*.tsx
```

Must match **only** `constants/fees.ts`.

If the gateway is reachable, run the plan §7 probes — **probe 3 is decisive** — and report
what each returned. If it is not reachable, say so plainly.

## Definition of done

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm test` → all pass, including every `toOrderInput` and `checkoutBlockers` case
- [ ] `npx eslint .` → no new errors
- [ ] All four Phase 8 greps return the expected results
- [ ] All three modals match their design and reuse `BottomSheet`
- [ ] `ORDER_DATA` is gone; every visible value has a real source or is omitted
- [ ] The totals row is labelled `Total`, not `Delivery Fee`
- [ ] `PUT /orders` is called nowhere; `/orders/all` is used nowhere
- [ ] The create mutation does not auto-retry, and never falls back to `items: []`
- [ ] A failed checkout leaves the cart completely intact
- [ ] A successful checkout clears that restaurant's local **and** backend cart, and leaves
      other restaurants' carts untouched
- [ ] No `any` introduced; no hand-written type duplicating a zod output schema
- [ ] The UI never implies a payment was processed

## Constraints

- **DO NOT** modify anything under `C:\projects\hungry-web\hungry-backend`.
- **DO NOT** implement CART-01's, MENU-01's or RESTO-01's scope. If CART-01 is not done, STOP.
- **DO NOT** call `PUT /orders` — 200 OK, empty body, writes nothing.
- **DO NOT** use `/orders/all`; every filter on it is broken or silently ignored.
- **DO NOT** auto-retry a failed order create — a duplicate order is a duplicate delivery.
- **DO NOT** fall back to `items: []` when a create fails.
- **DO NOT** collapse order items by product id (that rule belongs to carts, not orders).
- **DO NOT** relay the raw server error message to the user.
- **DO NOT** invent an ETA, a fees endpoint, or a payment integration.
- **DO NOT** add a new bottom-sheet library or hand-roll another modal.
- **DO NOT** implement order history, tracking, cancellation, promotions or loyalty.
- **DO NOT** commit or push unless explicitly asked.
- Match surrounding code: double-quoted imports in `components/`, `constants/theme` tokens
  over literal colours, `PressableScale` over `TouchableOpacity` in new code.

## Report

On completion, report: files created and modified; the exact output of the three
verification commands; whether the plan §7 probes were run and **exactly what probe 3
returned** (or that the backend was unreachable); which **[unverified]** claims you confirmed
or corrected; what the app does today when checkout fails; and a clear restatement of the
five backend changes from plan §2.5 that would make order creation actually work.
