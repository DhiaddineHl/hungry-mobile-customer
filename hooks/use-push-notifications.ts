import { useAuth } from '@/contexts/auth-context';
import { deliveryKeys, orderKeys } from '@/services/api/query-keys';
import { notificationCopy } from '@/services/notifications/notification-feed';
import {
  clearPushRegistration,
  ensurePushRegistration,
} from '@/services/notifications/push-service';
import {
  notificationKey,
  useNotificationStore,
  type NotificationType,
} from '@/store/notification-store';
import { useSettingsStore } from '@/store/settings-store';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

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

/** The push `type`s this app knows, each as the inbox row it becomes. */
const PUSH_TYPES: Record<string, NotificationType> = {
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  DRIVER_ASSIGNED: 'DRIVER_ASSIGNED',
};

/**
 * Files a push in the device inbox (`notification-store`), so it can be read
 * again from the notifications screen after the banner is gone. The push's own
 * title and body are kept — the backend names the restaurant in them — with
 * the generic copy as the fallback for a bare payload. A duplicate of a row
 * the status feed already filed is dropped by the store.
 */
function recordPush(notification: Notifications.Notification): NotificationType | null {
  const data = readData(notification);
  const type = data.type ? PUSH_TYPES[data.type] : undefined;
  if (!type || !data.orderId) return null;

  const fallback = notificationCopy(type, undefined);
  const { title, body } = notification.request.content;
  useNotificationStore.getState().add({
    key: notificationKey(data.orderId, type),
    type,
    orderId: data.orderId,
    title: title || fallback.title,
    body: body || fallback.body,
  });
  return type;
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
  //
  // The in-app preference (profile → "Order notifications") gates all of it:
  // switching it off unregisters the device, so the backend stops sending
  // rather than the phone merely stopping to show — the customer's choice is
  // honoured server-side, which is what the stores' notification policies ask.
  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);

  useEffect(() => {
    if (!isAuthenticated || !isCustomerResolved) return;

    if (!notificationsEnabled) {
      clearPushRegistration();
      return;
    }

    let cancelled = false;
    let deniedByOs = false;
    const register = () => {
      ensurePushRegistration().then((result) => {
        if (cancelled) return;
        deniedByOs = result.status === 'denied';
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
    };
    register();

    // A customer the OS turned down is sent to the settings app by the profile
    // screen; when they come back with permission granted, register without
    // waiting for the next launch. Only after a denial — a granted device is
    // already registered and re-posting on every foreground would be noise.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && deniedByOs) register();
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [isAuthenticated, isCustomerResolved, notificationsEnabled]);

  // A notification that ARRIVES while the app is open. The banner is shown by
  // the handler in push-service; the job here is to make the screens agree with
  // it — an order list still showing "Waiting for confirmation" behind a banner
  // that says the opposite is worse than no notification at all.
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = readData(notification);
      if (!recordPush(notification)) return;

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
    if (!recordPush(response.notification) || !data.orderId) return;

    // Routing before the session is restored would land on /login, and the
    // router would then replace the destination. Wait for the next render
    // instead — the response is replayed until it is handled.
    if (!isAuthenticated) return;

    handledResponseIds.current.add(responseId);
    router.push(`/orders/${data.orderId}`);
  }, [response, isAuthenticated, router]);
}
