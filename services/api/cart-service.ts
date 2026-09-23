import {
  cartOutputSchema,
  type AddCartItemInput,
  type CartOutput,
  type CheckoutOptionsInput,
} from '@/schemas/cart';
import { z } from 'zod';
import { ApiError, apiClient } from './client';

/**
 * The customer's cart, on the server.
 *
 * There is exactly one cart the app can touch — the signed-in customer's ACTIVE
 * one — and it is addressed by the access token, never by an id the app
 * chooses. Every call below returns the WHOLE cart after the server has
 * recalculated it (promotions re-evaluated, delivery/service/additional fees
 * recomputed for right now), so the screen never has to work anything out: it
 * displays what came back.
 *
 * Errors worth knowing:
 *   - 400 — the change cannot be applied as sent (unknown product, quantity
 *     outside 1–99). The message is the server's own and is safe to show.
 *   - 404 — the line is not in the caller's cart (already removed elsewhere).
 *   - 403 — the token maps to no customer yet.
 */

const ACTIVE = '/carts/active';

/** Turns a zod failure into an ApiError naming the offending field path. */
function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown, what: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  throw new ApiError(
    `Unexpected ${what} from the server: ${path} — ${issue.message}. ` +
      `The app may need updating to match the backend.`
  );
}

/** A cart response is never legitimately empty; an empty 2xx is a failure that must not look like success. */
function parseCart(data: unknown): CartOutput {
  if (data === null || data === undefined || data === '') {
    throw new ApiError('The server accepted the change but returned no cart.');
  }
  return parseOrThrow(cartOutputSchema, data, 'cart');
}

/**
 * The latest state of my cart. Creates an empty one on first use, and
 * re-evaluates promotions and fees, so a night surcharge or an expired
 * promotion is never shown from a stale copy.
 */
export async function fetchActiveCart(): Promise<CartOutput> {
  const { data } = await apiClient.get(ACTIVE);
  return parseCart(data);
}

/**
 * Adds a dish. A line identical to one already in the cart (same dish, same
 * options, same note) adds to that line's quantity instead of creating another.
 */
export async function addCartItem(input: AddCartItemInput): Promise<CartOutput> {
  const { data } = await apiClient.post(`${ACTIVE}/items`, input);
  return parseCart(data);
}

/** Sets a line's quantity. Zero removes it. */
export async function updateCartItemQuantity(itemId: string, quantity: number): Promise<CartOutput> {
  const { data } = await apiClient.put(`${ACTIVE}/items/${encodeURIComponent(itemId)}`, { quantity });
  return parseCart(data);
}

export async function removeCartItem(itemId: string): Promise<CartOutput> {
  const { data } = await apiClient.delete(`${ACTIVE}/items/${encodeURIComponent(itemId)}`);
  return parseCart(data);
}

/** Removes every line that comes from one restaurant. */
export async function removeRestaurantItems(restaurantId: string): Promise<CartOutput> {
  const { data } = await apiClient.delete(`${ACTIVE}/restaurants/${encodeURIComponent(restaurantId)}`);
  return parseCart(data);
}

export async function clearCart(): Promise<CartOutput> {
  const { data } = await apiClient.delete(ACTIVE);
  return parseCart(data);
}

/**
 * Delivery address, payment method, note and coupon. Replace semantics — see
 * {@link CheckoutOptionsInput}. Delivery fees depend on the address, so the
 * returned cart's fees may differ from the previous one's.
 */
export async function updateCheckoutOptions(input: CheckoutOptionsInput): Promise<CartOutput> {
  const { data } = await apiClient.put(`${ACTIVE}/checkout-options`, input);
  return parseCart(data);
}
