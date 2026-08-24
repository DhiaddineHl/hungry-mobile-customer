import {
  groupByRestaurant,
  migrateCartState,
  useCartStore,
  type CartLine,
  type NewCartLine,
} from '@/store/cart-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const RESTAURANT_A = 'aaaaaaaa-1111-2222-3333-444444444444';
const RESTAURANT_B = 'bbbbbbbb-1111-2222-3333-555555555555';
const PIZZA = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

function newLine(overrides: Partial<NewCartLine> = {}): NewCartLine {
  return {
    foodId: PIZZA,
    name: 'Pizza',
    unitPrice: 10,
    basePrice: 10,
    quantity: 1,
    addons: [],
    restaurantId: RESTAURANT_A,
    restaurantName: 'Restaurant A',
    ...overrides,
  };
}

beforeEach(() => {
  // Every test starts from a known cart; zustand state is module-global.
  useCartStore.setState({ items: [], remote: {} });
});

describe('addItem — the one-cart-per-restaurant invariant', () => {
  it('leaves restaurant A’s group untouched when adding from restaurant B', () => {
    useCartStore.getState().addItem(newLine());
    const groupABefore = groupByRestaurant(useCartStore.getState().items).find(
      (g) => g.restaurantId === RESTAURANT_A
    );

    useCartStore.getState().addItem(
      newLine({ restaurantId: RESTAURANT_B, restaurantName: 'Restaurant B' })
    );

    const groupAAfter = groupByRestaurant(useCartStore.getState().items).find(
      (g) => g.restaurantId === RESTAURANT_A
    );
    expect(groupAAfter).toEqual(groupABefore);
  });

  it('keeps the same foodId under two restaurants as two separate lines', () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().addItem(
      newLine({ restaurantId: RESTAURANT_B, restaurantName: 'Restaurant B' })
    );

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(new Set(items.map((i) => i.lineId)).size).toBe(2);
  });

  it('surfaces both restaurants as two groups', () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().addItem(
      newLine({ restaurantId: RESTAURANT_B, restaurantName: 'Restaurant B' })
    );

    const groups = groupByRestaurant(useCartStore.getState().items);
    expect(groups.map((g) => g.restaurantId).sort()).toEqual(
      [RESTAURANT_A, RESTAURANT_B].sort()
    );
  });

  it('merges an identical configuration from the SAME restaurant into one line', () => {
    useCartStore.getState().addItem(newLine({ quantity: 1 }));
    useCartStore.getState().addItem(newLine({ quantity: 2 }));

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it('rejects a line with an empty restaurantId', () => {
    // Otherwise every restaurant collapses into one "" group.
    useCartStore.getState().addItem(newLine({ restaurantId: '' }));

    expect(useCartStore.getState().items).toEqual([]);
  });
});

describe('clearRestaurant / clear', () => {
  it("leaves restaurant B's items and sync state intact", () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().addItem(
      newLine({ restaurantId: RESTAURANT_B, restaurantName: 'Restaurant B' })
    );
    useCartStore.getState().setSyncState(RESTAURANT_A, {
      cartId: 'cart-a',
      syncedSignature: 'sig-a',
      status: 'synced',
    });
    useCartStore.getState().setSyncState(RESTAURANT_B, {
      cartId: 'cart-b',
      syncedSignature: 'sig-b',
      status: 'synced',
    });

    useCartStore.getState().clearRestaurant(RESTAURANT_A);

    const state = useCartStore.getState();
    expect(state.items.map((i) => i.restaurantId)).toEqual([RESTAURANT_B]);
    expect(state.remote[RESTAURANT_B]).toEqual({
      cartId: 'cart-b',
      syncedSignature: 'sig-b',
      status: 'synced',
    });
  });

  it("drops the cleared restaurant's sync state so the empty cart still syncs", () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().setSyncState(RESTAURANT_A, {
      cartId: 'cart-a',
      syncedSignature: 'sig-a',
      status: 'synced',
    });

    useCartStore.getState().clearRestaurant(RESTAURANT_A);

    expect(useCartStore.getState().remote[RESTAURANT_A]).toBeUndefined();
  });

  it('clear() empties both items and every sync state', () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().setSyncState(RESTAURANT_A, { status: 'synced' });

    useCartStore.getState().clear();

    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().remote).toEqual({});
  });
});

describe('setSyncState / clearSyncState', () => {
  it('creates an entry from a partial patch', () => {
    useCartStore.getState().setSyncState(RESTAURANT_A, { status: 'syncing' });

    expect(useCartStore.getState().remote[RESTAURANT_A]).toEqual({
      cartId: null,
      syncedSignature: null,
      status: 'syncing',
    });
  });

  it('merges into an existing entry rather than replacing it', () => {
    useCartStore.getState().setSyncState(RESTAURANT_A, {
      cartId: 'cart-a',
      syncedSignature: 'sig-a',
      status: 'synced',
    });

    useCartStore.getState().setSyncState(RESTAURANT_A, { status: 'error', error: 'boom' });

    expect(useCartStore.getState().remote[RESTAURANT_A]).toEqual({
      cartId: 'cart-a',
      // A failure must not move the synced signature, or the next attempt
      // would think it had nothing to do.
      syncedSignature: 'sig-a',
      status: 'error',
      error: 'boom',
    });
  });

  it('clearSyncState removes only the named restaurant', () => {
    useCartStore.getState().setSyncState(RESTAURANT_A, { status: 'synced' });
    useCartStore.getState().setSyncState(RESTAURANT_B, { status: 'synced' });

    useCartStore.getState().clearSyncState(RESTAURANT_A);

    expect(useCartStore.getState().remote[RESTAURANT_A]).toBeUndefined();
    expect(useCartStore.getState().remote[RESTAURANT_B]).toBeDefined();
  });
});

describe('migrateCartState', () => {
  const V0_BLOB = {
    items: [
      {
        lineId: 'line-1',
        foodId: PIZZA,
        name: 'Pizza',
        unitPrice: 10,
        basePrice: 10,
        quantity: 2,
        addons: [],
        restaurantId: RESTAURANT_A,
        restaurantName: 'Restaurant A',
      } as CartLine,
    ],
  };

  it('adds an empty `remote` slice to a version-0 blob', () => {
    expect(migrateCartState(V0_BLOB, 0).remote).toEqual({});
  });

  it('keeps an existing on-device cart byte-identical', () => {
    // A migration that reset the state would silently empty a real cart on the
    // first launch after the update.
    expect(migrateCartState(V0_BLOB, 0).items).toEqual(V0_BLOB.items);
  });

  it('survives a missing or empty persisted blob', () => {
    expect(migrateCartState(undefined, 0).remote).toEqual({});
    expect(migrateCartState({}, 0).remote).toEqual({});
  });

  it('passes a current-version blob through untouched', () => {
    const v1 = { items: V0_BLOB.items, remote: { [RESTAURANT_A]: { status: 'synced' } } };

    expect(migrateCartState(v1, 1)).toEqual(v1);
  });
});
