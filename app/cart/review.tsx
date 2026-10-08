import { useRouter } from 'expo-router';
import { CartView } from '@/components/cart/cart-view';
import { useCartStore } from '@/store/cart-store';

/**
 * The same cart (C1), pushed over another screen. Read-only on sync: the sync
 * engine is mounted on the Cart tab, so this reports the last known state
 * rather than driving a write of its own.
 */
export default function CartReviewScreen() {
  const router = useRouter();
  const syncStatus = useCartStore((s) => s.remote.status);
  return <CartView onBack={() => router.back()} syncStatus={syncStatus} />;
}
