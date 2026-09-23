# Server-authoritative cart and checkout

**Date:** 2026-09-25 · **Backend branch:** `feature/checkout` (hungry-backend) · **App branch:** `feature/checkout`

## The flow

1. **Add.** The food screen sends `POST /carts/active/items` (`productId`, `quantity`, `note`, chosen
   `attributes`). No price, no restaurant, no customer id: the server prices the dish and every option,
   knows which restaurant owns the product, and knows the caller from the token.
2. **Recalculate.** Every cart change returns the *whole* cart, recalculated: items with their prices,
   the promotions that apply (product-, cart- and customer-group-based), one delivery fee per restaurant
   (from its distance to the delivery address), the app service fee, additional fees (night, weather…),
   totals, and `orders[]` — exactly the orders a checkout will create.
3. **Read.** The cart screens call `GET /carts/active` every time they open (`staleTime: 0`), so a
   surcharge that has ended or a promotion that has started is never shown from a stale copy.
4. **Decide.** The delivery point and payment method are written to the cart as they change
   (`PUT /carts/active/checkout-options`, replace-all semantics), because delivery fees depend on the
   address.
5. **Place.** `POST /checkout` — no body, no parameters. The server locks the cart, reprices it for this
   instant, refuses if it has *blockers*, creates one order per restaurant in one transaction, and closes
   the cart. All or nothing; a double tap finds a new empty cart and is refused.

## What lives where

| Concern | Where |
| --- | --- |
| Cart data + recalculation | backend `cart` module (`ActiveCartService`, `CartQuoteCalculator`) |
| Fees | backend `fee` module (`FeeRule`, admin CRUD at `/fee-rules`) |
| Promotions / customer groups | backend `promotion` module, `CustomerGroup` in `customer` |
| Order money snapshot | backend `OrderAdjustment`; receipts/invoices carry service + additional fees |
| Cart cache + mutations | `hooks/use-cart.ts` (mutations run serially in one scope) |
| Place order | `hooks/use-checkout.ts`, `services/api/checkout-service.ts` |

## Rules the app follows

- **The app computes nothing.** Every price, fee, discount and total on screen is the server's.
- **Nothing retries.** A created order dispatches a driver, so a retry could place the same order twice;
  the customer retries by hand on an untouched cart. Cart mutations do not retry either.
- **The service fee is one per cart**, shared equally across the orders (`0.501` / `0.500` for 1.001 over two),
  which is why money shows three decimals (`services/api/money.ts`).
- **One-time migration.** A cart an older version kept on the device is replayed onto the (empty) server
  cart once, options and notes intact, then removed (`services/api/legacy-cart-migration.ts`). A non-empty
  server cart wins.

## Removed

`store/cart-store`, `hooks/use-cart-sync`, the `hc:` cart code scheme, `store/order-price-store`,
`services/api/order-price-view-model`, `constants/fees`, `placeCheckoutOrders` / `PartialCheckoutError`,
`toOrderInput` and the client-side `checkoutTotals` / `checkoutBlockers`.

## Deployment note

Production runs `ddl-auto=validate` with no migration tool: apply
`hungry-backend/docs/migrations/2026-09-25-checkout.sql` **before** deploying the backend. Fee rules are
configured through `/fee-rules` (ADMIN); dev/integ seed sensible defaults.
