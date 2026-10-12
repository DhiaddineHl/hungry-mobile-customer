import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * The customer's notification inbox, kept on the device.
 *
 * **This exists because the backend keeps no inbox.** `OrderNotificationListener`
 * fires one push on confirmation and hungry-notification one on driver
 * assignment; neither is stored anywhere a client could read back. So the
 * inbox is assembled here from two feeds — pushes as they arrive
 * (`use-push-notifications.ts`) and status changes the app observes on the
 * customer's orders (`use-notification-feed.ts`) — and de-duplicated on
 * `{orderId}:{type}` so a confirmation that arrives both ways is one row.
 *
 * Like `order-price-store`, it is per device: a notification for an order
 * placed on another phone shows up here only once THIS phone sees the status.
 */

export type NotificationType =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_PREPARING'
  | 'ORDER_READY'
  | 'ORDER_CANCELLED'
  | 'ORDER_REJECTED'
  | 'DRIVER_ASSIGNED'
  | 'DRIVER_PICKED_UP'
  | 'ORDER_DELIVERED'
  | 'DELIVERY_FAILED';

export interface CustomerNotification {
  /** `{orderId}:{type}` — the de-duplication key. */
  key: string;
  type: NotificationType;
  orderId: string;
  title: string;
  body: string;
  /** ISO-8601 UTC instant, from the device clock at the moment it was recorded. */
  createdAt: string;
  read: boolean;
}

/** The last order and delivery status seen for an order, for change detection. */
export interface ObservedOrderState {
  orderStatus: string | null;
  deliveryStatus: string | null;
}

interface NotificationState {
  notifications: CustomerNotification[];
  observed: Record<string, ObservedOrderState>;
  /**
   * Keys the customer deleted. Remembered so the same event arriving again —
   * the confirmation push landing after the feed already filed it, say —
   * cannot bring a dismissed row back.
   */
  dismissed: string[];
  /**
   * Files one notification; a second with the same `key`, or one the customer
   * already deleted, is ignored. Returns whether it was new.
   */
  add: (notification: Omit<CustomerNotification, 'createdAt' | 'read'>) => boolean;
  markAllRead: () => void;
  markRead: (key: string) => void;
  /** Deletes one row (the swipe-to-delete on the notifications screen). */
  remove: (key: string) => void;
  setObserved: (orderId: string, state: ObservedOrderState) => void;
  clear: () => void;
}

/** More than this and the oldest fall off — an inbox, not an archive. */
const MAX_NOTIFICATIONS = 100;

/** Tombstones only need to outlive a late duplicate; keep the newest few. */
const MAX_DISMISSED = 200;

export const notificationKey = (orderId: string, type: NotificationType) =>
  `${orderId}:${type}`;

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      observed: {},
      dismissed: [],

      add: (notification) => {
        const { notifications, dismissed } = get();
        if (dismissed.includes(notification.key)) return false;
        if (notifications.some((n) => n.key === notification.key)) return false;
        set((state) => ({
          notifications: [
            { ...notification, createdAt: new Date().toISOString(), read: false },
            ...state.notifications,
          ].slice(0, MAX_NOTIFICATIONS),
        }));
        return true;
      },

      markAllRead: () =>
        set((state) =>
          state.notifications.every((n) => n.read)
            ? state
            : { notifications: state.notifications.map((n) => ({ ...n, read: true })) }
        ),

      markRead: (key) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.key === key ? { ...n, read: true } : n
          ),
        })),

      remove: (key) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.key !== key),
          dismissed: state.dismissed.includes(key)
            ? state.dismissed
            : [key, ...state.dismissed].slice(0, MAX_DISMISSED),
        })),

      setObserved: (orderId, observedState) =>
        set((state) => ({ observed: { ...state.observed, [orderId]: observedState } })),

      clear: () => set({ notifications: [], observed: {}, dismissed: [] }),
    }),
    {
      name: 'hungry-notifications',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);

/** Rows the customer has not opened yet — what the bell badge shows. */
export function selectUnreadCount(state: Pick<NotificationState, 'notifications'>): number {
  return state.notifications.reduce((count, n) => count + (n.read ? 0 : 1), 0);
}
