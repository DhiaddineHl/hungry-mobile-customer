import type { DeliveryStatus } from '@/schemas/delivery';
import type { OrderStatus } from '@/schemas/order';
import type { NotificationType, ObservedOrderState } from '@/store/notification-store';

/**
 * Turns order and delivery status changes into inbox rows.
 *
 * Pure module, like `order-list-view-model.ts`: no React, no store, no
 * network. `use-notification-feed.ts` feeds it what the polls return and files
 * whatever it hands back.
 */

export interface NotificationCopy {
  title: string;
  body: string;
}

/** What each event says. Names the restaurant when one is known. */
export function notificationCopy(
  type: NotificationType,
  restaurantName: string | undefined
): NotificationCopy {
  const from = restaurantName ? ` from ${restaurantName}` : '';
  const who = restaurantName ?? 'The restaurant';
  switch (type) {
    case 'ORDER_PLACED':
      return {
        title: 'Order placed',
        body: `Your order${from} is waiting for the restaurant to confirm it.`,
      };
    case 'ORDER_CONFIRMED':
      return {
        title: 'Order confirmed',
        body: `${who} accepted your order and started preparing it.`,
      };
    case 'ORDER_PREPARING':
      return { title: 'Being prepared', body: `${who} is preparing your food.` };
    case 'ORDER_READY':
      return {
        title: 'Order ready',
        body: `Your order${from} is ready and waiting for a driver.`,
      };
    case 'ORDER_CANCELLED':
      return { title: 'Order cancelled', body: `Your order${from} was cancelled.` };
    case 'DRIVER_ASSIGNED':
      return {
        title: 'Driver on the way',
        body: `A driver accepted your order${from} and is heading to the restaurant.`,
      };
    case 'DRIVER_PICKED_UP':
      return {
        title: 'Picked up',
        body: `Your driver picked up your order${from} and is on the way to you.`,
      };
    case 'ORDER_DELIVERED':
      return { title: 'Delivered', body: `Your order${from} has arrived. Enjoy your meal!` };
    case 'DELIVERY_FAILED':
      return {
        title: 'Delivery problem',
        body: `Your order${from} could not be delivered. Please contact support.`,
      };
  }
}

/** The inbox row an order status maps to, or none when it is not worth a row. */
const ORDER_STATUS_EVENT: Partial<Record<OrderStatus, NotificationType>> = {
  CREATED: 'ORDER_PLACED',
  CONFIRMED: 'ORDER_CONFIRMED',
  PREPARING: 'ORDER_PREPARING',
  READY: 'ORDER_READY',
  CANCELLED: 'ORDER_CANCELLED',
};

/**
 * The inbox row a delivery status maps to. `QUEUED` and `BATCH_ASSIGNED` are
 * dispatch internals — the customer has nothing to act on until a driver has
 * actually accepted — and `DRIVER_REJECTED` just means the search continues.
 */
const DELIVERY_STATUS_EVENT: Partial<Record<DeliveryStatus, NotificationType>> = {
  DRIVER_ACCEPTED: 'DRIVER_ASSIGNED',
  PICKED_UP: 'DRIVER_PICKED_UP',
  DELIVERED: 'ORDER_DELIVERED',
  FAILED: 'DELIVERY_FAILED',
};

/**
 * The events between what was last seen for an order and what the polls now
 * report. An order seen for the FIRST time yields the event for its current
 * status only — not the whole history it went through before this device
 * looked — so a reinstall does not replay a month of "Order placed".
 */
export function diffOrderEvents(
  previous: ObservedOrderState | undefined,
  next: ObservedOrderState
): NotificationType[] {
  const events: NotificationType[] = [];

  if (next.orderStatus && next.orderStatus !== previous?.orderStatus) {
    const event = ORDER_STATUS_EVENT[next.orderStatus as OrderStatus];
    if (event) events.push(event);
  }

  if (next.deliveryStatus && next.deliveryStatus !== previous?.deliveryStatus) {
    const event = DELIVERY_STATUS_EVENT[next.deliveryStatus as DeliveryStatus];
    if (event) events.push(event);
  }

  return events;
}
