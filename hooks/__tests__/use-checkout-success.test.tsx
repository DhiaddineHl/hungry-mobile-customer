import { useCheckout } from '@/hooks/use-checkout';
import { orderOutputSchema, type OrderOutput } from '@/schemas/order';
import * as checkoutService from '@/services/api/checkout-service';
import { cartKeys, orderKeys } from '@/services/api/query-keys';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';

/**
 * A successful checkout leaves nothing to reconcile on the device: the orders
 * are seeded into the cache for the screen that follows, the order lists are
 * marked stale, and the cart — closed on the server — is marked stale so the
 * next read makes a fresh empty one. One rendered test per file, for the reason
 * `use-create-order-success.test.tsx` documents.
 */

jest.mock('@/services/api/checkout-service');
jest.mock('@/hooks/use-delivery-address', () => ({
  useCurrentCustomer: () => ({ data: { id: 'customer-1' } }),
}));

const mockedCheckout = jest.mocked(checkoutService);

function order(id: string, restaurantId: string): OrderOutput {
  return orderOutputSchema.parse({ id, restaurantId, status: 'CREATED', total: 12, items: [] });
}

it('seeds each placed order, and marks the order lists and the closed cart stale', async () => {
  mockedCheckout.placeOrders.mockResolvedValue({
    cartId: 'cart-1',
    orders: [order('o1', 'r1'), order('o2', 'r2')],
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(cartKeys.active('customer-1'), { id: 'cart-1' });
  client.setQueryData(orderKeys.list('customer-1'), []);

  let checkout: ReturnType<typeof useCheckout> | null = null;
  function Probe() {
    checkout = useCheckout();
    return null;
  }

  await render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );

  await act(async () => {
    checkout!.mutate();
  });

  await waitFor(() => expect(checkout!.isSuccess).toBe(true));

  // Called with no arguments: the server reads everything from the cart.
  expect(mockedCheckout.placeOrders).toHaveBeenCalledWith();
  expect(client.getQueryData<OrderOutput>(orderKeys.detail('o1'))?.restaurantId).toBe('r1');
  expect(client.getQueryData<OrderOutput>(orderKeys.detail('o2'))?.restaurantId).toBe('r2');
  expect(client.getQueryState(orderKeys.list('customer-1'))?.isInvalidated).toBe(true);
  expect(client.getQueryState(cartKeys.active('customer-1'))?.isInvalidated).toBe(true);
});
