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
 * This scheme exists only because `Cart` has no `restaurant` field, while the
 * `Order` aggregate one package away does (plan §2.2). Until the backend grows
 * `@ManyToOne private Restaurant restaurant`, `code` is the one column on a
 * cart that the client both fully controls and can filter on, so the
 * restaurant is encoded into it:
 *
 *     code = "hc:<customerId>:<restaurantId>"
 *
 * When that field lands, `parseCartCode` becomes a legacy read path for carts
 * written before the migration and every write switches to the real column —
 * one function changes, not the whole sync engine.
 */
export const CART_CODE_PREFIX = 'hc';

const SEPARATOR = ':';

/** The `code` identifying one customer's cart at one restaurant. */
export function cartCodeFor(customerId: string, restaurantId: string): string {
  return [CART_CODE_PREFIX, customerId, restaurantId].join(SEPARATOR);
}

/**
 * The `LIKE` needle matching every cart of one customer.
 *
 * `SpecificationUtils` renders `LIKE` as `%value%`, and customer ids are UUIDs,
 * so the trailing separator keeps the prefix from colliding with a longer id.
 */
export function customerCartCodePrefix(customerId: string): string {
  return `${CART_CODE_PREFIX}${SEPARATOR}${customerId}${SEPARATOR}`;
}

/**
 * The identity encoded in a cart `code`, or `null` when the code was not
 * written by this app.
 *
 * Never throws. `/carts/all` is not scoped to the caller (plan §3.6), so this
 * runs over rows the app did not write: anything unrecognised — a foreign
 * prefix, a null code, a truncated one — is skipped rather than mis-attributed
 * to some restaurant.
 *
 * Note that a code belonging to a DIFFERENT customer still parses. Deciding
 * whether the customer matches is the caller's job, not this function's.
 */
export function parseCartCode(
  code: string | null | undefined
): { customerId: string; restaurantId: string } | null {
  if (!code) return null;

  const segments = code.split(SEPARATOR);
  // Exactly three: a longer code is a different scheme, not this one with
  // extra data, and guessing which segments to keep would mis-attribute it.
  if (segments.length !== 3) return null;

  const [prefix, customerId, restaurantId] = segments;
  if (prefix !== CART_CODE_PREFIX) return null;
  if (!customerId || !restaurantId) return null;

  return { customerId, restaurantId };
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

export interface ToCartInputArgs {
  /** The backend `Customer.id` UUID — NOT the Keycloak `sub`. */
  customerId: string;
  restaurantId: string;
  /** Persisted as the cart's `name`, so the back-office sees a readable label. */
  restaurantName: string;
  lines: CartLine[];
  comment?: string;
}

/**
 * One restaurant group as `POST /carts` wants it.
 *
 * **What this deliberately discards**, because no column exists to hold it
 * (plan §3.4):
 *   - `addons` — `CartItem` is `{cart, product, quantity}`; the `Order`
 *     aggregate's `OrderedProductAttribut` has no cart equivalent;
 *   - `note` — `comment` is per-cart, not per-line;
 *   - `unitPrice` / `basePrice` — no price field on `Cart` or `CartItem`;
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
  const { customerId, restaurantId, restaurantName, lines, comment } = args;

  const items: CartItemInput[] = Array.from(
    collapseByProduct(lines),
    ([productId, quantity]) => ({ productId, quantity })
  );

  return {
    // Never omitted: nothing on the backend generates a code (plan §3.3).
    code: cartCodeFor(customerId, restaurantId),
    name: restaurantName,
    customerId,
    ...(comment ? { comment } : {}),
    items,
  };
}

/**
 * A stable fingerprint of everything about a group that the backend can
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
