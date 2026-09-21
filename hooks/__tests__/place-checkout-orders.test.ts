import { PartialCheckoutError, placeCheckoutOrders } from '@/hooks/use-orders';
import type { OrderInput, OrderOutput } from '@/schemas/order';
import * as cartService from '@/services/api/cart-service';
import * as orderService from '@/services/api/order-service';
import { EMPTY_SYNC_STATE, useCartStore } from '@/store/cart-store';
import { useOrderPriceStore } from '@/store/order-price-store';
import { QueryClient } from '@tanstack/react-query';

/**
 * One cart, several orders. `placeCheckoutOrders` is a plain async function
 * precisely so this can be proven without a renderer: which restaurant's
 * lines leave the cart, and when, is the whole point.
 */

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@/services/api/order-service');
jest.mock('@/services/api/cart-service');

const mockedOrderService = jest.mocked(orderService);
const mockedCartService = jest.mocked(cartService);

const CUSTOMER_ID = 'c1c1c1c1-2222-3333-4444-555555555555';
const RESTAURANT_A = 'aaaaaaaa-2222-3333-4444-666666666666';
const RESTAURANT_B = 'bbbbbbbb-2222-3333-4444-777777777777';
const PIZZA = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const SALAD = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const ORDER_A = '9a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d';
const ORDER_B = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

function input(restaurantId: string, productId: string): OrderInput {
  return {
    code: `ho:${CUSTOMER_ID}:${restaurantId}:1756000000000`,
    restaurantId,
    customerId: CUSTOMER_ID,
    items: [{ quantity: 1, orderedProduct: { productId, attributes: [] } }],
  };
}

function created(id: string, restaurantId: string): OrderOutput {
  return { id, code: `ho:${restaurantId}`, restaurantId, customerId: CUSTOMER_ID, status: 'CREATED', items: [] };
}

function line(restaurantId: string, foodId: string, unitPrice: number) {
  return {
    lineId: `line-${restaurantId}-${foodId}`,
    foodId,
    name: 'Dish',
    unitPrice,
    basePrice: unitPrice,
    quantity: 2,
    addons: [],
    restaurantId,
    restaurantName: `Restaurant ${restaurantId.slice(0, 1)}`,
  };
}

const ORDERS = [
  { input: input(RESTAURANT_A, PIZZA), restaurantId: RESTAURANT_A },
  { input: input(RESTAURANT_B, SALAD), restaurantId: RESTAURANT_B },
];

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  useOrderPriceStore.setState({ snapshots: {} });
  useCartStore.setState({
    items: [line(RESTAURANT_A, PIZZA, 10), line(RESTAURANT_B, SALAD, 6)],
    remote: { cartId: CART_ID, syncedSignature: `${PIZZA}x2|${SALAD}x2`, status: 'synced' },
  });
  mockedCartService.deleteCart.mockResolvedValue(undefined);
});

afterEach(() => {
  client.clear();
  jest.clearAllMocks();
});

it('places one order per restaurant, in the order given', async () => {
  mockedOrderService.createOrder
    .mockResolvedValueOnce(created(ORDER_A, RESTAURANT_A))
    .mockResolvedValueOnce(created(ORDER_B, RESTAURANT_B));

  const placed = await placeCheckoutOrders(ORDERS, client);

  expect(placed.map((order) => order.id)).toEqual([ORDER_A, ORDER_B]);
  expect(mockedOrderService.createOrder.mock.calls.map(([sent]) => sent.restaurantId)).toEqual([
    RESTAURANT_A,
    RESTAURANT_B,
  ]);
});

it('empties the cart, records each order’s prices, seeds the cache and deletes the server cart', async () => {
  mockedOrderService.createOrder
    .mockResolvedValueOnce(created(ORDER_A, RESTAURANT_A))
    .mockResolvedValueOnce(created(ORDER_B, RESTAURANT_B));

  await placeCheckoutOrders(ORDERS, client);

  expect(useCartStore.getState().items).toEqual([]);

  // A receipt PER ORDER, each priced from its own restaurant's lines only.
  const snapshots = useOrderPriceStore.getState().snapshots;
  expect(snapshots[ORDER_A]?.subtotal).toBe(20);
  expect(snapshots[ORDER_B]?.subtotal).toBe(12);

  expect(client.getQueryData(['orders', 'detail', ORDER_A])).toEqual(created(ORDER_A, RESTAURANT_A));
  expect(client.getQueryData(['orders', 'detail', ORDER_B])).toEqual(created(ORDER_B, RESTAURANT_B));

  // Nothing left locally, so the server row goes too — exactly once.
  expect(mockedCartService.deleteCart).toHaveBeenCalledTimes(1);
  expect(mockedCartService.deleteCart).toHaveBeenCalledWith(CART_ID);
  expect(useCartStore.getState().remote).toEqual(EMPTY_SYNC_STATE);
});

it('on a mid-sequence failure keeps the placed order’s lines OUT and the failed one’s IN', async () => {
  mockedOrderService.createOrder
    .mockResolvedValueOnce(created(ORDER_A, RESTAURANT_A))
    .mockRejectedValueOnce(new Error('A populator has failed'));

  const attempt = placeCheckoutOrders(ORDERS, client);

  await expect(attempt).rejects.toBeInstanceOf(PartialCheckoutError);
  const error = (await attempt.catch((e) => e)) as PartialCheckoutError;
  expect(error.placed.map((order) => order.id)).toEqual([ORDER_A]);
  expect(error.failedRestaurantId).toBe(RESTAURANT_B);

  // Restaurant A's food is on its way — Try Again must not order it twice.
  // Restaurant B's lines are untouched, addons and all, for the retry.
  expect(useCartStore.getState().items.map((item) => item.restaurantId)).toEqual([RESTAURANT_B]);

  // Lines remain, so the server cart is NOT deleted; the sync engine rewrites it.
  expect(mockedCartService.deleteCart).not.toHaveBeenCalled();
  expect(useCartStore.getState().remote.cartId).toBe(CART_ID);
});

it('leaves the whole cart intact when the FIRST order fails', async () => {
  mockedOrderService.createOrder.mockRejectedValueOnce(new Error('gateway down'));

  await expect(placeCheckoutOrders(ORDERS, client)).rejects.toMatchObject({
    placed: [],
    failedRestaurantId: RESTAURANT_A,
  });

  expect(useCartStore.getState().items).toHaveLength(2);
  expect(mockedOrderService.createOrder).toHaveBeenCalledTimes(1);
  expect(mockedCartService.deleteCart).not.toHaveBeenCalled();
});
