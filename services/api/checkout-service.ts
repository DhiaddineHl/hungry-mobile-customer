import { orderOutputSchema, type OrderOutput } from '@/schemas/order';
import { z } from 'zod';
import { ApiError, apiClient } from './client';

/**
 * Placing the order.
 *
 * `POST /checkout` takes **nothing**: no body, no id, no price. The server
 * reads the signed-in customer's active cart — items, delivery address, payment
 * method, note — reprices it for this instant, and creates one order per
 * restaurant in a single transaction. That is the whole reason the app cannot
 * tamper with what it pays, and why a half-placed checkout no longer exists:
 * either every restaurant's order is created or none is.
 *
 * Errors:
 *   - 409 — the cart is not ready (`data.blockers` lists why: empty, no
 *     delivery address, an address without coordinates…). The customer can fix
 *     the cart; nothing was created.
 *   - anything else — nothing was created either, but the app cannot tell a
 *     failure before the insert from one after it on the wire, so a retry is
 *     offered manually and never automatic (a duplicate order is a duplicate
 *     delivery).
 */

const checkoutOutputSchema = z.object({
  cartId: z.string().nullish(),
  orders: z.array(orderOutputSchema),
});

export interface CheckoutOutput {
  cartId: string | null;
  orders: OrderOutput[];
}

export async function placeOrders(): Promise<CheckoutOutput> {
  const { data } = await apiClient.post('/checkout');
  if (data === null || data === undefined || data === '') {
    throw new ApiError('The server accepted the checkout but returned no orders.');
  }
  const result = checkoutOutputSchema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
    throw new ApiError(
      `Unexpected checkout result from the server: ${path} — ${issue.message}. ` +
        `The app may need updating to match the backend.`
    );
  }
  return { cartId: result.data.cartId ?? null, orders: result.data.orders };
}

/** The blockers a 409 carried, or `[]` when the error was not a not-ready refusal. */
export function blockersOf(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.status !== 409) return [];
  const blockers = error.data?.blockers;
  return Array.isArray(blockers) ? blockers.filter((b): b is string => typeof b === 'string') : [];
}
