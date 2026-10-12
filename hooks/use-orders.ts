import type { CartCheckoutOptionsInput } from '@/schemas/cart';
import type { OrderOutput } from '@/schemas/order';
import {
  checkoutActiveCart,
  updateCheckoutOptions,
} from '@/services/api/cart-service';
import { syncSignature, toCartQuote } from '@/services/api/cart-view-model';
import { fetchOrderById, isUuid } from '@/services/api/order-service';
import { cartKeys, orderKeys } from '@/services/api/query-keys';
import { useCartStore } from '@/store/cart-store';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { syncCart } from './use-cart-sync';

/**
 * Checkout and order reads.
 *
 * Checkout is the backend's: the server cart is brought in step with the
 * local one, the checkout options (address, payment method) are written onto
 * it, and `POST /checkout` turns it into one order per restaurant — priced by
 * the backend's fee rules, in one transaction. What the customer was shown is
 * the cart's own quote, so it is what they are charged.
 *
 * **Nothing retries.** A placed order is enqueued for driver assignment, and a
 * client cannot tell a checkout that failed before the commit from one that
 * failed after it — so the checkout screen offers a MANUAL retry only.
 */

/** Stable, comparable form of the options — the re-quote's cache key. */
function optionsKey(options: CartCheckoutOptionsInput): string {
  const point = options.deliveryAddress?.coordinates;
  return [
    point?.latitude ?? '',
    point?.longitude ?? '',
    options.deliveryAddress?.formattedAddress ?? '',
    options.paymentMethod ?? '',
    options.comment ?? '',
  ].join('|');
}

/**
 * The cart priced for THESE checkout options — mainly the delivery address,
 * which is what a per-km delivery fee is computed from.
 *
 * Writing the options is a replace of four fields on the caller's own cart,
 * so running it as a query (re-run when the address or payment changes) is
 * safe: repeating it changes nothing.
 */
export function useCheckoutQuote(
  customerId: string | null | undefined,
  options: CartCheckoutOptionsInput
) {
  const queryClient = useQueryClient();
  const items = useCartStore((s) => s.items);
  const signature = syncSignature(items);

  return useQuery({
    queryKey: [...cartKeys.active(customerId ?? ''), 'checkout', optionsKey(options), signature],
    queryFn: async () => {
      await syncCart(customerId!, queryClient);
      const cart = await updateCheckoutOptions(options);
      queryClient.setQueryData(cartKeys.active(customerId!), cart);
      return toCartQuote(cart);
    },
    enabled: !!customerId && items.length > 0,
    // Keeps the last price on screen while a new address is being priced.
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Places the whole cart. On success the local cart is emptied and each new
 * order is seeded into the detail cache; on ANY failure the local cart is left
 * exactly as it was — nothing was created (the backend commits all orders or
 * none), and it is the customer's only copy of what they configured.
 */
export async function placeCheckout(
  customerId: string,
  options: CartCheckoutOptionsInput,
  queryClient: QueryClient
): Promise<OrderOutput[]> {
  await syncCart(customerId, queryClient);
  await updateCheckoutOptions(options);

  const { orders } = await checkoutActiveCart();

  useCartStore.getState().clear();
  queryClient.removeQueries({ queryKey: cartKeys.active(customerId) });
  for (const order of orders) {
    queryClient.setQueryData(orderKeys.detail(order.id), order);
  }
  void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });

  return orders;
}

/**
 * The checkout mutation. The side effects live in the mutation function rather
 * than in `onSuccess` so they happen whether or not the screen is still mounted.
 */
export function usePlaceCheckout(customerId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation<OrderOutput[], Error, CartCheckoutOptionsInput>({
    mutationFn: (options) => {
      if (!customerId) throw new Error('Your account is still loading.');
      return placeCheckout(customerId, options, queryClient);
    },
    // Never auto-retry — see the module header.
    retry: false,
  });
}

/**
 * One order by id.
 *
 * `retry: false` for the same reason `fetchOrderById` maps 500 to `null`: a
 * missing order answers 500, and retrying a not-found three times only delays
 * the empty state.
 */
export function useOrder(id: string | null | undefined) {
  return useQuery({
    queryKey: orderKeys.detail(id ?? ''),
    queryFn: () => fetchOrderById(id!),
    enabled: !!id && isUuid(id),
    retry: false,
  });
}
