import { CHARGED_DELIVERY_FEE, SERVICE_FEE } from '@/constants/fees';
import {
  paymentMethodLabel,
  type PaymentMethodId,
} from '@/constants/payment-methods';
import type {
  OrderInput,
  OrderItemInput,
  OrderedProductAttributeInput,
} from '@/schemas/order';
import type { CartLine } from '@/store/cart-store';
import type { BackendAddress } from './types';

/**
 * Adapts the local cart, the customer and the chosen payment method to what
 * `POST /orders` accepts, and decides up front whether an order can be created
 * at all.
 *
 * Pure module: no React, no TanStack Query, no network. Every store import is
 * `import type` and erased at compile time, so nothing here drags zustand or
 * AsyncStorage into a unit test.
 */

// --- Identity ------------------------------------------------------------

/** The prefix marking an order as written by THIS app. */
export const ORDER_CODE_PREFIX = 'ho';

const SEPARATOR = ':';

/**
 * A code unique to ONE checkout attempt.
 *
 * Unlike `cartCodeFor`, this is deliberately NOT derived from
 * `(customer, restaurant)`: a cart is a single mutable row per pair, whereas
 * every checkout is a new order, and two orders sharing a code would be
 * indistinguishable in the back-office.
 *
 * Nothing on the backend generates a code — no `@PrePersist`, no generator —
 * so an omitted one persists as null (plan §3.3).
 */
export function orderCodeFor(
  customerId: string,
  restaurantId: string,
  now: number = Date.now()
): string {
  return [ORDER_CODE_PREFIX, customerId, restaurantId, String(now)].join(
    SEPARATOR
  );
}

/**
 * The `LIKE` needle matching every order of one customer.
 *
 * Mirrors `customerCartCodePrefix`: `SpecificationUtils` renders `LIKE` as
 * `%value%`, and customer ids are UUIDs, so the trailing separator keeps the
 * prefix from colliding with a longer id.
 *
 * The order list endpoint IGNORES this filter today — `OrderSpecificationPopulator`
 * never copies `codes` (plan §3.5) — so `fetchCustomerOrders` filters the
 * response by `customerId` as well. It is sent anyway because it costs nothing
 * and narrows the query the day that populator is fixed.
 */
export function customerOrderCodePrefix(customerId: string): string {
  return [ORDER_CODE_PREFIX, customerId, ''].join(SEPARATOR);
}

/**
 * The customer id encoded in an order `code`, or `null` when the code was not
 * written by this app.
 *
 * Never throws: `/orders/all` returns rows this app did not write, and an
 * unrecognised code must be skipped rather than mis-attributed.
 */
export function parseOrderCodeCustomerId(
  code: string | null | undefined
): string | null {
  if (!code) return null;
  const parts = code.split(SEPARATOR);
  if (parts.length < 4 || parts[0] !== ORDER_CODE_PREFIX) return null;
  return parts[1] || null;
}

// --- The order comment ---------------------------------------------------

/**
 * The `comment` an order carries.
 *
 * `comment` is the only free-text column on `Order`, and there is no payment
 * field anywhere in the backend (plan §3.3), so the chosen method is recorded
 * here — as a note for whoever reads the order, never as a claim that anything
 * was charged. `PAYMENT_DISCLOSURE` in the payment modal says the same thing to
 * the customer.
 *
 * A cart comment, when present, follows on its own line so a multi-line note
 * survives intact rather than being flattened into the payment line.
 */
export function buildOrderComment(
  paymentMethod: PaymentMethodId,
  cartComment?: string
): string {
  const payment = `Payment: ${paymentMethodLabel(paymentMethod)}`;
  const note = cartComment?.trim();

  return note ? `${payment}\n${note}` : payment;
}

/**
 * The two halves of an order `comment` written by {@link buildOrderComment}.
 *
 * Reading it back is how the order screens show a payment method at all: there
 * is no payment column anywhere in the backend (plan §3.3), so the comment this
 * app wrote is the only record of what the customer chose. A comment written by
 * anything else parses as a plain note, never as a payment claim.
 */
