import type { AddCartItemInput, CartItemOutput, CartOutput } from '@/schemas/cart';
import type { CartLine } from '@/store/cart-store';

/**
 * Adapts the local cart to the backend's `/carts/active`, and the backend's
 * priced cart to what the screens show.
 *
 * Pure module: no React, no TanStack Query, no network. The `CartLine` import
 * is `import type` only and is erased at compile time, so nothing here drags
 * zustand or AsyncStorage into a unit test.
 */

// --- Line identity -------------------------------------------------------

/**
 * Which server line a local line corresponds to — the SAME rule the backend
 * uses to merge lines (`DefaultActiveCartService.signature`): product, the set
 * of chosen options, and the note compared case-insensitively.
 *
 * Two local lines that only differ by something the backend does not key on
 * (the restaurant, which is implied by the product) share one key, and their
 * quantities are summed into one server line.
 */
export function lineKey(productId: string, optionIds: string[], note?: string | null): string {
  const options = [...optionIds].sort().join(',');
  return `${productId}|${options}|${note?.trim().toLowerCase() ?? ''}`;
}

function localLineKey(line: CartLine): string {
  return lineKey(
    line.foodId,
    line.addons.map((addon) => addon.id).filter(Boolean),
    line.note
  );
}

function serverLineKey(item: CartItemOutput): string | null {
  if (!item.productId) return null;
  const optionIds = (item.options ?? [])
    .map((option) => option.attributeId)
    .filter((id): id is string => !!id);
  return lineKey(item.productId, optionIds, item.note);
}

/** A line the backend can accept: a real product id and a positive quantity. */
function isSendable(line: CartLine): boolean {
  return !!line.foodId && Number.isFinite(line.quantity) && line.quantity > 0;
}

interface DesiredLine {
  key: string;
  quantity: number;
  input: AddCartItemInput;
}

/** The local cart as the server should hold it: one entry per server line key. */
function desiredLines(lines: CartLine[]): Map<string, DesiredLine> {
  const desired = new Map<string, DesiredLine>();

  for (const line of lines) {
    if (!isSendable(line)) continue;

    const key = localLineKey(line);
    const existing = desired.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      existing.input.quantity = existing.quantity;
      continue;
    }

    const note = line.note?.trim();
    desired.set(key, {
      key,
      quantity: line.quantity,
      input: {
        productId: line.foodId,
        quantity: line.quantity,
        ...(note ? { note } : {}),
        attributes: line.addons
          .filter((addon) => !!addon.id)
          .map((addon) => ({ attributeId: addon.id, checked: true })),
      },
    });
  }

  return desired;
}

// --- Sync ----------------------------------------------------------------

/**
 * A stable fingerprint of the cart as the server stores it.
 *
 * Gates the sync engine — when it equals the last synced signature nothing is
 * sent — and tells a screen whether a priced cart it holds is the price OF
 * THIS cart ({@link serverSyncSignature} of the quote === this of the lines).
 */
export function syncSignature(lines: CartLine[]): string {
  return Array.from(desiredLines(lines).values())
    .map((line) => `${line.key}x${line.quantity}`)
    .sort()
    .join('~');
}

/** {@link syncSignature} of what the server cart actually holds. Free gifts are ignored. */
export function serverSyncSignature(cart: CartOutput): string {
  const totals = new Map<string, number>();
  for (const item of cart.items ?? []) {
    if (item.giftItem) continue;
    const key = serverLineKey(item);
    const quantity = item.quantity ?? 0;
    if (!key || quantity <= 0) continue;
    totals.set(key, (totals.get(key) ?? 0) + quantity);
  }
  return Array.from(totals, ([key, quantity]) => `${key}x${quantity}`)
    .sort()
    .join('~');
}

export type CartSyncOp =
  | { type: 'remove'; itemId: string }
  | { type: 'update'; itemId: string; quantity: number }
  | { type: 'add'; input: AddCartItemInput };

/**
 * The fewest calls that turn the server cart into the local one.
 *
 * Removes go first, so a cart at the per-line cap never fails an add for want
 * of room; adds go last. Free gifts belong to the promotion engine and are
 * never touched. A duplicate server line — which the backend's merge rule
 * should make impossible — is removed rather than left to double the order.
 */
export function planCartSync(lines: CartLine[], cart: CartOutput | null): CartSyncOp[] {
  const desired = desiredLines(lines);
  const removes: CartSyncOp[] = [];
  const updates: CartSyncOp[] = [];
  const seen = new Set<string>();

  for (const item of cart?.items ?? []) {
    if (item.giftItem || !item.id) continue;
    const key = serverLineKey(item);
    const want = key && !seen.has(key) ? desired.get(key) : undefined;

    if (!key || !want) {
      removes.push({ type: 'remove', itemId: item.id });
      continue;
    }

    seen.add(key);
    if (item.quantity !== want.quantity) {
      updates.push({ type: 'update', itemId: item.id, quantity: want.quantity });
    }
  }

  const adds: CartSyncOp[] = Array.from(desired.values())
    .filter((line) => !seen.has(line.key))
    .map((line) => ({ type: 'add', input: line.input }));

  return [...removes, ...updates, ...adds];
}

