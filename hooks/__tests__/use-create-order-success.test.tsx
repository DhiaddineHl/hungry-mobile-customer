import { useCreateOrders } from '@/hooks/use-orders';
import type { OrderInput, OrderOutput } from '@/schemas/order';
import * as cartService from '@/services/api/cart-service';
import * as orderService from '@/services/api/order-service';
import { useCartStore } from '@/store/cart-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

/**
 * The success half of the checkout mutation, in its own file for the same
 * reason as `use-create-order-no-retry.test.tsx`: one rendered test per file is
 * the only arrangement that cannot be quietly wrong under this repo's
 * React 19 / RNTL 14 combination.
 *
 * What it proves: a confirmed order clears exactly ONE restaurant's lines from
 * the cart and leaves the other restaurant's alone — and, since lines remain,
 * the server cart is NOT deleted (the sync engine rewrites it instead).
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
const RESTAURANT_ID = 'r2r2r2r2-2222-3333-4444-666666666666';
const OTHER_RESTAURANT_ID = 'e5e5e5e5-2222-3333-4444-777777777777';
const PRODUCT_ID = '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f';
const CART_ID = '3f1b9c44-0d2a-4c6e-9b1f-7a5c2e8d4b30';
const ORDER_ID = '9a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d';

const INPUT: OrderInput = {
  code: `ho:${CUSTOMER_ID}:${RESTAURANT_ID}:1756000000000`,
  restaurantId: RESTAURANT_ID,
  customerId: CUSTOMER_ID,
  items: [{ quantity: 1, orderedProduct: { productId: PRODUCT_ID, attributes: [] } }],
};

const CREATED: OrderOutput = {
  id: ORDER_ID,
  code: INPUT.code,
  restaurantId: RESTAURANT_ID,
  customerId: CUSTOMER_ID,
  status: 'CREATED',
  items: [],
};

function line(restaurantId: string) {
  return {
    lineId: `line-${restaurantId}`,
    foodId: PRODUCT_ID,
    name: 'Crispy Chicken',
    unitPrice: 10,
    basePrice: 10,
    quantity: 2,
    addons: [],
    restaurantId,
    restaurantName: 'Baguette & Baguette',
  };
}

function Probe() {
  const { mutate, isSuccess } = useCreateOrders();

  useEffect(() => {
    mutate([{ input: INPUT, restaurantId: RESTAURANT_ID }]);
  }, [mutate]);

  return <Text>{isSuccess ? 'placed' : 'pending'}</Text>;
}

it('clears only the ordered restaurant’s lines and keeps the shared server cart', async () => {
  mockedOrderService.createOrder.mockResolvedValue(CREATED);
  mockedCartService.deleteCart.mockResolvedValue(undefined);

  useCartStore.setState({
    items: [line(RESTAURANT_ID), line(OTHER_RESTAURANT_ID)],
    remote: {
      cartId: CART_ID,
      syncedSignature: `${PRODUCT_ID}x2`,
      status: 'synced',
    },
  });

  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  await render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );

  await waitFor(() => expect(screen.getByText('placed')).toBeTruthy());

  const state = useCartStore.getState();

  // The ordered restaurant's lines are gone from the device...
  expect(state.items.map((item) => item.restaurantId)).toEqual([
    OTHER_RESTAURANT_ID,
  ]);
  // ...but the ONE server cart still holds the other restaurant's lines, so
  // it is left for the sync engine to rewrite rather than deleted.
  expect(mockedCartService.deleteCart).not.toHaveBeenCalled();
  expect(state.remote.cartId).toBe(CART_ID);

  // The created order is seeded into the cache, so a confirmation screen does
  // not have to re-read it — which today can come back with `items: []`.
  expect(client.getQueryData(['orders', 'detail', ORDER_ID])).toEqual(CREATED);

  client.clear();
});
