import {
  applyHydratedCart,
  fetchHydratedCart,
  syncCart,
} from '@/hooks/use-cart-sync';
import * as cartService from '@/services/api/cart-service';
import { cartCodeFor } from '@/services/api/cart-view-model';
import * as menuService from '@/services/api/menu-service';
import * as productService from '@/services/api/product-service';
import * as restaurantService from '@/services/api/restaurant-service';
import { EMPTY_SYNC_STATE, useCartStore, type NewCartLine } from '@/store/cart-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@/services/api/cart-service');
jest.mock('@/services/api/menu-service');
jest.mock('@/services/api/product-service');
jest.mock('@/services/api/restaurant-service');

const mockedCartService = jest.mocked(cartService);
const mockedMenuService = jest.mocked(menuService);
const mockedProductService = jest.mocked(productService);
const mockedRestaurantService = jest.mocked(restaurantService);

const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const RESTAURANT_B = 'b3b3b3b3-2222-3333-4444-777777777777';
const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const LEGACY_CART_ID = '9e8d7c66-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const PIZZA = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const SALAD = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const SECTION_A = '11111111-2222-3333-4444-555555555555';
const SECTION_B = '66666666-7777-8888-9999-000000000000';

const RESTAURANT_OUTPUT = {
  id: RESTAURANT_ID,
  name: 'Baguette & Baguette',
  cuisines: [],
  dishes: [],
  phones: [],
  workingDays: [],
};

const RESTAURANT_B_OUTPUT = { ...RESTAURANT_OUTPUT, id: RESTAURANT_B, name: 'Chez Ali' };

const PRODUCT_OUTPUT = {
  id: PIZZA,
  name: 'Crispy Chicken',
  subcategories: [{ id: SECTION_A, code: 'PIZZAS', name: 'Pizzas' }],
  subclassifications: [],
  keywords: [],
  prices: [{ id: 'p1', amount: 9.5, currency: { symbol: 'DT', decimalPlaces: 2 } }],
};

const SALAD_OUTPUT = {
  ...PRODUCT_OUTPUT,
  id: SALAD,
  name: 'Green Salad',
  subcategories: [{ id: SECTION_B, code: 'SALADS', name: 'Salads' }],
  prices: [{ id: 'p2', amount: 6, currency: { symbol: 'DT', decimalPlaces: 2 } }],
};

/** A cart under the CURRENT scheme: one per customer, no restaurant in the code. */
const REMOTE_CART = {
  id: CART_ID,
  code: cartCodeFor(CUSTOMER_ID),
  items: [{ productId: PIZZA, productName: 'Crispy Chicken', quantity: 2 }],
};

