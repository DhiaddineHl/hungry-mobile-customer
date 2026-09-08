import { useAuth } from '@/contexts/auth-context';
import { deliveryKeys, orderKeys } from '@/services/api/query-keys';
import { ensurePushRegistration } from '@/services/notifications/push-service';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

/**
 * Connects push notifications to the rest of the app: registers the device,
 * refreshes what a notification says has changed, and opens the screen it is
 * about when the customer taps it.
 *
 * Mounted once, from the root layout. Everything here is a side effect on the
 * navigation and query layers, so a second instance would double-handle every
 * tap.
 */

/** Payload keys written by the backend's `OrderNotificationListener`. */
interface OrderNotificationData {
  type?: string;
  orderId?: string;
  orderCode?: string;
}

function readData(notification: Notifications.Notification): OrderNotificationData {
  return (notification.request.content.data ?? {}) as OrderNotificationData;
}

export function usePushNotifications(): void {
  const { isAuthenticated, isCustomerResolved } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  /**
   * A tap is acted on once. `useLastNotificationResponse` re-delivers the same
   * response on every render for the life of the process — that is what makes a
   * cold start work — so without this the customer would be bounced back to the
   * order screen on every subsequent render.
   */
  const handledResponseIds = useRef(new Set<string>());

  // Register once the session AND the customer record are settled. Waiting on
  // the record is not caution: the backend refuses a registration for an
  // account that has none (404), and `ensureCustomerForAccount` is what creates
  // it for a Google sign-in.
  useEffect(() => {
    if (!isAuthenticated || !isCustomerResolved) return;

    let cancelled = false;
    ensurePushRegistration().then((result) => {
      if (cancelled) return;
      switch (result.status) {
        case 'registered':
          console.log('[Push] Device registered for order notifications');
          break;
        case 'denied':
          console.log('[Push] Notifications were declined — order updates will not be pushed');
          break;
        default:
          console.warn(`[Push] Not registered: ${result.reason}`);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isCustomerResolved]);

  // A notification that ARRIVES while the app is open. The banner is shown by
  // the handler in push-service; the job here is to make the screens agree with
  // it — an order list still showing "Waiting for confirmation" behind a banner
  // that says the opposite is worse than no notification at all.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = readData(notification);
      if (data.type !== 'ORDER_CONFIRMED' && data.type !== 'DRIVER_ASSIGNED') return;

      if (data.orderId) {
        queryClient.invalidateQueries({ queryKey: orderKeys.detail(data.orderId) });
        // DRIVER_ASSIGNED is hungry-notification's push fallback for exactly what
        // the STOMP subscription in `use-order-delivery.ts` already reacts to live
        // — a backgrounded/killed app relies on this branch instead of that socket.
        if (data.type === 'DRIVER_ASSIGNED') {
          queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(data.orderId) });
        }
      }
      // Lists are keyed by customer id, which the notification does not carry;
      // invalidating the `lists()` prefix reaches whichever one is mounted.
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    });

    return () => subscription.remove();
  }, [queryClient]);

  // A notification the customer TAPPED. Covers every entry path: a tap while
  // the app is open or backgrounded, and a tap that launched it from cold —
  // `useLastNotificationResponse` replays that last one after mount, which a
  // plain listener subscribed at mount time would have missed.
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response) return;

    const responseId = response.notification.request.identifier;
    if (handledResponseIds.current.has(responseId)) return;

    const data = readData(response.notification);
    if ((data.type !== 'ORDER_CONFIRMED' && data.type !== 'DRIVER_ASSIGNED') || !data.orderId) return;

    // Routing before the session is restored would land on /login, and the
    // router would then replace the destination. Wait for the next render
    // instead — the response is replayed until it is handled.
    if (!isAuthenticated) return;

    handledResponseIds.current.add(responseId);
    router.push(`/orders/${data.orderId}`);
  }, [response, isAuthenticated, router]);
}
