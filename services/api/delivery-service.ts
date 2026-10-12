import {
  driverLocationSchema,
  orderDeliveryOutputSchema,
  type DriverLocation,
  type OrderDeliveryOutput,
} from '@/schemas/delivery';
import { z } from 'zod';
import { ApiError, apiClient, isApiError } from './client';

/**
 * Delivery reads against the gateway — "has a driver been assigned to this
 * order, and who are they."
 *
 * Read-only: `GET /orders/{id}/delivery` (who, and what status) and
 * `GET /orders/{id}/delivery/location` (the driver's last known position — the
 * tracking map's first paint only). Every later position arrives over STOMP,
 * `/topic/orders/{orderId}/driver-location`; see `hooks/use-driver-location.ts`.
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

/**
 * The last known position of the order's driver, or `null` when there is none
 * to show — the backend answers 204 when no driver has accepted yet, the
 * delivery is over, or no position has arrived for the last couple of minutes.
 */
export async function getDriverLocation(orderId: string): Promise<DriverLocation | null> {
  const { data, status } = await apiClient.get(
    `/orders/${encodeURIComponent(orderId)}/delivery/location`
  );
  if (status === 204 || data == null || data === '') return null;
  return parseOrThrow(driverLocationSchema, data, 'driver location');
}
