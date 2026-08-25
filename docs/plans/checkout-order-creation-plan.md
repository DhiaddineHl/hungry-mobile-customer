# Plan — Checkout: Fee Modals, Payment Method, and Order Creation

**Status:** UI ready for implementation; order creation blocked on backend defects, see §2
**Task file:** [`docs/tasks/checkout-order-ORDER-01.md`](../tasks/checkout-order-ORDER-01.md) — trigger with `/task "ORDER-01"`
**Depends on:** [`CART-01`](../tasks/cart-sync-CART-01.md) — must be `status: done` first (chain: `RESTO-01` → `MENU-01` → `CART-01`)
**Date:** 2026-08-23
**Backend studied:** `C:\projects\hungry-web\hungry-backend` @ `0e5bb3c`
**Designs:** `design/Cart Service Fee Info.png`, `design/Cart Delivery Fee Info.png`, `design/Order Details - Payment Method.png`

> **Verification note.** Like `CART-01`, this plan is **derived from backend source only** —
> the Hungry stack was not running and could not be started without colliding on `5432`
> with an unrelated project. Every claim cites the class and mechanism it comes from.
> Claims marked **[unverified]** are the ones that could behave differently at runtime.
> §7 lists the probes that settle them. This matters more here than in any previous task:
> §2 argues that `POST /orders` **cannot currently succeed with line items**, and that
> conclusion must be confirmed against a live backend before anyone acts on it.

---

## 1. Goal

Finish the checkout screen at `app/order-details/[id].tsx`, which today renders entirely
from a hard-coded `ORDER_DATA` constant:

1. Add the three modals from `design/` — **Service Fee info**, **Delivery Fee info**, and
   **Payment Method** selection.
2. Feed the screen from the real cart, customer and restaurant instead of the mock.
3. On **Continue to Checkout**, create an order through the backend `/orders` controller.

The route param `id` is a **restaurant id**, not an order id — `app/cart/[id].tsx` pushes
`/order-details/[id]` with the restaurant's id. One checkout screen covers one restaurant
cart, which matches the one-cart-per-restaurant rule `CART-01` established.

## 2. The blocker: `POST /orders` cannot currently persist line items

> **RESOLVED 2026-08-25 — fixed in `hungry-backend`, verified live.** Everything below is
> kept as the record of what was wrong. What §7's probes actually found:
>
> - The first failure was **not** §2.1. Every create died earlier, in the dispatch
>   listener: `TraceabilityModel.createdAt` is `@CreatedDate`, but nothing in the backend
>   was annotated `@EnableJpaAuditing`, so `created_at` was NULL in *every* table and
>   `DefaultPriorityCalculatorService.calculate` NPE'd on it inside the `@Transactional`
>   create. Fixed by `org.jfwk.core.infrastructure.config.JpaAuditingConfig`, plus a null
>   guard in the calculator.
> - §2.1 and §2.2 were real and are fixed: `OrderItem.product` now cascades PERSIST/MERGE,
>   and `OrderItemsDirectPopulator` sets the `order` back-reference.
> - §2.3 is fixed differently than proposed: `OrderedProductAttribut` gained an
>   `orderedProduct` back-reference (the collection is now `mappedBy` + cascaded), and
>   `OrderedProductDirectPopulator` sets both `orderedProduct` and the NOT NULL `product`.
>   `checked` is still ignored — there is no column for it (see below).
> - One defect the plan missed: `OrderedProduct.product` was `@OneToOne`, so `product_id`
>   carried a UNIQUE constraint and the **second** order of any dish failed with a
>   duplicate key. Now `@ManyToOne`; the stale constraint has to be dropped in any database
>   created before the change.
> - Also missed: **nothing mapped `comment`** in either direction, so the payment method
>   `buildOrderComment` records was silently discarded. Now populated both ways.
> - §2.4's NPE landmines are untouched: a customer or restaurant with no address still
>   fails the create, which is what `checkoutBlockers` exists to prevent client-side.
> - Still true: item-level `code`/`name` are not copied by the item converters, so they
>   read back null. The app does not use them.

This is the central finding, and it is more serious than the gaps in `CART-01`. The order
aggregate has **three independent persistence defects** in one chain, plus a set of NPE
landmines in the response path. They are described below with the exact code that causes
each.