/** A cart an EARLIER build wrote: one per restaurant, restaurant in the code. */
const LEGACY_CART = {
  id: LEGACY_CART_ID,
  code: `hc:${CUSTOMER_ID}:${RESTAURANT_B}`,
  items: [{ productId: SALAD, productName: 'Green Salad', quantity: 1 }],
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
  useCartStore.setState({ items: [], remote: { ...EMPTY_SYNC_STATE } });
  mockedCartService.replaceCart.mockResolvedValue({
    id: CART_ID,
    code: cartCodeFor(CUSTOMER_ID),
    items: [],
  } as never);
  mockedCartService.deleteCart.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('syncCart', () => {
  it('issues nothing when the signature already matches what was synced', async () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().setSyncState({
      cartId: CART_ID,
      syncedSignature: `${PIZZA}x1`,
      status: 'synced',
    });

    await syncCart(CUSTOMER_ID);

    expect(mockedCartService.replaceCart).not.toHaveBeenCalled();
  });

  it('issues one replaceCart carrying the summed quantity of the whole cart', async () => {
    useCartStore.getState().addItem(newLine({ quantity: 1 }));
    const lineId = useCartStore.getState().items[0].lineId;
    for (let i = 0; i < 5; i += 1) useCartStore.getState().increment(lineId);

    await syncCart(CUSTOMER_ID);

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

    await syncCart(CUSTOMER_ID);

    const [input] = mockedCartService.replaceCart.mock.calls[0];
    expect(input.code).toBe(cartCodeFor(CUSTOMER_ID));
    const serialized = JSON.stringify(input);
    expect(serialized).not.toContain('addons');
    expect(serialized).not.toContain('status');
    expect(serialized).not.toContain('note');
  });

  it('writes ONE cart holding lines from several restaurants', async () => {
    useCartStore.getState().addItem(newLine());
    useCartStore
      .getState()
      .addItem(newLine({ foodId: SALAD, restaurantId: RESTAURANT_B, restaurantName: 'Chez Ali' }));

    await syncCart(CUSTOMER_ID);

    expect(mockedCartService.replaceCart).toHaveBeenCalledTimes(1);
    const [input] = mockedCartService.replaceCart.mock.calls[0];
    expect(input.code).toBe(cartCodeFor(CUSTOMER_ID));
    expect(input.items).toEqual([
      { productId: PIZZA, quantity: 1 },
      { productId: SALAD, quantity: 1 },
    ]);
    expect(input.name).toBe('Baguette & Baguette, Chez Ali');
  });

  it('records the returned cart id and signature only after a successful create', async () => {
    useCartStore.getState().addItem(newLine());

    await syncCart(CUSTOMER_ID);

    expect(useCartStore.getState().remote).toEqual({
      cartId: CART_ID,
      syncedSignature: `${PIZZA}x1`,
      status: 'synced',
      error: undefined,
    });
  });

  it('does nothing at all without a customerId — the local cart is untouched', async () => {
    useCartStore.getState().addItem(newLine());
    const before = useCartStore.getState().items;

    await syncCart(null);

    expect(mockedCartService.replaceCart).not.toHaveBeenCalled();
    expect(mockedCartService.deleteCart).not.toHaveBeenCalled();
    expect(useCartStore.getState().items).toEqual(before);
    expect(useCartStore.getState().remote).toEqual(EMPTY_SYNC_STATE);
  });

  it('sets status error and LEAVES syncedSignature alone so the next attempt retries', async () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().setSyncState({
      cartId: CART_ID,
      syncedSignature: 'stale-signature',
      status: 'idle',
    });
    mockedCartService.replaceCart.mockRejectedValue(new Error('gateway down'));

    await syncCart(CUSTOMER_ID);

    const sync = useCartStore.getState().remote;
    expect(sync.status).toBe('error');
    expect(sync.error).toBe('gateway down');
    // Unchanged — otherwise the next pass would believe it was up to date.
    expect(sync.syncedSignature).toBe('stale-signature');
  });

  it('retries on the next pass after a failure', async () => {
    useCartStore.getState().addItem(newLine());
    mockedCartService.replaceCart.mockRejectedValueOnce(new Error('gateway down'));

    await syncCart(CUSTOMER_ID);
    await syncCart(CUSTOMER_ID);

    expect(mockedCartService.replaceCart).toHaveBeenCalledTimes(2);
    expect(useCartStore.getState().remote.status).toBe('synced');
  });

  it('deletes the backend cart when the cart is emptied', async () => {
    useCartStore.getState().addItem(newLine());

    await syncCart(CUSTOMER_ID);
    useCartStore.getState().clearRestaurant(RESTAURANT_ID);
    await syncCart(CUSTOMER_ID);

    expect(mockedCartService.deleteCart).toHaveBeenCalledWith(CART_ID);
    expect(useCartStore.getState().remote).toEqual(EMPTY_SYNC_STATE);
  });

  it('rewrites — not deletes — when only ONE restaurant is cleared out of two', async () => {
    useCartStore.getState().addItem(newLine());
    useCartStore
      .getState()
      .addItem(newLine({ foodId: SALAD, restaurantId: RESTAURANT_B, restaurantName: 'Chez Ali' }));

    await syncCart(CUSTOMER_ID);
    useCartStore.getState().clearRestaurant(RESTAURANT_ID);
    await syncCart(CUSTOMER_ID);

    expect(mockedCartService.deleteCart).not.toHaveBeenCalled();
    expect(mockedCartService.replaceCart).toHaveBeenCalledTimes(2);
    const [input] = mockedCartService.replaceCart.mock.calls[1];
    expect(input.items).toEqual([{ productId: SALAD, quantity: 1 }]);
  });

  it('keeps a failed delete pending rather than forgetting the orphaned cart', async () => {
    useCartStore.getState().addItem(newLine());
    await syncCart(CUSTOMER_ID);

    useCartStore.getState().clearRestaurant(RESTAURANT_ID);
    mockedCartService.deleteCart.mockRejectedValueOnce(new Error('offline'));
    await syncCart(CUSTOMER_ID);

    expect(useCartStore.getState().remote.cartId).toBe(CART_ID);
  });

  it('passes the known cart id to replaceCart so it need not look it up again', async () => {
    useCartStore.getState().addItem(newLine());
    useCartStore.getState().setSyncState({
      cartId: CART_ID,
      syncedSignature: 'something-else',
      status: 'synced',
    });

    await syncCart(CUSTOMER_ID);

    expect(mockedCartService.replaceCart).toHaveBeenCalledWith(expect.anything(), CART_ID);
  });
});

