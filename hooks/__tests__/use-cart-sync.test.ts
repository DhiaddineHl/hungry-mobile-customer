import {
  applyHydratedCarts,
  fetchHydratedCarts,
  syncCarts,
} from '@/hooks/use-cart-sync';
import * as cartService from '@/services/api/cart-service';
import { cartCodeFor } from '@/services/api/cart-view-model';
import * as productService from '@/services/api/product-service';
import * as restaurantService from '@/services/api/restaurant-service';
import { useCartStore, type NewCartLine } from '@/store/cart-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@/services/api/cart-service');
jest.mock('@/services/api/product-service');
jest.mock('@/services/api/restaurant-service');

const mockedCartService = jest.mocked(cartService);
const mockedProductService = jest.mocked(productService);
const mockedRestaurantService = jest.mocked(restaurantService);

const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const RESTAURANT_B = 'b3b3b3b3-2222-3333-4444-777777777777';
const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const PIZZA = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

const RESTAURANT_OUTPUT = {
  id: RESTAURANT_ID,
  name: 'Baguette & Baguette',
  cuisines: [],
  dishes: [],
  phones: [],
  workingDays: [],
};

const PRODUCT_OUTPUT = {
  id: PIZZA,
  name: 'Crispy Chicken',
  subcategories: [],
  subclassifications: [],
  keywords: [],
  prices: [{ id: 'p1', amount: 9.5, currency: { symbol: 'DT', decimalPlaces: 2 } }],
};

const REMOTE_CART = {
  id: CART_ID,
  code: cartCodeFor(CUSTOMER_ID, RESTAURANT_ID),
  items: [{ productId: PIZZA, productName: 'Crispy Chicken', quantity: 2 }],
};

function newLine(overrides: Partial<NewCartLine> = {}): NewCartLine {
  return {
    foodId: PIZZA,
    name: 'Crispy Chicken',
    unitPrice: 9.5,
    basePrice: 9.5,
    quantity: 1,
    addons: [],
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Baguette & Baguette',
    ...overrides,
  };
}