### 2.1 The persistence chain has no cascade past `OrderItem`

```
Order  --cascade = ALL-->  OrderItem  --no cascade-->  OrderedProduct  --no cascade-->  OrderedProductAttribut
```

```java
// Order.java
@OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
private List<OrderItem> items;

// OrderItem.java
@ManyToOne
private OrderedProduct product;        // no cascade

// OrderedProduct.java
@OneToMany
private List<OrderedProductAttribut> attributes;   // no cascade, no mappedBy
```

`OrderedProductBasePopulator` builds a **brand-new transient `OrderedProduct`** for every
item. When Hibernate cascades `Order → OrderItem` and reaches `OrderItem.product`, that
`OrderedProduct` has never been persisted and nothing cascades to it — the classic
`TransientPropertyValueException: object references an unsaved transient instance`.

**Expected result: `POST /orders` with a non-empty `items` list fails with 500.**
**[unverified — this is the single most important thing to confirm live.]**

### 2.2 The `OrderItem` back-reference is never set

`Order.items` is `mappedBy = "order"`, so `OrderItem.order` is the owning side. But:

```java
// OrderItemsPopulator.OrderItemsDirectPopulator
List<OrderItem> items = source.getItems().stream()
        .map(orderItemDirectConverter::convert)
        .toList();
target.setItems(items);          // item.setOrder(target) is never called
```

Compare the cart module, written by the same team, which gets it right:

```java
// CartItemsPopulator.CartItemsDirectPopulator
items.forEach(item -> item.setCart(target));      // <-- Order has no equivalent
target.setItems(items);
```

So even if §2.1 were fixed, `order_item.order_id` stays `NULL`. The **create response would
still show the items** (the converter reads the in-memory list inside the same persistence
context), but a later `GET /orders/{id}` would return **`items: []`**. A client that trusts
the create response and never re-reads would never notice.

### 2.3 `OrderedProductAttribut.product` is NOT NULL and never populated

```java
// OrderedProductAttribut.java
@ManyToOne(optional = false)
@JoinColumn(name = "product_id", nullable = false)
private Product product;

// OrderedProductAttributeBasePopulator.OrderedProductAttributeDirectBasePopulator
public void populate(OrderedProductAttributeInputData source, OrderedProductAttribut target) {
    if (source.getAttributeId() != null) { ... target.setAttribute(attribute); }
    // target.setProduct(...) is never called
}
```

Dev runs `spring.jpa.hibernate.ddl-auto=create`, so the schema comes from these annotations
and that `NOT NULL` is real. Any order carrying addon attributes violates it.

`OrderedProductAttributeInputData.checked` is also read by nothing — the populator ignores
it, so an unchecked attribute is indistinguishable from a checked one.

### 2.4 NPE landmines in the response and event paths

Even an order with no items can fail, because both inverse populators dereference without
guards:

```java
// OrderRestaurantPopulator.OrderRestaurantInversePopulator
var restaurant = source.getRestaurant();
target.setRestaurantId(restaurant.getId().toString());        // NPE if restaurantId was omitted
var coords = restaurant.getAddress().getCoordinates();        // NPE if address is null

// OrderCustomerPopulator.OrderCustomerInversePopulator
target.setCustomerFullName(customer.getFullname().assemble());
var coords = customer.getAddress().getCoordinates();          // NPE if address is null
```

`Address` is `@Embedded` on `Person`, and Hibernate materialises an all-null embeddable as
`null`. So **a customer who never completed address onboarding cannot create an order** —
`customer.getAddress()` is `null` and the create 500s.

A third copy of the same dereference sits in the dispatch listener, which is a **plain
synchronous `@EventListener`** and is enabled in dev
(`delivery.hungry.order.crud.event-publishing-enabled=true`):

```java
// OrderConsumer.toOrderInfo
GeoCoordinates pickup  = order.getRestaurant().getAddress().getCoordinates();
GeoCoordinates dropoff = order.getCustomer().getAddress().getCoordinates();
```

It runs inside `DefaultCrudService.create`, which is `@Transactional`, so a throw here rolls
the whole create back. **The good news:** that means a failed create leaves no orphan row —
the client will not silently create half an order.

