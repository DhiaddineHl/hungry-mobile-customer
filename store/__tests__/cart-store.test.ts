import {
  EMPTY_SYNC_STATE,
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
  useCartStore.setState({ items: [], remote: { ...EMPTY_SYNC_STATE } });
});

describe('addItem — one cart, many restaurants', () => {
  it('leaves restaurant A’s lines untouched when adding from restaurant B', () => {
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

  it('keeps the same foodId under two restaurants as two separate lines in the ONE cart', () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().addItem(
      newLine({ restaurantId: RESTAURANT_B, restaurantName: 'Restaurant B' })
    );

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(new Set(items.map((i) => i.lineId)).size).toBe(2);
  });

  it('surfaces both restaurants as two groups — the two orders checkout will place', () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().addItem(
      newLine({ restaurantId: RESTAURANT_B, restaurantName: 'Restaurant B' })
    );

    const groups = groupByRestaurant(useCartStore.getState().items);
    expect(groups.map((g) => g.restaurantId)).toEqual([RESTAURANT_A, RESTAURANT_B]);
  });

  it('merges an identical configuration from the SAME restaurant into one line', () => {
    useCartStore.getState().addItem(newLine({ quantity: 1 }));
    useCartStore.getState().addItem(newLine({ quantity: 2 }));

    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it('rejects a line with an empty restaurantId', () => {
    // Otherwise checkout would try to place an order for no restaurant.
    useCartStore.getState().addItem(newLine({ restaurantId: '' }));

    expect(useCartStore.getState().items).toEqual([]);
  });
});

describe('clearRestaurant / clear', () => {
  it("removes only restaurant A's lines and leaves the cart's sync state alone", () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().addItem(
      newLine({ restaurantId: RESTAURANT_B, restaurantName: 'Restaurant B' })
    );
    useCartStore.getState().setSyncState({
      cartId: 'cart-1',
      syncedSignature: 'sig-1',
      status: 'synced',
    });

    useCartStore.getState().clearRestaurant(RESTAURANT_A);

    const state = useCartStore.getState();
    expect(state.items.map((i) => i.restaurantId)).toEqual([RESTAURANT_B]);
    // The cart still exists on the server; its signature simply no longer
    // matches, which is what makes the engine rewrite it.
    expect(state.remote).toEqual({
      cartId: 'cart-1',
      syncedSignature: 'sig-1',
      status: 'synced',
    });
  });

  it('clear() empties both items and the sync state', () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().setSyncState({ cartId: 'cart-1', status: 'synced' });

    useCartStore.getState().clear();

    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().remote).toEqual(EMPTY_SYNC_STATE);
  });
});

describe('setSyncState / resetSyncState', () => {
  it('applies a partial patch over the empty state', () => {
    useCartStore.getState().setSyncState({ status: 'syncing' });

    expect(useCartStore.getState().remote).toEqual({
      cartId: null,
      syncedSignature: null,
      status: 'syncing',
    });
  });

  it('merges into the existing state rather than replacing it', () => {
    useCartStore.getState().setSyncState({
      cartId: 'cart-1',
      syncedSignature: 'sig-1',
      status: 'synced',
    });

    useCartStore.getState().setSyncState({ status: 'error', error: 'boom' });

    expect(useCartStore.getState().remote).toEqual({
      cartId: 'cart-1',
      // A failure must not move the synced signature, or the next attempt
      // would think it had nothing to do.
      syncedSignature: 'sig-1',
      status: 'error',
      error: 'boom',
    });
  });

  it('resetSyncState forgets the server row entirely', () => {
    useCartStore.getState().setSyncState({ cartId: 'cart-1', status: 'synced' });

    useCartStore.getState().resetSyncState();

    expect(useCartStore.getState().remote).toEqual(EMPTY_SYNC_STATE);
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
    expect(migrateCartState(V0_BLOB, 0).remote).toEqual(EMPTY_SYNC_STATE);
  });

  it('keeps an existing on-device cart byte-identical', () => {
    // A migration that reset the state would silently empty a real cart on the
    // first launch after the update.
    expect(migrateCartState(V0_BLOB, 0).items).toEqual(V0_BLOB.items);
  });

  it('survives a missing or empty persisted blob', () => {
    expect(migrateCartState(undefined, 0).remote).toEqual(EMPTY_SYNC_STATE);
    expect(migrateCartState({}, 0).remote).toEqual(EMPTY_SYNC_STATE);
  });

  it('replaces a version-1 per-restaurant `remote` map with one fresh sync state, keeping the items', () => {
    const v1 = {
      items: V0_BLOB.items,
      remote: { [RESTAURANT_A]: { cartId: 'cart-a', syncedSignature: 'sig-a', status: 'synced' } },
    };

    const migrated = migrateCartState(v1, 1);

    expect(migrated.items).toEqual(V0_BLOB.items);
    // Forgetting the legacy row ids is safe: `replaceCart` deletes every cart
    // of the customer before writing the single new one.
    expect(migrated.remote).toEqual(EMPTY_SYNC_STATE);
  });

  it('passes a current-version blob through untouched', () => {
    const v2 = {
      items: V0_BLOB.items,
      remote: { cartId: 'cart-1', syncedSignature: 'sig-1', status: 'synced' },
    };

    expect(migrateCartState(v2, 2)).toEqual(v2);
  });
});
