import { CartView } from '@/components/cart/cart-view';
import { useCartSync, useHydrateCart } from '@/hooks/use-cart-sync';
import { useCartStore } from '@/store/cart-store';

/**
 * The Cart tab (C1). It is also where the backend projection is kept in step:
 * hydration restores the server cart onto an empty device, and the sync engine
 * pushes every later change back up. Both no-op when signed out.
 */
export default function CartScreen() {
  const syncStatus = useCartStore((s) => s.remote.status);
  useHydrateCart();
  const { retry } = useCartSync();
  return <CartView syncStatus={syncStatus} onRetrySync={retry} />;
}
