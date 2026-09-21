import { z } from 'zod';

/**
 * Runtime shape of `GET /orders/{id}/delivery`
 * (`delivery.hungry.delivery.infrastructure.adapter.rest.OrderDeliveryController`).
 *
 * Deliberately separate from `schemas/order.ts`: `Order.status` stays
 * restaurant-lifecycle only (`CREATED`…`READY`), and this is the delivery's own
 * status, which starts existing only once a driver has been matched — the
 * endpoint answers 404 until then (see `useOrderDelivery`).
 */

export const deliveryStatusSchema = z.enum([
  'QUEUED',
  'BATCH_ASSIGNED',
  'DRIVER_ACCEPTED',
  'DRIVER_REJECTED',
  'PICKED_UP',
  'DELIVERED',
  'FAILED',
]);

export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

export const orderDeliveryOutputSchema = z.object({
  deliveryId: z.string().nullish(),
  status: deliveryStatusSchema.nullish().catch(null),
  driverId: z.string().nullish(),
  driverName: z.string().nullish(),
  driverRating: z.number().nullish(),
});

export type OrderDeliveryOutput = z.infer<typeof orderDeliveryOutputSchema>;
