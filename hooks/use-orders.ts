import type { OrderInput, OrderOutput } from '@/schemas/order';
import { deleteCart } from '@/services/api/cart-service';
import {
  createOrder,
  fetchOrderById,
  isUuid,
} from '@/services/api/order-service';
import { orderTotals } from '@/services/api/order-view-model';
import { orderKeys } from '@/services/api/query-keys';
import { useCartStore, type CartLine } from '@/store/cart-store';
import { useOrderPriceStore } from '@/store/order-price-store';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

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

/** One of the orders a checkout places: the payload, and whose lines it takes. */
export interface CheckoutOrder {
  input: OrderInput;
  /** The restaurant whose lines leave the cart once this order is confirmed. */
  restaurantId: string;
}

/**
 * A checkout that stopped part-way: some orders exist, one does not.
 *
 * Thrown rather than returned so the mutation is in its error state — the
 * screen must not read a partial checkout as success — while still carrying
 * what DID happen. The orders in `placed` are real and have drivers coming;
 * the lines of `failedRestaurantId` and every restaurant after it are still
 * in the cart, untouched, ready for a manual retry.
 */
export class PartialCheckoutError extends Error {
  constructor(
    readonly placed: OrderOutput[],
    readonly failedRestaurantId: string,
    readonly reason: unknown
  ) {
    super(
      reason instanceof Error ? reason.message : 'Could not place one of the orders.'
    );
    this.name = 'PartialCheckoutError';
  }
}

/**
 * Places one order per restaurant, in the order given, and returns them.
 *
 * ONE cart becomes SEVERAL orders here: the backend `Order` has a single
 * `restaurant`, so a cart drawn from three restaurants is three POSTs. They
 * go out one at a time, and each restaurant's lines leave the cart — locally,
 * with its prices recorded — the moment ITS order is confirmed, never before
 * and never in a batch at the end:
 *
 *   - never before, because a failed checkout must leave the cart
 *     **completely intact**. The cart is the only record of what the customer
 *     configured — addons and per-line notes exist nowhere else (`toCartInput`
 *     cannot send them), so a cleared cart after a failed create is
 *     unrecoverable data loss;
 *   - never in a batch, because if the second POST fails the first order
 *     already exists and has a driver coming. Its lines must be gone from the
 *     cart, or "Try Again" would order the same food twice.
 *
 * A failure stops the sequence: the remaining restaurants are not attempted,
 * their lines stay, and a {@link PartialCheckoutError} says which order broke.
 *
 * The backend cart is only deleted once the LOCAL cart is empty. While lines
 * remain, the server copy is simply stale, and the sync engine rewrites it on
 * the next pass — that is cheaper and safer than re-posting from here.
 */
export async function placeCheckoutOrders(
  orders: CheckoutOrder[],
  queryClient: QueryClient
): Promise<OrderOutput[]> {
  const placed: OrderOutput[] = [];

  for (const { input, restaurantId } of orders) {
    let order: OrderOutput;
    try {
      order = await createOrder(input);
    } catch (error) {
      throw new PartialCheckoutError(placed, restaurantId, error);
    }
    placed.push(order);

    const store = useCartStore.getState();

    // The prices, BEFORE the lines that hold them are cleared. This is the
    // only moment they exist: the backend stores no price, fee or total on
    // an order (plan §3.3), so without this the order screen could never say
    // what the customer paid.
    recordOrderPrices(
      order.id,
      store.items.filter((line) => line.restaurantId === restaurantId)
    );

    // Local first: it is synchronous and cannot fail, so the customer never
    // sees a cart they have already paid for on delivery.
    store.clearRestaurant(restaurantId);

    // Seed the detail cache so a confirmation screen renders without a
    // round-trip — which also side-steps the plan §2.2 defect where a
    // re-read of a fresh order comes back with `items: []`.
    queryClient.setQueryData(orderKeys.detail(order.id), order);
  }

  const store = useCartStore.getState();
  if (store.items.length === 0 && store.remote.cartId) {
    try {
      await deleteCart(store.remote.cartId);
      store.resetSyncState();
    } catch {
      // The orders exist; that is what matters. A stale server cart is
      // reconciled by the next `syncCart` pass, which deletes the row for an
      // empty cart.
    }
  }

  return placed;
}

/**
 * The checkout mutation: every order of one checkout, placed by
 * {@link placeCheckoutOrders}.
 *
 * The side effects live in the mutation function rather than in `onSuccess`
 * because they are PER ORDER, not per checkout — and they must happen whether
 * or not the checkout screen is still mounted.
 */
export function useCreateOrders() {
  const queryClient = useQueryClient();

  return useMutation<OrderOutput[], Error, CheckoutOrder[]>({
    mutationFn: (orders) => placeCheckoutOrders(orders, queryClient),

    // Never auto-retry — see the module header. This is the single most
    // consequential line in the file.
    retry: false,

    // No `onError`: leaving the unordered lines alone IS the error handling.
  });
}

/**
 * Files what this order cost, keyed by the id the server just assigned.
 *
 * A cart that priced to nothing is not recorded: an empty receipt would only
 * shadow the menu-price fallback with a row of zeroes.
 */
function recordOrderPrices(orderId: string, lines: CartLine[]): void {
  if (lines.length === 0) return;

  useOrderPriceStore.getState().record(orderId, {
    ...orderTotals(lines),
    lines: lines.map((line) => ({
      lineId: line.lineId,
      foodId: line.foodId,
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      basePrice: line.basePrice,
      addons: line.addons.map((addon) => ({ name: addon.name, price: addon.price })),
    })),
    savedAt: new Date().toISOString(),
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
