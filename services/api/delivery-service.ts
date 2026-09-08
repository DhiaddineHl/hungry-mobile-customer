import {
  orderDeliveryOutputSchema,
  type OrderDeliveryOutput,
} from '@/schemas/delivery';
import { z } from 'zod';
import { ApiError, apiClient, isApiError } from './client';

/**
 * Delivery reads against the gateway — "has a driver been assigned to this
 * order, and who are they."
 *
 * Read-only and singular on purpose: there is exactly one `GET` this app ever
 * needs (`GET /orders/{id}/delivery`), matching
 * `OrderDeliveryController`'s one endpoint. The driver's live position is NOT
 * read here — it arrives over the STOMP subscription
 * (`services/realtime/stomp-client.ts`, `/topic/customers/{orderId}/notifications`),
 * so this module never polls fast enough to feel like tracking; see
 * `hooks/use-order-delivery.ts` for how the two combine.
 */

function parseOrThrow<T extends z.ZodType>(
  schema: T,
  data: unknown,
  what: string
): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  throw new ApiError(
    `Unexpected ${what} from the server: ${path} — ${issue.message}. ` +
      `The app may need updating to match the backend.`
  );
}

/**
 * The delivery assigned to one order, or `null` when the order doesn't exist
 * or no driver has been matched to it yet — both answer 404, and the two
 * cannot be told apart from here (the same trade `fetchOrderById` makes for
 * the order's own 500-on-missing).
 */
export async function getOrderDelivery(
  orderId: string
): Promise<OrderDeliveryOutput | null> {
  try {
    const { data } = await apiClient.get(`/orders/${encodeURIComponent(orderId)}/delivery`);
    return parseOrThrow(orderDeliveryOutputSchema, data, 'delivery');
  } catch (error) {
    if (isApiError(error, 404)) return null;
    throw error;
  }
}
