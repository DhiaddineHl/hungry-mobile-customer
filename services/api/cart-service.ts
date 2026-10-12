import {
  cartOutputSchema,
  type AddCartItemInput,
  type CartCheckoutOptionsInput,
  type CartOutput,
} from '@/schemas/cart';
import { orderOutputSchema } from '@/schemas/order';
import { z } from 'zod';
import { ApiError, apiClient, isApiError } from './client';

/**
 * The signed-in customer's cart and checkout, against the gateway.
 *
 * Every route here addresses "MY cart": no customer id and no cart id is ever
 * sent — the backend resolves the caller's single ACTIVE cart from the token
 * (`CartSession`), creating an empty one on first use. Every mutation locks
 * that cart row, applies the change, re-runs the promotion engine and answers
 * with the whole cart, **freshly priced**: line prices, discounts, the
 * delivery fee of each restaurant's order, the app service fee and any
 * additional fee, all computed from the backend's fee rules.
 *
 * Every response is parsed through the zod schemas before it leaves this
 * module, so a backend shape change surfaces here as a named `ApiError`
 * instead of an `undefined` several components downstream.
 */

const ACTIVE_CART = '/carts/active';
const CHECKOUT = '/checkout';

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

const parseCart = (data: unknown) => parseOrThrow(cartOutputSchema, data, 'cart');

/** My cart, re-priced for right now (a night surcharge appears at 22:00, etc.). */
export async function fetchActiveCart(): Promise<CartOutput> {
  const { data } = await apiClient.get(ACTIVE_CART);
  return parseCart(data);
}

/**
 * Adds a line. A line with the same product, options and note (case-insensitive)
 * is merged by the backend — its quantity grows instead of a second line appearing.
 */
export async function addActiveCartItem(input: AddCartItemInput): Promise<CartOutput> {
  const { data } = await apiClient.post(`${ACTIVE_CART}/items`, input);
  return parseCart(data);
}

/** Sets a line's quantity; 0 removes it. */
export async function updateActiveCartItem(itemId: string, quantity: number): Promise<CartOutput> {
  const { data } = await apiClient.put(`${ACTIVE_CART}/items/${encodeURIComponent(itemId)}`, {
    quantity,
  });
  return parseCart(data);
}

export async function removeActiveCartItem(itemId: string): Promise<CartOutput> {
  const { data } = await apiClient.delete(`${ACTIVE_CART}/items/${encodeURIComponent(itemId)}`);
  return parseCart(data);
}

/**
 * Empties my cart. A cart that had lines is retired as ABANDONED and a fresh
 * one answers; the delivery address and payment method carry over.
 */
export async function clearActiveCart(): Promise<CartOutput> {
  const { data } = await apiClient.delete(ACTIVE_CART);
  return parseCart(data);
}

/**
 * Where to deliver, how to pay, the note. **Replace semantics** — every field
 * is written as sent. The response is re-priced for the new address, which is
 * what moves a per-km delivery fee.
 */
export async function updateCheckoutOptions(input: CartCheckoutOptionsInput): Promise<CartOutput> {
  const { data } = await apiClient.put(`${ACTIVE_CART}/checkout-options`, input);
  return parseCart(data);
}

const checkoutOutputSchema = z.object({
  cartId: z.string().nullish(),
  orders: z.array(orderOutputSchema),
});

export type CheckoutOutput = z.infer<typeof checkoutOutputSchema>;

/**
 * The cart cannot be checked out as it stands — 409 from `POST /checkout`.
 * `blockers` are the backend's `CartBlocker` names; nothing was created.
 */
export class CheckoutNotReadyError extends Error {
  constructor(readonly blockers: string[], message: string) {
    super(message);
    this.name = 'CheckoutNotReadyError';
  }
}

/**
 * Places the orders for my active cart: one per restaurant, in ONE backend
 * transaction under the cart's row lock, priced exactly as the cart was — so
 * there is no such thing as a partially placed checkout. No body: the cart
 * already holds the items, the address, the payment method and every price.
 *
 * Never retried automatically. A duplicate tap waits on the lock and then
 * finds an empty cart, but a client retry after a timeout cannot tell whether
 * the first attempt committed.
 */
export async function checkoutActiveCart(): Promise<CheckoutOutput> {
  try {
    const { data } = await apiClient.post(CHECKOUT);
    return parseOrThrow(checkoutOutputSchema, data, 'checkout');
  } catch (error) {
    if (isApiError(error, 409)) {
      const raw = error.data?.blockers;
      const blockers = Array.isArray(raw) ? raw.filter((b): b is string => typeof b === 'string') : [];
      throw new CheckoutNotReadyError(blockers, error.message);
    }
    throw error;
  }
}