export function parseOrderComment(comment: string | null | undefined): {
  payment: string | null;
  note: string | null;
} {
  if (!comment) return { payment: null, note: null };

  const [first, ...rest] = comment.split('\n');
  const match = /^Payment:\s*(.+)$/.exec(first.trim());
  if (!match) return { payment: null, note: comment.trim() || null };

  const note = rest.join('\n').trim();
  return { payment: match[1].trim(), note: note || null };
}

// --- Mapping local lines to a payload -----------------------------------

/**
 * The addons of one line as `OrderedProductAttributeInputData` entries.
 *
 * Always an array. `[]` — never `undefined` — when the line has no addons, so
 * the payload shape does not change between lines and no caller has to
 * optional-chain a list.
 *
 * `checked: true` is sent for every listed attribute: the app lists only what
 * the customer selected. The backend ignores the flag today
 * (`OrderedProductAttributeDirectBasePopulator` never copies it, plan §2.3),
 * but sending the truthful value costs nothing and makes the payload correct
 * the day that populator is fixed.
 */
function toAttributes(line: CartLine): OrderedProductAttributeInput[] {
  return line.addons
    .filter((addon) => !!addon.id)
    .map((addon) => ({
      code: addon.id,
      name: addon.name,
      attributeId: addon.id,
      checked: true,
    }));
}

/** A line the backend can actually accept: real product id, positive quantity. */
function isSendable(line: CartLine): boolean {
  // A line with no backend product id cannot be sent: the populator wraps the
  // failed product lookup in a PopulatorException, which surfaces as a 500 for
  // the whole order.
  if (!line.foodId) return false;
  return Number.isFinite(line.quantity) && line.quantity > 0;
}

export interface ToOrderInputArgs {
  /** The backend `Customer.id` UUID — NOT the Keycloak `sub`. */
  customerId: string;
  restaurantId: string;
  /** Persisted as the order's `name`, so the back-office sees a readable label. */
  restaurantName: string;
  lines: CartLine[];
  paymentMethod: PaymentMethodId;
  cartComment?: string;
  /** Injected in tests so the generated `code` is deterministic. */
  now?: number;
}

/**
 * One restaurant group as `POST /orders` wants it.
 *
 * **Lines are NOT collapsed by product id here — and that is the opposite of
 * `toCartInput`.** The difference is easy to get backwards, so: a `CartItem` is
 * `{cart, product, quantity}` with nowhere to put addons, which is why
 * `toCartInput` sums two configurations of one product into a single line. An
 * `OrderItem` owns an `OrderedProduct` that owns its own `attributes`, so
 * "Pizza + extra cheese" and "Pizza, plain" are two genuinely different order
 * lines. Collapsing them here would silently drop one configuration and cook
 * the wrong food.
 *
 * What is still discarded, because no column exists to hold it (plan §3.3):
 * `unitPrice` / `basePrice` (no price field on `Order` or `OrderItem`), the
 * per-line `note` (`comment` is per-order), and `image` / `lineId` /
 * presentation-only fields.
 *
 * `status` is never sent: `OrderBasePopulator` hard-codes `CREATED` and ignores
 * the input. No price, fee, total or payment key is emitted either — none
 * exists, and sending one would invite a caller to believe the backend charges
 * something.
 */
export function toOrderInput(args: ToOrderInputArgs): OrderInput {
  const {
    customerId,
    restaurantId,
    restaurantName,
    lines,
    paymentMethod,
    cartComment,
    now,
  } = args;

  const items: OrderItemInput[] = lines.filter(isSendable).map((line) => ({
    code: line.lineId,
    name: line.name,
    quantity: line.quantity,
    // The INPUT nesting key. The output calls this `product`.
    orderedProduct: {
      code: line.foodId,
      name: line.name,
      productId: line.foodId,
      attributes: toAttributes(line),
    },
  }));

  return {
    code: orderCodeFor(customerId, restaurantId, now),
    name: restaurantName,
    restaurantId,
    customerId,
    comment: buildOrderComment(paymentMethod, cartComment),
    items,
  };
}

// --- Totals ---------------------------------------------------------------