One more: `GeoCoordinates.latitude` is a boxed `Double`, while `OrderOutputData.pickupLatitude`
is a primitive `double`. `setPickupLatitude(coords.getLatitude())` unboxes, so coordinates
present but null-valued give yet another NPE.

### 2.5 What the backend team needs to change

In `delivery.hungry.order`, mirroring what `delivery.hungry.cart` already does correctly:

1. `OrderItem.product` → `@ManyToOne(cascade = CascadeType.PERSIST)` (or persist
   `OrderedProduct` explicitly before the order).
2. `OrderedProduct.attributes` → add a cascade, and make the relationship owned
   (`mappedBy` + a back-reference), as `Order.items` is.
3. `OrderItemsDirectPopulator` → `items.forEach(item -> item.setOrder(target));`
4. `OrderedProductAttributeDirectBasePopulator` → set `product` as well as `attribute`, and
   honour `checked`.
5. Null-guard `getRestaurant()`, `getCustomer()`, `getAddress()` and the boxed coordinates
   in both inverse populators and in `OrderConsumer`, or reject the input with a 400 before
   reaching them.

Items 1–4 are what make an order with line items possible at all. **Do not attempt any of
this from this repository.**

### 2.6 How this task ships anyway

Split the work by what the backend gates:

| Deliverable | Gated by §2? |
| --- | --- |
| Service Fee modal, Delivery Fee modal, Payment Method modal | **No** — ship fully |
| Checkout screen fed by the real cart, customer and restaurant | **No** — ship fully |
| Real subtotal / fees / total from cart lines | **No** — ship fully |
| `order-service.ts` + `useCreateOrder`, typed and unit-tested | **No** — ship fully |
| An order that actually persists with its items | **Yes** — §2.1–§2.3 |

So the client sends the **correct payload per the documented contract** — items and
attributes included — and treats a failure as a failure. Specifically:

- **Do not** degrade to `items: []` on error. That would write a real but meaningless order
  row, and the customer would see success for an order no restaurant can fulfil.
- **Do not** auto-retry a failed create (see §3.6 — the client cannot reliably check whether
  an order landed, so a retry risks duplicates).
- **Do** run a preflight that catches the §2.4 preconditions client-side, so the common
  failure (customer has no address) becomes a clear "add a delivery address" prompt instead
  of an opaque 500.

## 3. Ground truth — from backend source

### 3.1 Endpoints

| Method | Path | Works? | Notes |
| --- | --- | --- | --- |
| `POST` | `/orders` | **see §2** | 201 Created + `Location`; body = `OrderOutputData` |
| `GET` | `/orders/{id}` | yes | 500 (not 404) for unknown/malformed ids |
| `GET` | `/orders/all` | yes, but **unfilterable** — see §3.5 | flat `PageImpl` envelope |
| `PUT` | `/orders` | **no-op** | `OrderCrudService` does not override `update`; identical to the cart defect in `CART-01` §2.1 — 200, empty body, writes nothing |
| `DELETE` | `/orders/{id}` | yes | 204 |

`OrderCrudService.updateStatus(id, status)` exists but **is exposed by no REST endpoint**.
There is no way for this app to advance or cancel an order.

### 3.2 Shapes

```
OrderInputData                          OrderOutputData
  code       string                       id, code, name
  name       string                       restaurantId, restaurantCode, restaurantName
  restaurantId  string  (UUID)            pickupLatitude, pickupLongitude    (double)
  customerId    string  (UUID)            customerId, customerCode, customerFullName
  comment       string                    dropoffLatitude, dropoffLongitude  (double)
  items      OrderItemInputData[]         status   'CREATED'|'CONFIRMED'|'PREPARING'|'READY'|'CANCELLED'
                                          items    OrderItemOutputData[]
OrderItemInputData                        createdAt, comment
  code, name
  quantity        int                   OrderItemOutputData
  orderedProduct  OrderedProductInputData  code, name, quantity
                                           product: OrderedProductOutputData
OrderedProductInputData
  code, name                            OrderedProductOutputData
  productId   string (UUID)               id, code, name           <- id is the PRODUCT id
  attributes  OrderedProductAttributeInputData[]   productId, productName, productCode
                                           attributes: OrderedProductAttributOutputData[]
OrderedProductAttributeInputData
  code, name                            OrderedProductAttributOutputData
  attributeId string (UUID)               id, code, name  — and NOTHING else.
  checked     boolean  (ignored)          The class body is empty; `attributeId` is not
                                          returned, and `id` is overwritten with the
                                          attribute's id by the populator.
```