beforeEach(() => {
  useCartStore.setState({ items: [], remote: {} });
  mockedCartService.replaceCart.mockResolvedValue({
    id: CART_ID,
    code: cartCodeFor(CUSTOMER_ID, RESTAURANT_ID),
    items: [],
  } as never);
  mockedCartService.deleteCart.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('syncCarts', () => {
  it('issues nothing when the signature already matches what was synced', async () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().setSyncState(RESTAURANT_ID, {
      cartId: CART_ID,
      syncedSignature: `${PIZZA}x1`,
      status: 'synced',
    });

    await syncCarts(CUSTOMER_ID, new Map());

    expect(mockedCartService.replaceCart).not.toHaveBeenCalled();
  });

  it('issues one replaceCart carrying the summed quantity of the whole group', async () => {
    useCartStore.getState().addItem(newLine({ quantity: 1 }));
    const lineId = useCartStore.getState().items[0].lineId;
    for (let i = 0; i < 5; i += 1) useCartStore.getState().increment(lineId);

    await syncCarts(CUSTOMER_ID, new Map());

    // One pass over the current state — which is what the hook's debounce
    // collapses five taps on `+` into.
    expect(mockedCartService.replaceCart).toHaveBeenCalledTimes(1);
    const [input] = mockedCartService.replaceCart.mock.calls[0];
    expect(input.items).toEqual([{ productId: PIZZA, quantity: 6 }]);
  });

  it('sends a payload carrying the cart code and no status, addon or note field', async () => {
    useCartStore
      .getState()
      .addItem(newLine({ addons: [{ id: 'a', name: 'Cheese', price: 2 }], note: 'spicy' }));

    await syncCarts(CUSTOMER_ID, new Map());

    const [input] = mockedCartService.replaceCart.mock.calls[0];
    expect(input.code).toBe(cartCodeFor(CUSTOMER_ID, RESTAURANT_ID));
    const serialized = JSON.stringify(input);
    expect(serialized).not.toContain('addons');
    expect(serialized).not.toContain('status');
    expect(serialized).not.toContain('note');
  });

  it('writes one cart per restaurant, leaving the other alone', async () => {
    useCartStore.getState().addItem(newLine());
    useCartStore
      .getState()
      .addItem(newLine({ restaurantId: RESTAURANT_B, restaurantName: 'Restaurant B' }));

    await syncCarts(CUSTOMER_ID, new Map());

    expect(mockedCartService.replaceCart).toHaveBeenCalledTimes(2);
    const codes = mockedCartService.replaceCart.mock.calls.map(([input]) => input.code);
    expect(codes.sort()).toEqual(
      [
        cartCodeFor(CUSTOMER_ID, RESTAURANT_ID),
        cartCodeFor(CUSTOMER_ID, RESTAURANT_B),
      ].sort()
    );
  });

  it('records the returned cart id and signature only after a successful create', async () => {
    useCartStore.getState().addItem(newLine());

    await syncCarts(CUSTOMER_ID, new Map());

    expect(useCartStore.getState().remote[RESTAURANT_ID]).toEqual({
      cartId: CART_ID,
      syncedSignature: `${PIZZA}x1`,
      status: 'synced',
      error: undefined,
    });
  });

  it('does nothing at all without a customerId — the local cart is untouched', async () => {
    useCartStore.getState().addItem(newLine());
    const before = useCartStore.getState().items;

    await syncCarts(null, new Map());

    expect(mockedCartService.replaceCart).not.toHaveBeenCalled();
    expect(mockedCartService.deleteCart).not.toHaveBeenCalled();
    expect(useCartStore.getState().items).toEqual(before);
    expect(useCartStore.getState().remote).toEqual({});
  });

  it('sets status error and LEAVES syncedSignature alone so the next attempt retries', async () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().setSyncState(RESTAURANT_ID, {
      cartId: CART_ID,
      syncedSignature: 'stale-signature',
      status: 'idle',
    });
    mockedCartService.replaceCart.mockRejectedValue(new Error('gateway down'));

    await syncCarts(CUSTOMER_ID, new Map());

    const sync = useCartStore.getState().remote[RESTAURANT_ID];
    expect(sync.status).toBe('error');
    expect(sync.error).toBe('gateway down');
    // Unchanged — otherwise the next pass would believe it was up to date.
    expect(sync.syncedSignature).toBe('stale-signature');
  });

  it('retries on the next pass after a failure', async () => {
    useCartStore.getState().addItem(newLine());
    mockedCartService.replaceCart.mockRejectedValueOnce(new Error('gateway down'));

    const known = new Map<string, string>();
    await syncCarts(CUSTOMER_ID, known);
    await syncCarts(CUSTOMER_ID, known);

    expect(mockedCartService.replaceCart).toHaveBeenCalledTimes(2);
    expect(useCartStore.getState().remote[RESTAURANT_ID].status).toBe('synced');
  });

  it('deletes the backend cart when the group is emptied', async () => {
    useCartStore.getState().addItem(newLine());
    const known = new Map<string, string>();

    await syncCarts(CUSTOMER_ID, known);
    useCartStore.getState().clearRestaurant(RESTAURANT_ID);
    await syncCarts(CUSTOMER_ID, known);

    // `clearRestaurant` drops the sync state, so only the session map still
    // knows which server row to remove.
    expect(mockedCartService.deleteCart).toHaveBeenCalledWith(CART_ID);
    expect(known.has(RESTAURANT_ID)).toBe(false);
  });

  it('keeps a failed delete pending rather than forgetting the orphaned cart', async () => {
    useCartStore.getState().addItem(newLine());
    const known = new Map<string, string>();
    await syncCarts(CUSTOMER_ID, known);

    useCartStore.getState().clearRestaurant(RESTAURANT_ID);
    mockedCartService.deleteCart.mockRejectedValueOnce(new Error('offline'));
    await syncCarts(CUSTOMER_ID, known);

    expect(known.get(RESTAURANT_ID)).toBe(CART_ID);
  });

  it('passes the known cart id to replaceCart so it need not look it up again', async () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().setSyncState(RESTAURANT_ID, {
      cartId: CART_ID,
      syncedSignature: 'something-else',
      status: 'synced',
    });

    await syncCarts(CUSTOMER_ID, new Map());

    expect(mockedCartService.replaceCart).toHaveBeenCalledWith(expect.anything(), CART_ID);
  });
});

