import { z } from 'zod';

/**
 * Runtime shape of `GET /orders/{id}/delivery`
 * (`delivery.hungry.delivery.infrastructure.adapter.rest.OrderDeliveryController`).
 *
 * Deliberately separate from `schemas/order.ts`: `Order.status` is the
 * restaurant lifecycle, and this is the delivery's own status, which starts
 * existing only once a driver has accepted — the endpoint answers 404 until
 * then (see `useOrderDelivery`).
 */

/**
 * Mirrors the backend's `DeliveryStatus` enum member for member — the names
 * are the wire values, so a renamed member here silently reads as `null`.
 *
 * What is actually written today: a row is created at `BATCH_ASSIGNED` and
 * moved to `ACCEPTED` in the same transaction, so a customer first sees
 * `ACCEPTED`. Then `PICKED_UP` → `DELIVERED` → `FINISHED` (the workflow's
 * terminal step, right after `DELIVERED`), or `RETURNED` / `FAILED`.
 * `CREATED`, `QUEUED` and `REJECTED` are declared but never written.
 */
export const deliveryStatusSchema = z.enum([
  'CREATED',
  'ACCEPTED',
  'QUEUED',
  'BATCH_ASSIGNED',
  'REJECTED',
  'PICKED_UP',
  'DELIVERED',
  'RETURNED',
  'FINISHED',
  'FAILED',
]);

/** The food reached the customer — `FINISHED` follows `DELIVERED` immediately. */
export const DELIVERED_STATUSES: readonly DeliveryStatus[] = ['DELIVERED', 'FINISHED'];

/** The delivery ended without the food reaching the customer. */
export const UNDELIVERED_STATUSES: readonly DeliveryStatus[] = ['FAILED', 'RETURNED', 'REJECTED'];

export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const orderDeliveryOutputSchema = z.object({
  deliveryId: z.string().nullish(),
  status: deliveryStatusSchema.nullish().catch(null),
  driverId: z.string().nullish(),
  driverName: z.string().nullish(),
  driverRating: z.number().nullish(),
});

export type OrderDeliveryOutput = z.infer<typeof orderDeliveryOutputSchema>;
