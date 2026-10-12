import {
  applyHydratedCart,
  fetchHydratedCart,
  syncCart,
} from '@/hooks/use-cart-sync';
import type { CartOutput } from '@/schemas/cart';
import * as cartService from '@/services/api/cart-service';
import { syncSignature } from '@/services/api/cart-view-model';
import { cartKeys } from '@/services/api/query-keys';
import * as restaurantService from '@/services/api/restaurant-service';
import { EMPTY_SYNC_STATE, useCartStore, type NewCartLine } from '@/store/cart-store';
import { QueryClient } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@/services/api/cart-service');
jest.mock('@/services/api/restaurant-service');

const mockedCartService = jest.mocked(cartService);
const mockedRestaurantService = jest.mocked(restaurantService);

const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const PIZZA = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const CHEESE = 'a4a4a4a4-1111-2222-3333-444444444444';

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

function serverCart(items: NonNullable<CartOutput['items']> = []): CartOutput {
  return { id: CART_ID, items, total: 12, serviceFee: { amount: 1, orderCount: 1 } };
}

let queryClient: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient();
  useCartStore.setState({ items: [], remote: { ...EMPTY_SYNC_STATE } });
  mockedCartService.fetchActiveCart.mockResolvedValue(serverCart());
  mockedCartService.addActiveCartItem.mockResolvedValue(
    serverCart([{ id: 'item-1', productId: PIZZA, quantity: 1, options: [] }])
  );
});

describe('syncCart — pushing local state up', () => {
  it('does nothing at all when signed out', async () => {
    useCartStore.getState().addItem(newLine());

    await expect(syncCart(null, queryClient)).resolves.toBeNull();

    expect(mockedCartService.fetchActiveCart).not.toHaveBeenCalled();
  });

  it('does not create a server cart for an empty cart that was never synced', async () => {
    await syncCart(CUSTOMER_ID, queryClient);

    expect(mockedCartService.fetchActiveCart).not.toHaveBeenCalled();
  });

  it('reads the server cart, adds what is missing, and caches the priced result', async () => {
    useCartStore.getState().addItem(newLine());

    const cart = await syncCart(CUSTOMER_ID, queryClient);

    expect(mockedCartService.addActiveCartItem).toHaveBeenCalledWith({
      productId: PIZZA,
      quantity: 1,
      attributes: [],
    });
    expect(cart?.id).toBe(CART_ID);
    expect(queryClient.getQueryData(cartKeys.active(CUSTOMER_ID))).toEqual(cart);
    expect(useCartStore.getState().remote).toMatchObject({
      cartId: CART_ID,
      status: 'synced',
      syncedSignature: syncSignature(useCartStore.getState().items),
    });
  });

  it('sends the chosen options — the server cart stores them', async () => {
    useCartStore.getState().addItem(newLine({ addons: [{ id: CHEESE, name: 'Cheese', price: 2 }] }));

    await syncCart(CUSTOMER_ID, queryClient);

    expect(mockedCartService.addActiveCartItem.mock.calls[0][0].attributes).toEqual([
      { attributeId: CHEESE, checked: true },
    ]);
  });

  it('skips the network when the synced cart is unchanged and cached', async () => {
    useCartStore.getState().addItem(newLine());
    await syncCart(CUSTOMER_ID, queryClient);
    jest.clearAllMocks();

    await syncCart(CUSTOMER_ID, queryClient);

    expect(mockedCartService.fetchActiveCart).not.toHaveBeenCalled();
  });

  it('empties the server cart line by line when the local cart is emptied', async () => {
    useCartStore.setState({ remote: { ...EMPTY_SYNC_STATE, cartId: CART_ID, status: 'synced' } });
    mockedCartService.fetchActiveCart.mockResolvedValue(
      serverCart([{ id: 'item-1', productId: PIZZA, quantity: 1, options: [] }])
    );
    mockedCartService.removeActiveCartItem.mockResolvedValue(serverCart());

    await syncCart(CUSTOMER_ID, queryClient);

    expect(mockedCartService.removeActiveCartItem).toHaveBeenCalledWith('item-1');
    // Never the "clear cart" call, which would retire the cart as ABANDONED.
    expect(mockedCartService.clearActiveCart).not.toHaveBeenCalled();
  });

  it('records a failure, keeps the old signature for a retry, and rethrows', async () => {
    useCartStore.getState().addItem(newLine());
    mockedCartService.addActiveCartItem.mockRejectedValueOnce(new Error('boom'));

    await expect(syncCart(CUSTOMER_ID, queryClient)).rejects.toThrow('boom');

    expect(useCartStore.getState().remote).toMatchObject({
      status: 'error',
      error: 'boom',
      syncedSignature: null,
    });
  });

  it('runs passes one after the other, never interleaved', async () => {
    useCartStore.getState().addItem(newLine());
    let release!: () => void;
    mockedCartService.fetchActiveCart.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve(serverCart())))
    );

    const first = syncCart(CUSTOMER_ID, queryClient);
    const second = syncCart(CUSTOMER_ID, queryClient);
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The second pass has not started reading while the first is in flight.
    expect(mockedCartService.fetchActiveCart).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);

    // …and once the first has written the cart, the second has nothing to add.
    expect(mockedCartService.addActiveCartItem).toHaveBeenCalledTimes(1);
  });
});

