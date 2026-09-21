import type { CartInput, CartItemInput } from '@/schemas/cart';
import type { CartLine } from '@/store/cart-store';

/**
 * Adapts the local cart to what `POST /carts` accepts, and owns the cart's
 * server-side identity scheme.
 *
 * Pure module: no React, no TanStack Query, no network. The `CartLine` import
 * is `import type` only and is erased at compile time, so nothing here drags
 * zustand or AsyncStorage into a unit test.
 */

// --- Identity ------------------------------------------------------------

/**
 * The prefix that marks a cart as written by THIS app.
 *
 * A customer has ONE cart, so its code is simply
 *
 *     code = "hc:<customerId>"
 *
 * The backend enforces the same thing from its side: `ux_cart_customer_active`
 * is a partial unique index over `(customer_id) WHERE status = 'ACTIVE'`, and
 * `CartBasePopulator` forces every created cart to ACTIVE — a second cart for
 * the same customer is rejected at insert. The code exists because the
 * `customerIds` filter on `/carts/all` answers 500 (plan §3.5), so `code` is
 * the one column the app both controls and can search on.
 *
 * Carts written by earlier builds used `"hc:<customerId>:<restaurantId>"`, one
 * per restaurant. `parseCartCode` still reads those so hydration can fold
 * them into the single cart; the sync engine then deletes them.
 */
export const CART_CODE_PREFIX = 'hc';

const SEPARATOR = ':';

/** The `code` identifying one customer's cart. */
export function cartCodeFor(customerId: string): string {
  return [CART_CODE_PREFIX, customerId].join(SEPARATOR);
}

/**
 * The `LIKE` needle matching every cart of one customer — the current one and
 * any legacy per-restaurant rows.
 *
 * `SpecificationUtils` renders `LIKE` as `%value%`, and customer ids are
 * UUIDs, so the separator after the prefix is enough to keep one customer's
 * needle from matching inside another's code.
 */
export function customerCartCodePrefix(customerId: string): string {
  return cartCodeFor(customerId);
}

export interface CartCodeIdentity {
  customerId: string;
  /**
   * Set only for a LEGACY code (`hc:<customer>:<restaurant>`), where it names
   * the restaurant every item of that cart belonged to. `null` for a current
   * code: the items' restaurants are resolved per product instead.
   */
  restaurantId: string | null;
}

/**
 * The identity encoded in a cart `code`, or `null` when the code was not
 * written by this app.
 *
 * Never throws. `/carts/all` is not scoped to the caller (plan §3.6), so this
 * runs over rows the app did not write: anything unrecognised — a foreign
 * prefix, a null code, a truncated one — is skipped rather than mis-attributed
 * to some customer.
 *
 * Note that a code belonging to a DIFFERENT customer still parses. Deciding
 * whether the customer matches is the caller's job, not this function's.
 */
export function parseCartCode(code: string | null | undefined): CartCodeIdentity | null {
  if (!code) return null;

  const segments = code.split(SEPARATOR);
  // Two segments is the current scheme, three the legacy one. Anything else
  // is a different scheme, not this one with extra data, and guessing which
  // segments to keep would mis-attribute it.
  if (segments.length !== 2 && segments.length !== 3) return null;

  const [prefix, customerId, restaurantId] = segments;
  if (prefix !== CART_CODE_PREFIX) return null;
  if (!customerId) return null;
  if (segments.length === 3 && !restaurantId) return null;

  return { customerId, restaurantId: restaurantId ?? null };
}

// --- Mapping local lines to a payload -----------------------------------

/**
 * Local lines collapsed to one entry per product, in a stable order.
 *
 * Locally, "Pizza + extra cheese" and "Pizza, plain" are two `CartLine`s with
 * the same `foodId`. The backend has no addon concept, so both map to the same
 * `productId` — and sending two `CartItemInputData` entries would write two
 * `h_cart_item` rows for one product, which reads back as a cart that appears
 * to contain the pizza twice under one name (plan §4.4).
 *
 * So they are grouped and their quantities summed. This is lossy and
 * unavoidable; the loss is confined to this one function.
 */
function collapseByProduct(lines: CartLine[]): Map<string, number> {
  const totals = new Map<string, number>();

  for (const line of lines) {
    // A line with no backend product id cannot be sent: `CartItemPopulator`
    // wraps the failed product lookup in a PopulatorException, which surfaces
    // as a 500 for the whole cart (plan §3.5).
    if (!line.foodId) continue;
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) continue;

    totals.set(line.foodId, (totals.get(line.foodId) ?? 0) + line.quantity);
  }

  return totals;
}

/**
 * The cart's persisted `name`: the restaurants it draws from, in the order
 * they first appear, so the back-office sees "Baguette & Baguette, Chez Ali"
 * rather than an opaque code. Purely a label — nothing reads it back.
 */
export function cartNameFor(lines: CartLine[]): string {
  const names: string[] = [];
  for (const line of lines) {
    const name = line.restaurantName?.trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names.join(', ');
}

export interface ToCartInputArgs {
  /** The backend `Customer.id` UUID — NOT the Keycloak `sub`. */
  customerId: string;
  /** Every line in the cart, from every restaurant. */
  lines: CartLine[];
  comment?: string;
}

/**
 * The whole cart as `POST /carts` wants it.
 *
 * **What this deliberately discards**, because no column exists to hold it
 * (plan §3.4):
 *   - `addons` — `CartItem` is `{cart, product, quantity}`; the `Order`
 *     aggregate's `OrderedProductAttribut` has no cart equivalent;
 *   - `note` — `comment` is per-cart, not per-line;
 *   - `unitPrice` / `basePrice` — no price field on `Cart` or `CartItem`;
 *   - `restaurantId` — no restaurant on `Cart` or `CartItem`; hydration
 *     resolves it again from each product's menu section;
 *   - `image`, `lineId`, `name` — client-side presentation only.
 *
 * The local store stays authoritative for all of the above. The backend cart
 * is a durable projection of it, not a second opinion about its contents, and
 * the UI must never imply the server knows about what is dropped here.
 *
 * `status` is never sent: `CartBasePopulator` hard-codes `ACTIVE` on every
 * create and ignores the input, so offering it would only mislead a caller.
 */
export function toCartInput(args: ToCartInputArgs): CartInput {
  const { customerId, lines, comment } = args;

  const items: CartItemInput[] = Array.from(
    collapseByProduct(lines),
    ([productId, quantity]) => ({ productId, quantity })
  );

  return {
    // Never omitted: nothing on the backend generates a code (plan §3.3).
    code: cartCodeFor(customerId),
    name: cartNameFor(lines),
    customerId,
    ...(comment ? { comment } : {}),
    items,
  };
}

/**
 * A stable fingerprint of everything about the cart that the backend can
 * actually store.
 *
 * Gates the sync engine: when this equals the last successfully synced
 * signature, the delete-and-recreate is skipped entirely. Without it every
 * render of the cart screen would issue a DELETE and a POST.
 *
 * Derived from the SAME collapsed map `toCartInput` sends, which is what makes
 * it correct rather than merely stable — reshuffling two lines of the same
 * product between addon sets produces an identical payload, so it must produce
 * an identical signature. Addons, notes and prices are excluded for the same
 * reason: the backend cannot store them, so a change to one must not trigger a
 * pointless round-trip.
 */
export function syncSignature(lines: CartLine[]): string {
  return Array.from(collapseByProduct(lines))
    .map(([productId, quantity]) => `${productId}x${quantity}`)
    .sort()
    .join('|');
}
