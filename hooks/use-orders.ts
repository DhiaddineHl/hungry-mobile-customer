import type { OrderInput, OrderOutput } from '@/schemas/order';
import { deleteCart } from '@/services/api/cart-service';
import {
  createOrder,
  fetchOrderById,
  isUuid,
} from '@/services/api/order-service';
import { orderKeys } from '@/services/api/query-keys';
import { useCartStore } from '@/store/cart-store';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Order creation and reads.
 *
 * The one rule that outranks everything else here: **nothing retries.** A
 * successful `POST /orders` enqueues the order for driver assignment
 * (`OrderConsumer`), and the client cannot tell a create that failed before the
 * insert from one that failed after it — so a duplicate order is a duplicate
 * *delivery*, not a duplicate row (plan §3.6,
 * `docs/plans/checkout-order-creation-plan.md`). Every mutation and query below
 * sets `retry: false`, and the checkout screen offers a MANUAL retry only.
 */

interface CreateOrderVariables {
  input: OrderInput;
  /** The restaurant whose cart this checkout empties on success. */
  restaurantId: string;
}

/**
 * Creates an order and, only once the server has confirmed it, clears that
 * restaurant's cart — locally and on the backend.
 *
 * Ordering is deliberate: the cart is cleared in `onSuccess`, never
 * optimistically. A failed checkout must leave the cart **completely intact**,
 * because the cart is the only record of what the customer configured — addons
 * and per-line notes exist nowhere else (`toCartInput` cannot send them), so a
 * cleared cart after a failed create is unrecoverable data loss.
 *
 * Other restaurants' groups are untouched: `clearRestaurant` is scoped to one
 * id, and the backend delete targets that group's own cart row.
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation<OrderOutput, Error, CreateOrderVariables>({
    mutationFn: ({ input }) => createOrder(input),

    // Never auto-retry — see the module header. This is the single most
    // consequential line in the file.
    retry: false,

    onSuccess: async (order, { restaurantId }) => {
      const store = useCartStore.getState();
      const cartId = store.remote[restaurantId]?.cartId ?? null;

      // Local first: it is synchronous and cannot fail, so the customer never
      // sees a cart they have already paid for on delivery.
      store.clearRestaurant(restaurantId);

      if (cartId) {
        try {
          await deleteCart(cartId);
        } catch {
          // The order exists; that is what matters. A stale server cart is
          // reconciled by the next `syncCarts` pass, which deletes the row for
          // a group that is no longer live.
        }
      }

      // Seed the detail cache so a confirmation screen renders without a
      // round-trip — which also side-steps the plan §2.2 defect where a
      // re-read of a fresh order comes back with `items: []`.
      queryClient.setQueryData(orderKeys.detail(order.id), order);
    },

    // No `onError`: leaving the cart alone IS the error handling.
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
