import {
  MAX_SNAPSHOTS,
  useOrderPriceStore,
  type OrderPriceSnapshot,
} from '@/store/order-price-store';

/**
 * The device-side receipt for an order.
 *
 * It is the only record of what an order cost — the backend keeps none — so the
 * cases that matter are that a receipt survives, that a re-record replaces
 * rather than duplicates, and that the eviction which keeps this store bounded
 * drops the OLDEST rather than whatever the key order happens to be.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

function snapshot(overrides: Partial<OrderPriceSnapshot> = {}): OrderPriceSnapshot {
  return {
    lines: [
      {
        lineId: 'cart-line-1',
        foodId: 'prod-1',
        name: 'Crispy Chicken',
        quantity: 1,
        unitPrice: 9.68,
        basePrice: 9.68,
        addons: [],
      },
    ],
    subtotal: 9.68,
    serviceFee: 3,
    deliveryFee: 0,
    total: 12.68,
    savedAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  };
}

/** "2026-09-01T12:00:00.000Z" shifted by `minutes`, for ordering by age. */
function savedAt(minutes: number): string {
  return new Date(Date.parse('2026-09-01T12:00:00.000Z') + minutes * 60_000).toISOString();
}

beforeEach(() => {
  useOrderPriceStore.getState().clear();
});

it('keeps an order’s prices under its own id', () => {
  useOrderPriceStore.getState().record('order-1', snapshot());

  expect(useOrderPriceStore.getState().snapshots['order-1'].total).toBe(12.68);
});

it('has nothing for an order it never recorded', () => {
  expect(useOrderPriceStore.getState().snapshots['order-9']).toBeUndefined();
});

it('replaces a re-recorded order rather than keeping both', () => {
  useOrderPriceStore.getState().record('order-1', snapshot());
  useOrderPriceStore.getState().record('order-1', snapshot({ total: 20 }));

  expect(Object.keys(useOrderPriceStore.getState().snapshots)).toEqual(['order-1']);
  expect(useOrderPriceStore.getState().snapshots['order-1'].total).toBe(20);
});

it('forgets one order without touching the others', () => {
  useOrderPriceStore.getState().record('order-1', snapshot());
  useOrderPriceStore.getState().record('order-2', snapshot());

  useOrderPriceStore.getState().forget('order-1');

  expect(useOrderPriceStore.getState().snapshots['order-1']).toBeUndefined();
  expect(useOrderPriceStore.getState().snapshots['order-2']).toBeDefined();
});

it('ignores forgetting an order it does not hold', () => {
  useOrderPriceStore.getState().record('order-1', snapshot());

  useOrderPriceStore.getState().forget('order-9');

  expect(Object.keys(useOrderPriceStore.getState().snapshots)).toEqual(['order-1']);
});

describe('eviction', () => {
  it('stays bounded — this is persisted storage that only ever grows', () => {
    for (let index = 0; index < MAX_SNAPSHOTS + 10; index += 1) {
      useOrderPriceStore
        .getState()
        .record(`order-${index}`, snapshot({ savedAt: savedAt(index) }));
    }

    expect(Object.keys(useOrderPriceStore.getState().snapshots)).toHaveLength(
      MAX_SNAPSHOTS
    );
  });

  it('drops the OLDEST receipts, which are the ones nobody scrolls back to', () => {
    for (let index = 0; index < MAX_SNAPSHOTS + 2; index += 1) {
      useOrderPriceStore
        .getState()
        .record(`order-${index}`, snapshot({ savedAt: savedAt(index) }));
    }

    const { snapshots } = useOrderPriceStore.getState();
    expect(snapshots['order-0']).toBeUndefined();
    expect(snapshots['order-1']).toBeUndefined();
    expect(snapshots[`order-${MAX_SNAPSHOTS + 1}`]).toBeDefined();
  });

  it('evicts by age, not by the order the keys were written in', () => {
    // The newest receipt is written FIRST here; the oldest must still be the
    // one that goes.
    useOrderPriceStore.getState().record('newest', snapshot({ savedAt: savedAt(1000) }));
    for (let index = 0; index < MAX_SNAPSHOTS; index += 1) {
      useOrderPriceStore
        .getState()
        .record(`order-${index}`, snapshot({ savedAt: savedAt(index) }));
    }

    const { snapshots } = useOrderPriceStore.getState();
    expect(snapshots['newest']).toBeDefined();
    expect(snapshots['order-0']).toBeUndefined();
  });
});