describe('fetchHydratedCart / applyHydratedCart', () => {
  beforeEach(() => {
    mockedRestaurantService.fetchRestaurantById.mockResolvedValue({
      id: RESTAURANT_ID,
      name: 'Baguette & Baguette',
      cuisines: [],
      dishes: [],
      phones: [],
      workingDays: [],
    } as never);
  });

  it('rebuilds lines with their options, note and price from the server cart', async () => {
    mockedCartService.fetchActiveCart.mockResolvedValue(
      serverCart([
        {
          id: 'item-1',
          productId: PIZZA,
          productName: 'Crispy Chicken',
          quantity: 2,
          restaurantId: RESTAURANT_ID,
          restaurantName: 'Baguette & Baguette',
          unitPrice: 11.5,
          note: 'Well done',
          options: [{ attributeId: CHEESE, name: 'Cheese', price: 2 }],
        },
      ])
    );

    const hydrated = await fetchHydratedCart();

    expect(hydrated?.lines).toHaveLength(1);
    expect(hydrated?.lines[0]).toMatchObject({
      foodId: PIZZA,
      quantity: 2,
      unitPrice: 11.5,
      basePrice: 9.5,
      note: 'Well done',
      addons: [{ id: CHEESE, name: 'Cheese', price: 2 }],
      restaurantId: RESTAURANT_ID,
    });
  });

  it('does not restore a free gift as a line', async () => {
    mockedCartService.fetchActiveCart.mockResolvedValue(
      serverCart([
        { id: 'gift', productId: PIZZA, quantity: 1, restaurantId: RESTAURANT_ID, unitPrice: 0, giftItem: true },
      ])
    );

    await expect(fetchHydratedCart()).resolves.toBeNull();
  });

  it('applies onto an empty cart as already synced', async () => {
    mockedCartService.fetchActiveCart.mockResolvedValue(
      serverCart([
        { id: 'item-1', productId: PIZZA, quantity: 1, restaurantId: RESTAURANT_ID, unitPrice: 9.5, options: [] },
      ])
    );

    const applied = applyHydratedCart(await fetchHydratedCart());

    expect(applied).toBe(true);
    expect(useCartStore.getState().remote).toMatchObject({ cartId: CART_ID, status: 'synced' });
  });

  it('never overwrites a cart the customer filled meanwhile', async () => {
    mockedCartService.fetchActiveCart.mockResolvedValue(
      serverCart([
        { id: 'item-1', productId: PIZZA, quantity: 5, restaurantId: RESTAURANT_ID, unitPrice: 9.5, options: [] },
      ])
    );
    const hydrated = await fetchHydratedCart();
    useCartStore.getState().addItem(newLine());

    expect(applyHydratedCart(hydrated)).toBe(false);
    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });
});
