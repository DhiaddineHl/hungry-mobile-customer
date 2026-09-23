import type { AddCartItemInput, CartOutput, CheckoutOptionsInput } from '@/schemas/cart';
import {
  addCartItem,
  clearCart,
  fetchActiveCart,
  removeCartItem,
  removeRestaurantItems,
  updateCartItemQuantity,
  updateCheckoutOptions,
} from '@/services/api/cart-service';
import {
  cartItemCount,
  withItemQuantity,
  withoutItem,
  withoutRestaurant,
} from '@/services/api/cart-view-model';
import { cartKeys } from '@/services/api/query-keys';
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentCustomer } from './use-delivery-address';

/**
 * The customer's cart — the server's, not a copy of ours.
 *
 * Reading: {@link useActiveCart} asks the server for the latest state every
 * time a screen that shows the cart mounts (`staleTime: 0`,
 * `refetchOnMount: 'always'`). That is deliberate: the server recomputes fees
 * and re-evaluates promotions on every read, so an hour-old cache would show a
 * surcharge that has ended or miss a promotion that started.
 *
 * Writing: every mutation returns the whole recalculated cart, which replaces
 * the cache. Mutations share one `scope`, so TanStack runs them **one at a
 * time, in order** — three quick taps on "+" are three requests in sequence,
 * never a race in which an older response overwrites a newer one.
 *
 * Nothing retries: adding a dish twice because a response was lost would put
 * two of it in the cart.
 */

/** All cart mutations run serially, in the order they were made. */
const CART_MUTATION_SCOPE = { id: 'active-cart' };
const CART_MUTATION_KEY = ['cart-mutation'] as const;

/** The signed-in customer's active cart, or `undefined` until it is loaded (and while signed out). */
export function useActiveCart() {
  const { data: customer } = useCurrentCustomer();
  const customerId = customer?.id;

  return useQuery({
    queryKey: cartKeys.active(customerId ?? ''),
    queryFn: fetchActiveCart,
    enabled: !!customerId,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });
}

/** Units in the cart, for the tab-bar badge. Zero until the cart has loaded. */
export function useCartItemCount(): number {
  const { data } = useActiveCart();
  return cartItemCount(data);
}

/** True while any cart change is on its way to the server — the totals shown are then about to change. */
export function useIsCartUpdating(): boolean {
  return useIsMutating({ mutationKey: CART_MUTATION_KEY }) > 0;
}

interface CartMutationContext {
  previous?: CartOutput;
}

/**
 * One cart mutation. `optimistic` (optional) edits the cached cart before the
 * request goes out; an error puts the previous cart back and re-reads the
 * server's, so a rejected change never leaves a phantom line on screen.
 */
function useCartMutation<TVariables>(
  request: (variables: TVariables) => Promise<CartOutput>,
  optimistic?: (cart: CartOutput, variables: TVariables) => CartOutput
) {
  const queryClient = useQueryClient();
  const { data: customer } = useCurrentCustomer();
  const queryKey = cartKeys.active(customer?.id ?? '');

  return useMutation<CartOutput, Error, TVariables, CartMutationContext>({
    mutationKey: CART_MUTATION_KEY,
    scope: CART_MUTATION_SCOPE,
    retry: false,
    mutationFn: request,
    onMutate: async (variables) => {
      if (!optimistic) return {};
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CartOutput>(queryKey);
      if (previous) queryClient.setQueryData(queryKey, optimistic(previous, variables));
      return { previous };
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(queryKey, cart);
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

/** Adds a dish. Not optimistic: a new line has no server id until the response arrives. */
export function useAddToCart() {
  return useCartMutation<AddCartItemInput>(addCartItem);
}

export function useSetItemQuantity() {
  return useCartMutation<{ itemId: string; quantity: number }>(
    ({ itemId, quantity }) => updateCartItemQuantity(itemId, quantity),
    (cart, { itemId, quantity }) => withItemQuantity(cart, itemId, quantity)
  );
}

export function useRemoveCartItem() {
  return useCartMutation<string>(removeCartItem, (cart, itemId) => withoutItem(cart, itemId));
}

/** Removes every line from one restaurant. */
export function useClearRestaurantItems() {
  return useCartMutation<string>(removeRestaurantItems, (cart, restaurantId) =>
    withoutRestaurant(cart, restaurantId)
  );
}

export function useClearCart() {
  return useCartMutation<void>(() => clearCart());
}

/**
 * Delivery address, payment method, note and coupon. Not optimistic: delivery
 * fees depend on the address, so the response is the only honest answer.
 */
export function useUpdateCheckoutOptions() {
  return useCartMutation<CheckoutOptionsInput>(updateCheckoutOptions);
}