Note the asymmetry: input nests `orderedProduct`, output nests `product`. And
`OrderedProductInversePopulator` sets `target.setId(source.getProduct().getId())` — so
`OrderedProductOutputData.id` is the **product's** id, not the ordered-product row's.

`customerId` is the backend `Customer.id` UUID from `useCustomer(user.sub).data.id` — not
the Keycloak `sub`. Same rule as `CART-01`.

### 3.3 Status is forced, and there is no payment or money anywhere

`OrderBasePopulator` hard-codes `target.setStatus(OrderStatus.CREATED)` on every create, so
a client-supplied status is ignored — exactly as `CartBasePopulator` forces `ACTIVE`.

More importantly:

- **Grepping the entire backend (case-insensitive) for `payment` returns zero files.**
  There is no payment method, no payment status, no transaction, no provider integration.
- **`Order` and `OrderItem` carry no price, fee, amount, subtotal or total field**, and
  grepping the order and delivery modules for `fee` returns nothing.

So the Payment Method modal is a **local preference**, and every number on the checkout
screen is computed on the device. The one place a payment choice can be recorded is the
order's free-text `comment` — see §4.4.

### 3.4 Creating an order enqueues it for driver assignment

`OrderConsumer.onOrderCreated` listens for `ModelCreatedEvent<Order>`, computes a priority
and offers the order to the dispatch `OrderQueue`. This is live in dev
(`delivery.hungry.order.crud.event-publishing-enabled=true`). So a successful create is not
inert — it enters the assignment engine. Two consequences: a duplicate order is a
real-world duplicate delivery, not just a stray row; and the §2.4 NPE in this listener
aborts the create.

### 3.5 `/orders/all` has no working filter at all

Two separate defects:

```java
// OrderSpecification — Order has `restaurant` and `customer` ASSOCIATIONS,
// and no `restaurantId` / `customerId` attribute. Both throw IllegalArgumentException.
predicates = addFilterPredicate(predicates, restaurantIds, "restaurantId", root, criteriaBuilder);
predicates = addFilterPredicate(predicates, customerIds,   "customerId",   root, criteriaBuilder);
```

```java
// OrderSpecificationPopulator — compare CartSpecificationPopulator, which copies all three.
public void populate(OrderFilter source, OrderSpecification target) {
    target.setCustomerIds(source.getCustomerIds());
    target.setRestaurantIds(source.getRestaurantIds());
    target.setStatuses(source.getStatuses());
    // ids / codes / names from CoreModelFilter are NEVER copied
}
```

| Filter key | Behaviour |
| --- | --- |
| `restaurantIds`, `customerIds` | **500** — same bug class as the cart `customerIds` filter |
| `statuses` | **500 [unverified]** — bare ORDINAL enum compared to a String |
| `ids`, `codes`, `names` | **silently ignored** — the request succeeds and returns *unfiltered* results |

The third row is the dangerous one: it is not an error. A client filtering orders by `codes`
gets **every customer's orders** back and has no signal that the filter did nothing. And
there is no ownership enforcement in the request path (`CART-01` §3.6 — `anyRequest()
.authenticated()` at both the gateway and hungry-app; zero `@PreAuthorize` in the backend).

**Consequence: server-side "my orders" is impossible.** This task therefore records created
order ids locally and reads them individually via `GET /orders/{id}`. Order history is out
of scope (§8).

### 3.6 A failed create is ambiguous, and cannot be resolved by lookup

`code` is client-supplied on orders as on carts, so a checkout attempt can carry a unique
code. But because the `codes` filter is silently ignored (§3.5), the client **cannot look up
"did my order land?"** — it would have to page all orders and match client-side, which
returns other customers' data and is not acceptable as a routine path.

Therefore: on a network timeout or an ambiguous 5xx, **do not auto-retry**. Surface the
failure and require an explicit user action. `query-client.ts` retries 5xx twice by default,
so the create mutation must set `retry: false`.

### 3.7 Error bodies are nearly useless

`PopulatingConverter` catches every populator exception, collects them, and rethrows:

