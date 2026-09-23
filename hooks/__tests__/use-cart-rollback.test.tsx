import { useRemoveCartItem } from '@/hooks/use-cart';
import { cartOutputSchema, type CartOutput } from '@/schemas/cart';
import { ApiError } from '@/services/api/client';
import * as cartService from '@/services/api/cart-service';
import { cartKeys } from '@/services/api/query-keys';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';

/**
 * A change the server rejects must not leave a phantom edit on screen: the cart
 * goes back to what it was and is marked stale so the next read asks the server.
 * One rendered test per file, for the reason `use-create-order-success.test.tsx`
 * documents.
 */

jest.mock('@/services/api/cart-service');
jest.mock('@/hooks/use-delivery-address', () => ({
  useCurrentCustomer: () => ({ data: { id: 'customer-1' } }),
}));

const mockedCartService = jest.mocked(cartService);
const KEY = cartKeys.active('customer-1');

const BEFORE: CartOutput = cartOutputSchema.parse({
  id: 'cart-1',
  items: [
    { id: 'line-1', productName: 'Margherita', quantity: 1, restaurantId: 'r1', unitPrice: 10, lineTotal: 10 },
    { id: 'line-2', productName: 'Salmon', quantity: 1, restaurantId: 'r2', unitPrice: 9, lineTotal: 9 },
  ],
  subtotal: 19,
  total: 21,
});

it('puts the cart back and marks it stale when the server refuses the removal', async () => {
  mockedCartService.removeCartItem.mockRejectedValue(new ApiError('No cart item in your cart.', 404));

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(KEY, BEFORE);

  let remove: ReturnType<typeof useRemoveCartItem> | null = null;
  function Probe() {
    remove = useRemoveCartItem();
    return null;
  }

  await render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );

  await act(async () => {
    remove!.mutate('line-1');
  });

  await waitFor(() => expect(remove!.isError).toBe(true));

  // Rolled back to exactly what it was...
  expect(client.getQueryData<CartOutput>(KEY)).toEqual(BEFORE);
  // ...and flagged so the next read goes to the server, which is the truth.
  expect(client.getQueryState(KEY)?.isInvalidated).toBe(true);
  // One request, not a retry loop: adding or removing twice on a lost response would corrupt the cart.
  expect(mockedCartService.removeCartItem).toHaveBeenCalledTimes(1);
});
