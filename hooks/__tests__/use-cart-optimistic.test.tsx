import { useSetItemQuantity } from '@/hooks/use-cart';
import { cartOutputSchema, type CartOutput } from '@/schemas/cart';
import * as cartService from '@/services/api/cart-service';
import { cartKeys } from '@/services/api/query-keys';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react-native';

/**
 * Tapping `+` moves the line at once and the server's recalculated cart then
 * replaces the guess: the customer sees the quantity change immediately, but the
 * totals shown afterwards are always the server's. One rendered test per file,
 * for the reason `use-create-order-success.test.tsx` documents.
 */

jest.mock('@/services/api/cart-service');
jest.mock('@/hooks/use-delivery-address', () => ({
  useCurrentCustomer: () => ({ data: { id: 'customer-1' } }),
}));

const mockedCartService = jest.mocked(cartService);
const KEY = cartKeys.active('customer-1');

function cart(quantity: number, total: number): CartOutput {
  return cartOutputSchema.parse({
    id: 'cart-1',
    items: [
      {
        id: 'line-1',
        productName: 'Margherita',
        quantity,
        restaurantId: 'r1',
        unitPrice: 10,
        lineTotal: 10 * quantity,
      },
    ],
    subtotal: 10 * quantity,
    total,
  });
}

it('shows the new quantity at once, then replaces it with the server\'s recalculated cart', async () => {
  let respond: (cart: CartOutput) => void = () => {};
  mockedCartService.updateCartItemQuantity.mockReturnValue(
    new Promise((resolve) => {
      respond = resolve;
    })
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(KEY, cart(1, 12));

  let setQuantity: ReturnType<typeof useSetItemQuantity> | null = null;
  function Probe() {
    setQuantity = useSetItemQuantity();
    return null;
  }

  await render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );

  await act(async () => {
    setQuantity!.mutate({ itemId: 'line-1', quantity: 3 });
  });

  // In flight: the line has moved, the totals have not — they are the server's to change.
  await waitFor(() => expect(client.getQueryData<CartOutput>(KEY)?.items[0].quantity).toBe(3));
  expect(client.getQueryData<CartOutput>(KEY)?.items[0].lineTotal).toBe(30);
  expect(client.getQueryData<CartOutput>(KEY)?.total).toBe(12);
  expect(mockedCartService.updateCartItemQuantity).toHaveBeenCalledWith('line-1', 3);

  // The server answers with the whole recalculated cart, fees and all.
  await act(async () => {
    respond(cart(3, 34.5));
  });

  await waitFor(() => expect(client.getQueryData<CartOutput>(KEY)?.total).toBe(34.5));
  expect(client.getQueryData<CartOutput>(KEY)?.items[0].quantity).toBe(3);
});