describe('fetchHydratedCarts', () => {
  beforeEach(() => {
    mockedRestaurantService.fetchRestaurantById.mockResolvedValue(RESTAURANT_OUTPUT as never);
    mockedProductService.fetchProductById.mockResolvedValue(PRODUCT_OUTPUT as never);
    mockedCartService.fetchCustomerCarts.mockResolvedValue([REMOTE_CART] as never);
  });

  it('rebuilds a line with addons: [] and hydrated: true', async () => {
    const carts = await fetchHydratedCarts(CUSTOMER_ID);

    expect(carts).toHaveLength(1);
    const [line] = carts[0].lines;
    // Not "the customer chose no addons" — they were never stored.
    expect(line.addons).toEqual([]);
    expect(line.note).toBeUndefined();
    expect(line.hydrated).toBe(true);
    expect(line.quantity).toBe(2);
    expect(line.unitPrice).toBe(9.5);
    expect(line.restaurantName).toBe('Baguette & Baguette');
  });

  it('skips a cart whose restaurant no longer resolves', async () => {
    mockedRestaurantService.fetchRestaurantById.mockResolvedValue(null);

    await expect(fetchHydratedCarts(CUSTOMER_ID)).resolves.toEqual([]);
  });

  it('skips a cart whose products no longer resolve rather than rendering a nameless line', async () => {
    mockedProductService.fetchProductById.mockResolvedValue(null);

    await expect(fetchHydratedCarts(CUSTOMER_ID)).resolves.toEqual([]);
  });

  it('skips a line with no applicable price rather than pricing it at zero', async () => {
    mockedProductService.fetchProductById.mockResolvedValue({
      ...PRODUCT_OUTPUT,
      prices: [],
    } as never);

    await expect(fetchHydratedCarts(CUSTOMER_ID)).resolves.toEqual([]);
  });

  it('skips a cart whose code this app did not write', async () => {
    mockedCartService.fetchCustomerCarts.mockResolvedValue([
      { ...REMOTE_CART, code: 'legacy-cart-42' },
    ] as never);

    await expect(fetchHydratedCarts(CUSTOMER_ID)).resolves.toEqual([]);
  });

  it('carries a signature matching the rebuilt lines, so hydration does not resync', async () => {
    const [cart] = await fetchHydratedCarts(CUSTOMER_ID);

    expect(cart.signature).toBe(`${PIZZA}x2`);
  });

  it('mints a lineId that a later local add of the same dish merges into', async () => {
    const [cart] = await fetchHydratedCarts(CUSTOMER_ID);
    applyHydratedCarts([cart]);

    useCartStore.getState().addItem(newLine({ quantity: 1 }));

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });
});

describe('applyHydratedCarts', () => {
  const HYDRATED = {
    restaurantId: RESTAURANT_ID,
    cartId: CART_ID,
    signature: `${PIZZA}x2`,
    lines: [
      {
        lineId: 'l1',
        foodId: PIZZA,
        name: 'Crispy Chicken',
        unitPrice: 9.5,
        basePrice: 9.5,
        quantity: 2,
        addons: [],
        restaurantId: RESTAURANT_ID,
        restaurantName: 'Baguette & Baguette',
        hydrated: true,
      },
    ],
  };

  it('restores the lines and marks the group already synced', () => {
    expect(applyHydratedCarts([HYDRATED])).toBe(true);

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].hydrated).toBe(true);
    expect(useCartStore.getState().remote[RESTAURANT_ID]).toEqual({
      cartId: CART_ID,
      syncedSignature: `${PIZZA}x2`,
      status: 'synced',
    });
  });

  it('is suppressed entirely when local items exist — local wins', () => {
    useCartStore.getState().addItem(newLine({ quantity: 7 }));

    expect(applyHydratedCarts([HYDRATED])).toBe(false);

    // Merging two carts that disagree about addons has no correct answer, and
    // the device in the customer's hand is the better source.
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(7);
    expect(useCartStore.getState().items[0].hydrated).toBeUndefined();
  });

  it('does nothing when there is nothing to restore', () => {
    expect(applyHydratedCarts([])).toBe(false);
    expect(useCartStore.getState().items).toEqual([]);
  });
});
