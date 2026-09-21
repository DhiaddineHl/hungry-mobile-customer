import { orderBucket } from '@/services/api/order-list-view-model';
import { diffOrderEvents, notificationCopy } from '@/services/notifications/notification-feed';
import { notificationKey, useNotificationStore } from '@/store/notification-store';
import { useQueries } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useCustomerOrders } from './use-customer-orders';
import { orderDeliveryQueryOptions } from './use-order-delivery';

/**
 * Files an inbox row for every order or delivery status change the app sees.
 *
 * Mounted once, from the root navigator, next to `usePushNotifications`. The
 * two are complementary: a push arrives only for confirmation and driver
 * assignment, and only when the device is registered and reachable, whereas
 * this watches the same polls the My Orders screen relies on — so "Picked up"
 * and "Delivered", which nothing pushes, still reach the inbox. Both write
 * through the same de-duplicating store, so a status that arrives both ways is
 * one row.
 *
 * Reading the orders list here means the in-progress poll runs for the life of
 * the session rather than only while My Orders is open. That is the point: a
 * customer on the home screen should see the bell light up when their driver
 * picks up. It is the same cache entry the screen uses, so nothing is fetched
 * twice.
 */

/** Deliveries of active orders are re-read on the orders cadence. */
const DELIVERY_POLL_MS = 20_000;

export function useNotificationFeed(): void {
  const { active, completed } = useCustomerOrders();

  // One delivery read per active order. The detail screen's query options are
  // reused for the key and fetcher, so a row filed here and the driver card on
  // the order screen come from the same cache entry — but the interval is
  // forced: those options stop polling an UNASSIGNED delivery (the STOMP
  // subscription covers that on the detail screen), and there is no socket
  // here.
  const deliveries = useQueries({
    queries: active.map((order) => ({
      ...orderDeliveryQueryOptions(order.id),
      refetchInterval: DELIVERY_POLL_MS,
    })),
  });

  const add = useNotificationStore((s) => s.add);
  const setObserved = useNotificationStore((s) => s.setObserved);

  // Active orders: every change is a row, and an order seen for the first
  // time yields its current status — which is how "Order placed" appears for
  // an order that was just checked out.
  useEffect(() => {
    active.forEach((order, index) => {
      const delivery = deliveries[index];
      // Until the delivery read has settled, its status is unknown rather than
      // "none": comparing `undefined` against the stored value would file a
      // spurious change on the next pass.
      if (delivery?.isPending) return;

      const next = {
        orderStatus: order.status,
        deliveryStatus: delivery?.data?.status ?? null,
      };
      const previous = useNotificationStore.getState().observed[order.id];
      if (
        previous &&
        previous.orderStatus === next.orderStatus &&
        previous.deliveryStatus === next.deliveryStatus
      ) {
        return;
      }

      for (const type of diffOrderEvents(previous, next)) {
        add({
          key: notificationKey(order.id, type),
          type,
          orderId: order.id,
          ...notificationCopy(type, order.restaurantName),
        });
      }
      setObserved(order.id, next);
    });
  }, [active, deliveries, add, setObserved]);

  // Completed orders: a row only for the transition INTO the completed state
  // (cancelled today). One seen for the first time already completed — history
  // from before this device looked — is baselined silently.
  useEffect(() => {
    for (const order of completed) {
      const previous = useNotificationStore.getState().observed[order.id];
      const next = { orderStatus: order.status, deliveryStatus: previous?.deliveryStatus ?? null };
      if (previous?.orderStatus === next.orderStatus) continue;

      if (previous && orderBucket(order) === 'completed') {
        for (const type of diffOrderEvents(previous, next)) {
          add({
            key: notificationKey(order.id, type),
            type,
            orderId: order.id,
            ...notificationCopy(type, order.restaurantName),
          });
        }
      }
      setObserved(order.id, next);
    }
  }, [completed, add, setObserved]);
}