/** What a cart costs, as the checkout screen and the order snapshot both read it. */
export interface OrderTotals {
  subtotal: number;
  serviceFee: number;
  /** What is actually charged for delivery right now — 0 while it is waived. */
  deliveryFee: number;
  total: number;
}

/**
 * The arithmetic behind the price block, in ONE place.
 *
 * It is shared by the checkout screen and by the snapshot written when an order
 * is placed, and those two must agree by construction: the snapshot is what the
 * order screen shows back to the customer afterwards, so a total computed
 * slightly differently there would read as a changed price.
 *
 * `unitPrice` is per-unit INCLUDING the addons chosen for that line — the cart
 * stores it that way — so the subtotal is a plain sum.
 *
 * Every fee here is a client-side placeholder (`constants/fees.ts`): no fee,
 * price or total field exists on `Order` (plan §3.3), so none of this is sent
 * and none of it is charged by the backend.
 */
export function orderTotals(
  lines: Pick<CartLine, 'unitPrice' | 'quantity'>[]
): OrderTotals {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0
  );

  // An empty cart costs nothing at all — fees on nothing would be a bill for
  // an order that cannot be placed.
  if (lines.length === 0) {
    return { subtotal: 0, serviceFee: 0, deliveryFee: 0, total: 0 };
  }

  return {
    subtotal,
    serviceFee: SERVICE_FEE,
    deliveryFee: CHARGED_DELIVERY_FEE,
    total: subtotal + SERVICE_FEE + CHARGED_DELIVERY_FEE,
  };
}

// --- Preflight -----------------------------------------------------------

/**
 * Why this checkout cannot be submitted (plan §4.5).
 *
 * Every one of these is a precondition the backend dereferences without a null
 * guard — `OrderConsumer` and both inverse populators read `getRestaurant()`,
 * `getCustomer()` and `.getAddress().getCoordinates()` blind (plan §2.4). A
 * missing default address therefore surfaces as an opaque 500 whose body says
 * only "A populator has failed", which tells the customer nothing.
 *
 * `no-address` and `no-address-coords` are kept distinct on purpose: they route
 * the user to different fixes — add an address at all, versus re-pick an
 * existing one on the map so it acquires coordinates.
 */
export type CheckoutBlocker =
  | 'no-customer'
  | 'no-address'
  | 'no-address-coords'
  | 'no-restaurant'
  | 'no-restaurant-coords'
  | 'empty-cart';

export interface CheckoutBlockerArgs {
  /** The resolved backend customer id, or null/undefined while it loads. */
  customerId?: string | null;
  /** The customer's default address (`Customer.address`). */
  address?: BackendAddress | null;
  restaurantId?: string | null;
  restaurantCoordinates?: { latitude: number; longitude: number } | null;
  lines: CartLine[];
}

function hasCoordinates(address: BackendAddress): boolean {
  const { latitude, longitude } = address.coordinates ?? {};
  return typeof latitude === 'number' && typeof longitude === 'number';
}

/**
 * Everything standing between this cart and a submittable order, in the order
 * the UI should mention them.
 *
 * Returns `[]` when the order can be attempted. That is not a promise it will
 * succeed — the §2 persistence defects are outside the device's reach — but it
 * does mean every failure the client CAN see has been ruled out.
 */
export function checkoutBlockers(args: CheckoutBlockerArgs): CheckoutBlocker[] {
  const { customerId, address, restaurantId, restaurantCoordinates, lines } =
    args;

  const blockers: CheckoutBlocker[] = [];

  if (!customerId) blockers.push('no-customer');

  if (!address) {
    blockers.push('no-address');
  } else if (!hasCoordinates(address)) {
    // Distinct from `no-address`: the address exists, it just cannot be
    // delivered to until it is re-picked on the map.
    blockers.push('no-address-coords');
  }

  if (!restaurantId) {
    blockers.push('no-restaurant');
  } else if (
    typeof restaurantCoordinates?.latitude !== 'number' ||
    typeof restaurantCoordinates?.longitude !== 'number'
  ) {
    blockers.push('no-restaurant-coords');
  }

  if (!lines.some(isSendable)) blockers.push('empty-cart');

  return blockers;
}
