import { blockersOf, placeOrders, type CheckoutOutput } from '@/services/api/checkout-service';
import { cartKeys, orderKeys } from '@/services/api/query-keys';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentCustomer } from './use-delivery-address';

/**
 * Place the order — the one call the checkout screen makes.
 *
 * `POST /checkout` takes no parameters: the server turns the customer's active
 * cart into one order per restaurant, atomically. So there is no partial
 * failure to model any more — either the mutation succeeds with every order or
 * it fails with none — and nothing on the device to clear or reconcile: the
 * cart was closed on the server, and the next read of it is a fresh empty one.
 *
 * `retry: false`, always. A create that failed after its insert would, if
 * retried, place the same order twice — and an order is a delivery.
 */
export function useCheckout() {
  const queryClient = useQueryClient();
  const { data: customer } = useCurrentCustomer();
  const customerId = customer?.id ?? '';

  return useMutation<CheckoutOutput, Error, void>({
    mutationFn: () => placeOrders(),
    retry: false,
    onSuccess: (result) => {
      // Seed each order's detail so a confirmation renders without a round trip.
      for (const order of result.orders) {
        queryClient.setQueryData(orderKeys.detail(order.id), order);
      }
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      // The old cart is closed; whatever is cached now is stale, and the next read makes a new one.
      void queryClient.invalidateQueries({ queryKey: cartKeys.active(customerId) });
    },
    onError: (error) => {
      // A not-ready refusal means the cart changed under the customer (another device, a blocker):
      // re-read it so the screen shows what is actually there.
      if (blockersOf(error).length > 0) {
        void queryClient.invalidateQueries({ queryKey: cartKeys.active(customerId) });
      }
    },
  });
}