```java
throw new ConverterException(exceptions.size() == 1 ? "A populator has failed" : "Multiple populators failed", exceptions);
```

The underlying causes are attached as *suppressed* exceptions, not folded into the message.
Dev sets `server.error.include-message=always`, so the client sees roughly
`"A populator has failed (1 errors occurred)"` — which names neither the field nor the
reason. Prod does not set it, so there the message is empty.

`OrderControllerAdvice` registers only the filter editor — **no `@ExceptionHandler` at
all** — so unknown ids, malformed UUIDs and populator failures are all 500.

The client must therefore supply its own diagnosis via the §4.5 preflight rather than
relaying the server message.

## 4. Architecture

### 4.1 The three modals

All three reuse the existing `components/ui/bottom-sheet.tsx`, which already matches the
designs — drag handle, rounded top corners, dimmed backdrop, tap-outside and swipe-down to
dismiss. `components/restaurant/timings-modal.tsx` is the precedent to copy.

**Do not add a new sheet library or hand-roll another modal.**

| Modal | Design | Content |
| --- | --- | --- |
| `ServiceFeeModal` | `Cart Service Fee Info.png` | Title "Service Fee", one paragraph, orange "Close" button |
| `DeliveryFeeModal` | `Cart Delivery Fee Info.png` | Title "Delivery Fee", one paragraph, orange "Close" button |
| `PaymentMethodModal` | `Order Details - Payment Method.png` | Title "Payment Method", four options with icons, a check on the selected one, orange "Close" button |

