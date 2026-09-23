import type { CartItemOutput, CartOrderPreview, CartOutput } from '@/schemas/cart';

/**
 * Pure helpers over the server's cart. Nothing here prices anything: totals,
 * fees and discounts are the server's and are only ever read. What lives here
 * is presentation (grouping lines under their restaurant, wording for a
 * blocker) and the optimistic edits applied to the cached cart while a change
 * is in flight.
 */

// --- Reading a cart ---------------------------------------------------------

/** The lines of one restaurant, with the order the checkout will make of them. */
export interface CartRestaurantGroup {
  restaurantId: string;
  restaurantName: string;
  items: CartItemOutput[];
  /** Units, free gifts excluded. */
  totalQuantity: number;
  /** What the checkout will create for this restaurant; null only while the cart is stale. */
  order: CartOrderPreview | null;
}

/**
 * Lines grouped under the restaurant that owns the dish, in the order the
 * restaurants first appear in the cart. A line without a restaurant (should not
 * happen — every product has one) is grouped under an empty id rather than
 * dropped, so it stays visible and removable.
 */
export function groupCartByRestaurant(cart: CartOutput | null | undefined): CartRestaurantGroup[] {
  if (!cart) return [];

  const groups = new Map<string, CartRestaurantGroup>();
  for (const item of cart.items) {
    const restaurantId = item.restaurantId ?? '';
    let group = groups.get(restaurantId);
    if (!group) {
      group = {
        restaurantId,
        restaurantName: item.restaurantName ?? 'Restaurant',
        items: [],
        totalQuantity: 0,
        order: cart.orders.find((order) => order.restaurantId === restaurantId) ?? null,
      };
      groups.set(restaurantId, group);
    }
    group.items.push(item);
    if (!item.giftItem) group.totalQuantity += item.quantity;
  }
  return Array.from(groups.values());
}

/**
 * Units in the cart — what the tab-bar badge shows. Counts quantities rather
 * than lines so bumping a dish from 1 to 2 moves the badge; free gifts are not
 * something the customer added, so they are not counted.
 */
export function cartItemCount(cart: CartOutput | null | undefined): number {
  if (!cart) return 0;
  return cart.items.reduce((total, item) => total + (item.giftItem ? 0 : item.quantity), 0);
}

/** Every discount the cart carries, for the summary. Gifts and messages carry no money. */
export function discountPromotions(cart: CartOutput) {
  return cart.applicablePromotions.filter(
    (promotion) =>
      (promotion.effectType === 'CartDiscountEffect' || promotion.effectType === 'ProductDiscountEffect') &&
      (promotion.amount ?? 0) > 0
  );
}

/** Wording for a blocker, in the customer's terms. Unknown blockers (a newer backend) get a generic line. */
export function blockerMessage(blocker: string): string {
  switch (blocker) {
    case 'EMPTY_CART':
      return 'Your cart is empty.';
    case 'NO_DELIVERY_ADDRESS':
      return 'Choose where to deliver your order.';
    case 'NO_ADDRESS_COORDINATES':
      return 'Pick your delivery point on the map so we can price the delivery.';
    case 'RESTAURANT_LOCATION_MISSING':
      return 'A restaurant in your cart cannot be delivered from right now.';
    default:
      return 'Your cart is not ready to be ordered yet.';
  }
}

// --- Optimistic edits -------------------------------------------------------
//
// Applied to the cached cart the instant the customer taps, so the line moves
// at once; the server's recalculated cart then replaces it. Only the lines are
// edited — totals stay as the server last said until the response lands, and
// the screen marks them as updating meanwhile.

/** A line's new quantity. Zero (or less) removes it. */
export function withItemQuantity(cart: CartOutput, itemId: string, quantity: number): CartOutput {
  if (quantity <= 0) return withoutItem(cart, itemId);
  return {
    ...cart,
    items: cart.items.map((item) =>
      item.id === itemId ? { ...item, quantity, lineTotal: item.unitPrice * quantity } : item
    ),
  };
}

export function withoutItem(cart: CartOutput, itemId: string): CartOutput {
  return { ...cart, items: cart.items.filter((item) => item.id !== itemId) };
}

/** Removes the restaurant's own lines; a gift stays until the server re-evaluates. */
export function withoutRestaurant(cart: CartOutput, restaurantId: string): CartOutput {
  return {
    ...cart,
    items: cart.items.filter((item) => item.giftItem || (item.restaurantId ?? '') !== restaurantId),
  };
}
