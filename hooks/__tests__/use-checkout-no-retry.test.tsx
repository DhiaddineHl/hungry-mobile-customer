import { useCheckout } from '@/hooks/use-checkout';
import { ApiError } from '@/services/api/client';
import * as checkoutService from '@/services/api/checkout-service';
import { cartKeys, orderKeys } from '@/services/api/query-keys';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';

/**
 * A failed checkout is attempted exactly once. A create that reached the
 * database dispatches a driver, so an automatic retry could place the same
 * order twice — the customer retries by hand, on a cart that is untouched. A
 * not-ready refusal additionally marks the cart stale, because the cart changed
 * under the customer. One rendered test per file, for the reason
 * `use-create-order-success.test.tsx` documents.
 */

jest.mock('@/services/api/checkout-service', () => ({
  ...jest.requireActual('@/services/api/checkout-service'),
  placeOrders: jest.fn(),
}));
jest.mock('@/hooks/use-delivery-address', () => ({
  useCurrentCustomer: () => ({ data: { id: 'customer-1' } }),
}));

const mockedPlaceOrders = jest.mocked(checkoutService.placeOrders);

it('issues exactly one request when the checkout fails, and re-reads the cart on a not-ready refusal', async () => {
  mockedPlaceOrders.mockRejectedValue(
    new ApiError('Your cart cannot be checked out yet', 409, { blockers: ['NO_ADDRESS_COORDINATES'] })
  );

  // Even a client configured to retry everything must not retry a checkout.
  const client = new QueryClient({ defaultOptions: { queries: { retry: 3 }, mutations: { retry: 3 } } });
  client.setQueryData(cartKeys.active('customer-1'), { id: 'cart-1' });

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

  await waitFor(() => expect(checkout!.isError).toBe(true));

  expect(mockedPlaceOrders).toHaveBeenCalledTimes(1);
  expect(client.getQueryState(cartKeys.active('customer-1'))?.isInvalidated).toBe(true);
  // Nothing was placed, so no order was seeded and the order lists were left alone.
  expect(client.getQueryData(orderKeys.detail('o1'))).toBeUndefined();
});
