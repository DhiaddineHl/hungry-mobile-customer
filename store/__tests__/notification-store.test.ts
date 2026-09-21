import { diffOrderEvents, notificationCopy } from '@/services/notifications/notification-feed';
import {
  notificationKey,
  selectUnreadCount,
  useNotificationStore,
} from '@/store/notification-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const ORDER = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

function row(type: 'ORDER_CONFIRMED' | 'DRIVER_PICKED_UP' = 'ORDER_CONFIRMED') {
  return {
    key: notificationKey(ORDER, type),
    type,
    orderId: ORDER,
    ...notificationCopy(type, 'Sushi Bar'),
  };
}

describe('notification store', () => {
  beforeEach(() => {
    useNotificationStore.getState().clear();
  });

  it('files a row unread, newest first', () => {
    const { add } = useNotificationStore.getState();
    expect(add(row('ORDER_CONFIRMED'))).toBe(true);
    expect(add(row('DRIVER_PICKED_UP'))).toBe(true);

    const state = useNotificationStore.getState();
    expect(state.notifications.map((n) => n.type)).toEqual([
      'DRIVER_PICKED_UP',
      'ORDER_CONFIRMED',
    ]);
    expect(state.notifications.every((n) => !n.read)).toBe(true);
    expect(selectUnreadCount(state)).toBe(2);
  });

  it('drops a second row with the same key — a push and a poll for one event', () => {
    const { add } = useNotificationStore.getState();
    expect(add(row())).toBe(true);
    expect(add({ ...row(), title: 'From the push' })).toBe(false);

    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe('Order confirmed');
  });

  it('marks everything read, which zeroes the badge', () => {
    const store = useNotificationStore.getState();
    store.add(row('ORDER_CONFIRMED'));
    store.add(row('DRIVER_PICKED_UP'));
    store.markAllRead();
    expect(selectUnreadCount(useNotificationStore.getState())).toBe(0);
  });

  it('marks one row read by key', () => {
    const store = useNotificationStore.getState();
    store.add(row('ORDER_CONFIRMED'));
    store.add(row('DRIVER_PICKED_UP'));
    store.markRead(notificationKey(ORDER, 'ORDER_CONFIRMED'));
    const { notifications } = useNotificationStore.getState();
    expect(notifications.find((n) => n.type === 'ORDER_CONFIRMED')?.read).toBe(true);
    expect(notifications.find((n) => n.type === 'DRIVER_PICKED_UP')?.read).toBe(false);
  });
});

describe('diffOrderEvents', () => {
  it('yields the current status for an order seen for the first time', () => {
    expect(diffOrderEvents(undefined, { orderStatus: 'CREATED', deliveryStatus: null })).toEqual([
      'ORDER_PLACED',
    ]);
  });

  it('yields nothing when nothing changed', () => {
    const seen = { orderStatus: 'CONFIRMED', deliveryStatus: null };
    expect(diffOrderEvents(seen, { ...seen })).toEqual([]);
  });

  it('yields an order event and a delivery event when both moved', () => {
    expect(
      diffOrderEvents(
        { orderStatus: 'PREPARING', deliveryStatus: null },
        { orderStatus: 'READY', deliveryStatus: 'DRIVER_ACCEPTED' }
      )
    ).toEqual(['ORDER_READY', 'DRIVER_ASSIGNED']);
  });

  it('ignores dispatch-internal delivery statuses', () => {
    expect(
      diffOrderEvents(
        { orderStatus: 'READY', deliveryStatus: null },
        { orderStatus: 'READY', deliveryStatus: 'QUEUED' }
      )
    ).toEqual([]);
    expect(
      diffOrderEvents(
        { orderStatus: 'READY', deliveryStatus: 'QUEUED' },
        { orderStatus: 'READY', deliveryStatus: 'DRIVER_REJECTED' }
      )
    ).toEqual([]);
  });

  it('maps pickup and delivery', () => {
    expect(
      diffOrderEvents(
        { orderStatus: 'READY', deliveryStatus: 'DRIVER_ACCEPTED' },
        { orderStatus: 'READY', deliveryStatus: 'PICKED_UP' }
      )
    ).toEqual(['DRIVER_PICKED_UP']);
    expect(
      diffOrderEvents(
        { orderStatus: 'READY', deliveryStatus: 'PICKED_UP' },
        { orderStatus: 'READY', deliveryStatus: 'DELIVERED' }
      )
    ).toEqual(['ORDER_DELIVERED']);
  });
});

describe('notificationCopy', () => {
  it('names the restaurant when known', () => {
    expect(notificationCopy('ORDER_CONFIRMED', 'Sushi Bar').body).toContain('Sushi Bar');
    expect(notificationCopy('DRIVER_PICKED_UP', 'Sushi Bar').body).toContain('from Sushi Bar');
  });

  it('reads naturally without one', () => {
    expect(notificationCopy('ORDER_CONFIRMED', undefined).body).toMatch(/^The restaurant /);
    expect(notificationCopy('ORDER_DELIVERED', undefined).body).not.toContain('from');
  });
});
