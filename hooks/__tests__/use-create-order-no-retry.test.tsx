import { useCreateOrder } from '@/hooks/use-orders';
import type { OrderInput } from '@/schemas/order';
import * as cartService from '@/services/api/cart-service';
import { ApiError } from '@/services/api/client';
import * as orderService from '@/services/api/order-service';
import { useCartStore } from '@/store/cart-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Text } from 'react-native';

/**
 * The ONE test that mounts `useCreateOrder`, deliberately alone in its own file
 * for the same reason as `use-cart-sync-debounce.test.tsx`: under this repo's
 * React 19 / RNTL 14 combination, the automatic `cleanup()` after an awaited
 * test body leaves React unable to mount anything in the next test, so a second
 * rendered test here would silently pass against a hook that never ran.
 *
 * What it proves is the most consequential behaviour in the checkout: a failed
 * create is attempted **once**, and the cart survives it. A retry would risk a
 * duplicate delivery, and a cleared cart would destroy the only record of the
 * customer's addons and notes (plan §3.6,
 * `docs/plans/checkout-order-creation-plan.md`).
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

const INPUT: OrderInput = {
  code: `ho:${CUSTOMER_ID}:${RESTAURANT_ID}:1756000000000`,
  restaurantId: RESTAURANT_ID,
  customerId: CUSTOMER_ID,
  items: [{ quantity: 1, orderedProduct: { productId: PRODUCT_ID, attributes: [] } }],
};

function line(restaurantId: string) {
  return {
    lineId: `line-${restaurantId}`,
    foodId: PRODUCT_ID,
    name: 'Crispy Chicken',
    unitPrice: 10,
    basePrice: 10,
    quantity: 2,
    addons: [{ id: 'a-1', name: 'Extra cheese', price: 2 }],
    restaurantId,
    restaurantName: 'Baguette & Baguette',
  };
}

/** Fires the mutation once on mount, so nothing is assigned out of the tree. */
function Probe() {
  const { mutate, isError } = useCreateOrder();

  useEffect(() => {
    mutate({ input: INPUT, restaurantId: RESTAURANT_ID });
  }, [mutate]);

  return <Text>{isError ? 'failed' : 'pending'}</Text>;
}

it('attempts a failed create exactly once and leaves the cart intact', async () => {
  mockedOrderService.createOrder.mockRejectedValue(
    new ApiError('A populator has failed (3 errors occurred)', 500)
  );

  useCartStore.setState({
    items: [line(RESTAURANT_ID), line(OTHER_RESTAURANT_ID)],
    remote: {
      [RESTAURANT_ID]: {
        cartId: CART_ID,
        syncedSignature: `${PRODUCT_ID}x2`,
        status: 'synced',
      },
    },
  });

  const client = new QueryClient({
    defaultOptions: {
      // Deliberately hostile defaults: if the hook did not opt out, three
      // near-instant retries would land well inside this test.
      mutations: { retry: 3, retryDelay: 1 },
      queries: { retry: false },
    },
  });

  await render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );

  await waitFor(() => expect(screen.getByText('failed')).toBeTruthy());

  // `retry: false` on the mutation beats the client's `retry: 3` default.
  expect(mockedOrderService.createOrder).toHaveBeenCalledTimes(1);

  // The cart is untouched — items, addons and the server cart id all survive,
  // and no backend cart was deleted.
  const state = useCartStore.getState();
  expect(state.items).toHaveLength(2);
  expect(state.items[0].addons).toHaveLength(1);
  expect(state.remote[RESTAURANT_ID]?.cartId).toBe(CART_ID);
  expect(mockedCartService.deleteCart).not.toHaveBeenCalled();

  client.clear();
});