The two fee sheets are the same component with different copy; build one `InfoSheet` with
`title` / `body` props rather than duplicating. The copy in both designs is nearly identical
("This fee helps cover delivery cost. / …service cost. The amount varies for each store
based on things like your location and availability of nearby couriers.") — transcribe each
verbatim from its own design rather than sharing one string.

The designs place these sheets over the **cart** screen and the **order-details** screen
respectively. The fee rows already exist on both `app/cart/[id].tsx` (via
`components/cart/order-summary.tsx`) and `app/order-details/[id].tsx`; wire the `Info` icon
on each row to open the matching sheet in both places.

Payment options, in design order: **Cash** (selected by default), **Hungry Points**,
**Bank**, **SIM Credits**.

### 4.2 Fees are client constants, and must look like it

There is no fee concept in the backend (§3.3). Put the numbers in one module —
`constants/fees.ts` — with a comment stating they are placeholders with no backend source,
so there is exactly one place to delete when a pricing service exists:

```ts
export const SERVICE_FEE = 3;          // DT — placeholder, no backend concept
export const DELIVERY_FEE = 2.5;       // DT — placeholder
export const DELIVERY_FEE_WAIVED = true;
```

This replaces the `SERVICE_FEE = 3` currently inlined in `app/cart/[id].tsx`. Do **not**
invent a fees endpoint, and do not derive fees from distance — OSRM routing exists in the
backend but is wired to driver assignment, not to customer pricing.

### 4.3 The checkout screen's data sources

`ORDER_DATA` is deleted entirely and replaced by:

| Field | Real source |
| --- | --- |
| restaurant name, logo | `RESTO-01` restaurant fetch, by the route's `id` |
| items, item count, subtotal | `CART-01` cart store group for that `restaurantId` |
| address label, text, lat/lng | the customer's default address (`useCustomer` → top-level `address`) |
| phone | `useCustomer` → `contact.phones[0]` |
| payment method | the local payment store (§4.4) |
| service fee, delivery fee, total | `constants/fees.ts` + the cart subtotal |
| estimated time, arrival time | **no backend source** — see below |

`estimatedTime` (`~45 min`) and `arrivalTime` (`Arrives at 12:00`) have no backing data:
there is no ETA, prep-time or delivery-estimate field anywhere on `Order`, `Restaurant` or
the delivery module. Follow the `UNBACKED_FIELDS` convention `RESTO-01` established — omit
the row rather than shipping an invented number.

There is also a **pre-existing bug** in the screen: the totals row is labelled
`Delivery Fee` but displays `ORDER_DATA.total`. It should read `Total`.

### 4.4 Payment method: local preference, recorded in `comment`

A tiny persisted Zustand store (`store/payment-method-store.ts`) holds the selection —
same shape as the other stores in `store/`. It cannot be sent as a field because none
exists.

The one place it can be recorded is the order's free-text `comment`, which is a real
persisted column and is the only channel to whoever fulfils the order:

```
comment = "Payment: Cash" + (cart comment ? "\n" + cart comment : "")
```

This is a workaround, not a payment integration, and the code must say so. **Nothing
charges anything.** Selecting "Bank" does not move money, and the UI must not suggest it
does — the task adds one plain line of disclosure under the option list.

### 4.5 Preflight before submitting

Because a 500 tells the user nothing (§3.7), check the §2.4 preconditions on the device
first and turn each into a specific, actionable message:

```ts
type CheckoutBlocker =
  | 'no-customer'          // customer record not resolved yet
  | 'no-address'           // customer has no default address -> the most likely failure
  | 'no-address-coords'    // address present but latitude/longitude missing
  | 'no-restaurant'        // restaurant did not resolve
  | 'no-restaurant-coords' // restaurant has no coordinates
  | 'empty-cart';

function checkoutBlockers(args): CheckoutBlocker[];
```

`no-address` and `no-address-coords` route the user to the existing address flow rather than
showing an error. The Continue button is disabled while any blocker is present, with the
reason shown next to it.

This is the difference between "Something went wrong" and "Add a delivery address to
continue" for what is likely the most common failure in practice.

### 4.6 Submitting

```ts
export async function createOrder(input: OrderInput): Promise<Order>
export function useCreateOrder()   // retry: false — see §3.6
```

On success: clear that restaurant's cart group (local **and** its backend cart, via
`CART-01`'s `deleteCart`), store the order id locally, and navigate to a confirmation.

On failure: keep the cart intact, show the failure, and offer a manual retry only. Never
auto-retry, never fall back to `items: []`, and never report success on a 200-with-empty-body
(that is the `PUT` no-op signature, and a defensive check costs one line).

## 5. Files

**New**

| File | Purpose |
| --- | --- |
| `components/ui/info-sheet.tsx` | Shared title + body + Close sheet, built on `BottomSheet` |
| `components/checkout/service-fee-modal.tsx` | Service Fee copy |
| `components/checkout/delivery-fee-modal.tsx` | Delivery Fee copy |
| `components/checkout/payment-method-modal.tsx` | Four options, check mark, Close |
| `components/checkout/index.ts` | Barrel, matching `components/cart/index.ts` |
| `constants/fees.ts` | The placeholder fee constants |
| `store/payment-method-store.ts` | Persisted payment selection |
| `schemas/order.ts` | zod schemas + inferred types for `OrderOutputData` and its nesting |
| `services/api/order-service.ts` | `createOrder`, `fetchOrderById` |
| `services/api/order-view-model.ts` | `toOrderInput`, `checkoutBlockers`, `buildOrderComment` |
| `hooks/use-orders.ts` | `useCreateOrder`, `useOrder` |

**Modified**

| File | Change |
| --- | --- |
| `app/order-details/[id].tsx` | Delete `ORDER_DATA`; real data; three modals; submit; fix the `Delivery Fee`/`Total` label bug |
| `app/cart/[id].tsx` | Fee info sheets on the summary rows; import fees from `constants/fees.ts` |
| `components/cart/order-summary.tsx` | `onServiceFeeInfo` / `onDeliveryFeeInfo` callbacks |
| `services/api/query-keys.ts` | Add `orderKeys` |
| `store/cart-store.ts` | Clear a restaurant group on successful checkout |

## 6. Testing

Priorities, highest value first:

1. **`toOrderInput`** — cart lines map to `items[].orderedProduct.productId` with the right
   quantities; addon selections map to `attributes[].attributeId`; a line with no addons
   emits `attributes: []` (not `undefined`); `quantity <= 0` lines are dropped; the payload
   carries `restaurantId`, `customerId` and a non-empty `code`; it never contains a
   `status`, `price`, `total` or `paymentMethod` key.
2. **`checkoutBlockers`** — each of the six blockers fires in isolation; a fully valid input
   returns `[]`; a customer with an address but null coordinates returns
   `no-address-coords`, not `no-address` (they route to different fixes).
3. **`buildOrderComment`** — payment label alone; payment label plus a cart comment; a cart
   comment containing a newline is not mangled.
4. **Fee arithmetic** — subtotal from cart lines including addon prices; total = subtotal +
   service fee + (waived ? 0 : delivery fee); an empty cart totals `0` and blocks checkout.
5. **`createOrder`** — asserts the request shape; asserts `retry: false` on the mutation;
   asserts a 200-with-empty-body is treated as a failure, not a success; asserts a
   schema-invalid response throws `ApiError`; asserts no auto-retry after a 500.
6. **Modals** — each renders its title and copy; the payment modal shows the check on the
   selected option and calls `onSelect` with the right id; `Close` calls `onClose`.
7. **Success path** — a successful create clears that restaurant's cart group and leaves
   another restaurant's group untouched.
8. **Failure path** — a failed create leaves the cart fully intact.

## 7. Live probes to run once the stack is up

The §2 conclusion is severe enough that it must be confirmed before it is reported as fact.
Run these in order; probe 3 is the decisive one.

```bash
# 0. token (see CART-01 plan §7 for the full command)
A="Authorization: Bearer $TOKEN"

# 1. Baseline: an order with NO items. Expect 201 if the customer and restaurant both
#    have addresses with coordinates; 500 (NPE) if either is missing (§2.4).
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8082/orders -H "$A" \
  -H 'Content-Type: application/json' \
  -d '{"code":"probe-1","restaurantId":"<uuid>","customerId":"<uuid>","items":[]}'

# 2. Omit restaurantId entirely. Expect 500 (§2.4 unguarded getRestaurant()).

# 3. THE DECISIVE PROBE — one item, no attributes. §2.1 predicts 500 with a
#    TransientPropertyValueException in the server log.
curl -s -X POST http://localhost:8082/orders -H "$A" -H 'Content-Type: application/json' \
  -d '{"code":"probe-3","restaurantId":"<uuid>","customerId":"<uuid>",
       "items":[{"quantity":1,"orderedProduct":{"productId":"<uuid>","attributes":[]}}]}'

# 4. If probe 3 somehow returns 201: re-read it. §2.2 predicts items: [] on the re-read
#    even though the create response showed the item. This is the silent-loss check.
curl -s -H "$A" http://localhost:8082/orders/<id-from-probe-3> | jq '.items'

# 5. One item WITH an attribute. §2.3 predicts a NOT NULL violation on
#    ordered_product_attribute.product_id.

# 6. §3.5 — the filters
curl -s -o /dev/null -w '%{http_code}\n' -H "$A" \
  'http://localhost:8082/orders/all?filter=%7B%22customerIds%22%3A%5B%7B%22operator%22%3A%22EQUALS%22%2C%22fieldValue%22%3A%22x%22%2C%22fieldType%22%3A%22STRING%22%7D%5D%7D'   # expect 500
#    and confirm a `codes` filter returns 200 with UNFILTERED results (the silent-ignore).

# 7. §3.1 — PUT /orders returns 200 with an empty body and changes nothing.
# 8. §3.7 — inspect a failure body; confirm it says only "A populator has failed (N errors occurred)".
```

Record the outcome of each probe in the task report, and correct §2 of this plan if the
backend behaves better than predicted.

## 8. Out of scope

- **All backend changes in §2.5 and §3.5.** This task consumes the API as it is.
- Order history / "my orders" — impossible while every `/orders/all` filter is broken or
  silently ignored (§3.5), and unsafe while there is no ownership enforcement.
- Order tracking and status changes. `OrderCrudService.updateStatus` is exposed by no
  endpoint, and `TrackOrdersSection` in `app/(tabs)/cart.tsx` stays as-is.
- Real payment processing. There is no payment concept in the backend at all (§3.3); the
  modal records a preference and nothing more.
- A fees or pricing service. `constants/fees.ts` is deliberately a constant.
- Delivery ETA. No prep-time or estimate field exists anywhere — omit the row (§4.3).
- Promotions, vouchers, tips, loyalty. "Hungry Points" appears in the payment design but has
  no balance, ledger or endpoint behind it; it is a label only.
- Cancelling an order. `DELETE /orders/{id}` exists but hard-deletes the row and would leave
  the dispatch queue holding a stale entry (§3.4) — that needs a backend status transition,
  not a client delete.
