import { placeCheckout } from '@/hooks/use-orders';
import type { CartCheckoutOptionsInput } from '@/schemas/cart';
import * as cartService from '@/services/api/cart-service';
import { cartKeys, orderKeys } from '@/services/api/query-keys';
import { EMPTY_SYNC_STATE, useCartStore } from '@/store/cart-store';
import { QueryClient } from '@tanstack/react-query';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@/services/api/cart-service', () => ({
  ...jest.requireActual('@/services/api/cart-service'),
  fetchActiveCart: jest.fn(),
  addActiveCartItem: jest.fn(),
  updateActiveCartItem: jest.fn(),
  removeActiveCartItem: jest.fn(),
  updateCheckoutOptions: jest.fn(),
  checkoutActiveCart: jest.fn(),
}));

const mockedCartService = jest.mocked(cartService);

const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const ORDER_ID = '9a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d';
const PIZZA = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';

const OPTIONS: CartCheckoutOptionsInput = {
  deliveryAddress: { formattedAddress: 'Rue 1', coordinates: { latitude: 36.8, longitude: 10.18 } },
  paymentMethod: 'cash',
  comment: null,
  couponCode: null,
};

const SYNCED_CART = {
  id: CART_ID,
  items: [{ id: 'item-1', productId: PIZZA, quantity: 1, options: [] }],
};

let queryClient: QueryClient;

beforeEach(() => {
  jest.clearAllMocks();
  queryClient = new QueryClient();
  useCartStore.setState({ items: [], remote: { ...EMPTY_SYNC_STATE } });
  useCartStore.getState().addItem({
    foodId: PIZZA,
    name: 'Crispy Chicken',
    unitPrice: 9.5,
    basePrice: 9.5,
    quantity: 1,
    addons: [],
    restaurantId: RESTAURANT_ID,
    restaurantName: 'Baguette & Baguette',
  });
  mockedCartService.fetchActiveCart.mockResolvedValue(SYNCED_CART);
  mockedCartService.updateCheckoutOptions.mockResolvedValue(SYNCED_CART);
});

it('syncs, writes the options, checks out — in that order', async () => {
  const calls: string[] = [];
  mockedCartService.fetchActiveCart.mockImplementation(async () => {
    calls.push('sync');
    return SYNCED_CART;
  });
  mockedCartService.updateCheckoutOptions.mockImplementation(async () => {
    calls.push('options');
    return SYNCED_CART;
  });
  mockedCartService.checkoutActiveCart.mockImplementation(async () => {
    calls.push('checkout');
    return { cartId: CART_ID, orders: [{ id: ORDER_ID, items: [] }] };
  });

  await placeCheckout(CUSTOMER_ID, OPTIONS, queryClient);

  expect(calls).toEqual(['sync', 'options', 'checkout']);
  expect(mockedCartService.updateCheckoutOptions).toHaveBeenCalledWith(OPTIONS);
});

it('empties the local cart and seeds each placed order on success', async () => {
  queryClient.setQueryData(cartKeys.active(CUSTOMER_ID), SYNCED_CART);
  mockedCartService.checkoutActiveCart.mockResolvedValue({
    cartId: CART_ID,
    orders: [{ id: ORDER_ID, items: [] }],
  });

  const orders = await placeCheckout(CUSTOMER_ID, OPTIONS, queryClient);

  expect(orders.map((order) => order.id)).toEqual([ORDER_ID]);
  expect(useCartStore.getState().items).toEqual([]);
  expect(useCartStore.getState().remote.cartId).toBeNull();
  expect(queryClient.getQueryData(orderKeys.detail(ORDER_ID))).toMatchObject({ id: ORDER_ID });
  expect(queryClient.getQueryData(cartKeys.active(CUSTOMER_ID))).toBeUndefined();
});

it('leaves the cart completely intact when checkout is refused', async () => {
  mockedCartService.checkoutActiveCart.mockRejectedValue(
    new cartService.CheckoutNotReadyError(['NO_ADDRESS_COORDINATES'], 'not ready')
  );

  await expect(placeCheckout(CUSTOMER_ID, OPTIONS, queryClient)).rejects.toBeInstanceOf(
    cartService.CheckoutNotReadyError
  );

  expect(useCartStore.getState().items).toHaveLength(1);
});

it('does not check out a cart the server could not be brought in step with', async () => {
  useCartStore.setState({ remote: { ...EMPTY_SYNC_STATE } });
  mockedCartService.fetchActiveCart.mockResolvedValue({ id: CART_ID, items: [] });
  mockedCartService.addActiveCartItem.mockRejectedValue(new Error('offline'));

  await expect(placeCheckout(CUSTOMER_ID, OPTIONS, queryClient)).rejects.toThrow('offline');

  expect(mockedCartService.checkoutActiveCart).not.toHaveBeenCalled();
  expect(useCartStore.getState().items).toHaveLength(1);
});