describe('fetchHydratedCart', () => {
  beforeEach(() => {
    mockedRestaurantService.fetchRestaurantById.mockImplementation(async (id) =>
      id === RESTAURANT_ID
        ? (RESTAURANT_OUTPUT as never)
        : id === RESTAURANT_B
          ? (RESTAURANT_B_OUTPUT as never)
          : null
    );
    mockedProductService.fetchProductById.mockImplementation(async (id) =>
      id === PIZZA ? (PRODUCT_OUTPUT as never) : id === SALAD ? (SALAD_OUTPUT as never) : null
    );
    // The menu walked backwards: section A is on restaurant A's menu, B on B's.
    mockedMenuService.fetchRestaurantIdForSection.mockImplementation(async (sectionId) =>
      sectionId === SECTION_A ? RESTAURANT_ID : sectionId === SECTION_B ? RESTAURANT_B : null
    );
    mockedCartService.fetchCustomerCarts.mockResolvedValue([REMOTE_CART] as never);
  });

  it('rebuilds a line with addons: [] and hydrated: true', async () => {
    const cart = await fetchHydratedCart(CUSTOMER_ID);

    expect(cart).not.toBeNull();
    const [line] = cart!.lines;
    // Not "the customer chose no addons" — they were never stored.
    expect(line.addons).toEqual([]);
    expect(line.note).toBeUndefined();
    expect(line.hydrated).toBe(true);
    expect(line.quantity).toBe(2);
    expect(line.unitPrice).toBe(9.5);
    expect(line.restaurantName).toBe('Baguette & Baguette');
  });

  it("resolves each line's restaurant from the product's menu section — the cart row has none", async () => {
    const cart = await fetchHydratedCart(CUSTOMER_ID);

    expect(mockedMenuService.fetchRestaurantIdForSection).toHaveBeenCalledWith(SECTION_A);
    expect(cart!.lines[0].restaurantId).toBe(RESTAURANT_ID);
  });

  it('points at the server row when the ONE current-scheme cart was read', async () => {
    const cart = await fetchHydratedCart(CUSTOMER_ID);

    expect(cart!.cartId).toBe(CART_ID);
  });

  it('folds a legacy per-restaurant row into the same cart, using the restaurant its code names', async () => {
    mockedCartService.fetchCustomerCarts.mockResolvedValue([REMOTE_CART, LEGACY_CART] as never);

    const cart = await fetchHydratedCart(CUSTOMER_ID);

    expect(cart!.lines.map((line) => [line.foodId, line.restaurantId])).toEqual([
      [PIZZA, RESTAURANT_ID],
      [SALAD, RESTAURANT_B],
    ]);
    // Never looked up: a legacy code says which restaurant its items were from.
    expect(mockedMenuService.fetchRestaurantIdForSection).not.toHaveBeenCalledWith(SECTION_B);
    // No single row holds these lines, so the engine must consolidate them.
    expect(cart!.cartId).toBeNull();
  });

  it('skips a line whose restaurant cannot be resolved — it could never be ordered', async () => {
    mockedMenuService.fetchRestaurantIdForSection.mockResolvedValue(null);

    await expect(fetchHydratedCart(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('skips a line whose restaurant no longer exists', async () => {
    mockedRestaurantService.fetchRestaurantById.mockResolvedValue(null);

    await expect(fetchHydratedCart(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('skips a line whose product no longer resolves rather than rendering a nameless line', async () => {
    mockedProductService.fetchProductById.mockResolvedValue(null);

    await expect(fetchHydratedCart(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('skips a line with no applicable price rather than pricing it at zero', async () => {
    mockedProductService.fetchProductById.mockResolvedValue({
      ...PRODUCT_OUTPUT,
      prices: [],
    } as never);

    await expect(fetchHydratedCart(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('skips a cart whose code this app did not write', async () => {
    mockedCartService.fetchCustomerCarts.mockResolvedValue([
      { ...REMOTE_CART, code: 'legacy-cart-42' },
    ] as never);

    await expect(fetchHydratedCart(CUSTOMER_ID)).resolves.toBeNull();
  });

  it('carries a signature matching the rebuilt lines, so hydration does not resync', async () => {
    const cart = await fetchHydratedCart(CUSTOMER_ID);

    expect(cart!.signature).toBe(`${PIZZA}x2`);
  });

  it('mints a lineId that a later local add of the same dish merges into', async () => {
    const cart = await fetchHydratedCart(CUSTOMER_ID);
    applyHydratedCart(cart);

    useCartStore.getState().addItem(newLine({ quantity: 1 }));

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });
});

describe('applyHydratedCart', () => {
  const HYDRATED = {
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

  it('restores the lines and marks the cart already synced', () => {
    expect(applyHydratedCart(HYDRATED)).toBe(true);

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].hydrated).toBe(true);
    expect(useCartStore.getState().remote).toEqual({
      cartId: CART_ID,
      syncedSignature: `${PIZZA}x2`,
      status: 'synced',
      error: undefined,
    });
  });

  it('leaves the sync state fresh when the lines came from legacy rows, so the engine consolidates', () => {
    expect(applyHydratedCart({ ...HYDRATED, cartId: null })).toBe(true);

    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().remote).toEqual(EMPTY_SYNC_STATE);
  });

  it('is suppressed entirely when local items exist — local wins', () => {
    useCartStore.getState().addItem(newLine({ quantity: 7 }));

    expect(applyHydratedCart(HYDRATED)).toBe(false);

    // Merging two carts that disagree about addons has no correct answer, and
    // the device in the customer's hand is the better source.
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().items[0].quantity).toBe(7);
    expect(useCartStore.getState().items[0].hydrated).toBeUndefined();
  });

  it('does nothing when there is nothing to restore', () => {
    expect(applyHydratedCart(null)).toBe(false);
    expect(useCartStore.getState().items).toEqual([]);
  });
});
