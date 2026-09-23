import { migrateLegacyCart } from '@/services/api/legacy-cart-migration';
import { cartKeys } from '@/services/api/query-keys';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useActiveCart } from './use-cart';
import { useCurrentCustomer } from './use-delivery-address';

/** Once per app session: the check itself is cheap, but it must never run twice concurrently. */
let attempted = false;

/**
 * Carries over a cart that an older version of the app kept on the device — see
 * `migrateLegacyCart`. Waits for the customer and their server cart to load
 * (the migration only replays into an empty one), runs once, and refreshes the
 * cart if anything was carried over.
 */
export function useMigrateLegacyCart(): void {
  const queryClient = useQueryClient();
  const { data: customer } = useCurrentCustomer();
  const { data: cart } = useActiveCart();
  const customerId = customer?.id;

  useEffect(() => {
    if (attempted || !customerId || !cart) return;
    attempted = true;

    void migrateLegacyCart({ serverCartIsEmpty: cart.items.length === 0 }).then((migrated) => {
      if (migrated > 0) {
        void queryClient.invalidateQueries({ queryKey: cartKeys.active(customerId) });
      }
    });
  }, [customerId, cart, queryClient]);
}