// --- The price, as the backend computed it --------------------------------

export interface QuotedFee {
  code: string | null;
  /** The fee rule's name, e.g. "Night surcharge". */
  label: string;
  amount: number;
}

/** What one restaurant's order will cost — the backend's `OrderPreview`. */
export interface QuotedOrder {
  restaurantId: string;
  restaurantName: string;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  /** This order's share of the per-cart service fee. */
  serviceFee: number;
  additionalFees: QuotedFee[];
  total: number;
}

/**
 * The whole bill as `/carts/active` priced it from the fee rules. Numbers,
 * never nulls: a missing amount on the wire is a zero fee (the backend drops
 * zero fee lines rather than sending them).
 */
export interface CartQuote {
  currency: string | null;
  subtotal: number;
  discountTotal: number;
  /** The app service fee over every order. */
  serviceFee: number;
  /** The delivery fees of every order, summed. */
  deliveryFee: number;
  additionalFees: QuotedFee[];
  total: number;
  orders: QuotedOrder[];
  /** Backend `CartBlocker` names; empty when checkout is possible. */
  blockers: string[];
  /**
   * False when the delivery fee could not be computed yet — no delivery
   * address, or a point missing coordinates. A distance-based fee is simply
   * left out then, so a `deliveryFee` of 0 means "unknown", not "free".
   */
  deliveryPriced: boolean;
  /** {@link serverSyncSignature} of the cart this price is for. */
  signature: string;
}

const amount = (value: number | null | undefined) => value ?? 0;

/** The blockers under which the backend cannot measure a delivery distance. */
const UNPRICED_DELIVERY = new Set([
  'NO_DELIVERY_ADDRESS',
  'NO_ADDRESS_COORDINATES',
  'RESTAURANT_LOCATION_MISSING',
]);

function toFees(
  fees: { code?: string | null; label?: string | null; amount?: number | null }[] | null | undefined
): QuotedFee[] {
  return (fees ?? [])
    .filter((fee) => amount(fee.amount) > 0)
    .map((fee) => ({
      code: fee.code ?? null,
      label: fee.label?.trim() || fee.code || 'Additional fee',
      amount: amount(fee.amount),
    }));
}

export function toCartQuote(cart: CartOutput): CartQuote {
  const orders = (cart.orders ?? []).map((order) => ({
    restaurantId: order.restaurantId ?? '',
    restaurantName: order.restaurantName ?? '',
    subtotal: amount(order.subtotal),
    discount: amount(order.discount),
    deliveryFee: amount(order.deliveryFee),
    serviceFee: amount(order.serviceFeeShare),
    additionalFees: toFees(order.additionalFees),
    total: amount(order.total),
  }));

  return {
    currency: cart.currency ?? null,
    subtotal: amount(cart.subtotal),
    discountTotal: amount(cart.discountTotal),
    serviceFee: amount(cart.serviceFee?.amount),
    deliveryFee: orders.reduce((sum, order) => sum + order.deliveryFee, 0),
    additionalFees: toFees(cart.additionalFees),
    total: amount(cart.total),
    orders,
    blockers: cart.blockers ?? [],
    deliveryPriced: !(cart.blockers ?? []).some((blocker) => UNPRICED_DELIVERY.has(blocker)),
    signature: serverSyncSignature(cart),
  };
}

// --- Blockers ------------------------------------------------------------

/**
 * Why a checkout cannot be placed, in the app's words. The address pair is
 * kept distinct because the fixes differ: add an address at all, versus
 * re-pick an existing one on the map so it acquires coordinates.
 */
export type CheckoutBlocker =
  | 'no-customer'
  | 'no-address'
  | 'no-address-coords'
  | 'no-restaurant-coords'
  | 'empty-cart'
  | 'unknown';

/** The backend's `CartBlocker` names, mapped to the app's. */
export function toCheckoutBlocker(name: string): CheckoutBlocker {
  switch (name) {
    case 'EMPTY_CART':
      return 'empty-cart';
    case 'NO_DELIVERY_ADDRESS':
      return 'no-address';
    case 'NO_ADDRESS_COORDINATES':
      return 'no-address-coords';
    case 'RESTAURANT_LOCATION_MISSING':
      return 'no-restaurant-coords';
    default:
      return 'unknown';
  }
}
