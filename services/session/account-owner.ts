import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PAYMENT_METHOD, usePaymentMethodStore } from '@/store/payment-method-store';
import { useCartStore } from '@/store/cart-store';
import { useFavoritesStore } from '@/store/favorites-store';
import { useOrderPriceStore } from '@/store/order-price-store';
import { useRecentSearchStore } from '@/store/recent-search-store';

/**
 * Which account the device-local data belongs to.
 *
 * A plain sign-out deliberately keeps the cart, favourites, receipts, recent
 * searches and payment choice, so the same customer finds them again on the
 * next sign-in. On a shared phone that same choice would hand them to the NEXT
 * person — and the cart sync would push the previous account's lines into the
 * new account's server cart. So the owner is recorded, and a session for a
 * different account wipes that data before anything reads or syncs it.
 *
 * A device with no recorded owner (a fresh install, or data written before
 * this existed) adopts the first account that signs in.
 */
const OWNER_KEY = 'hungry-device-data-owner';

export async function claimDeviceData(accountId: string): Promise<void> {
  const owner = await AsyncStorage.getItem(OWNER_KEY).catch(() => null);
  if (owner === accountId) return;

  if (owner !== null) {
    // A clear that lands before a store has rehydrated would be overwritten by
    // the hydration that follows it.
    await Promise.all(
      [useCartStore, useFavoritesStore, useOrderPriceStore, useRecentSearchStore, usePaymentMethodStore].map(
        (store) =>
          store.persist.hasHydrated()
            ? undefined
            : new Promise<void>((resolve) => store.persist.onFinishHydration(() => resolve()))
      )
    );
    useCartStore.getState().clear();
    useFavoritesStore.getState().clear();
    useOrderPriceStore.getState().clear();
    useRecentSearchStore.getState().clear();
    usePaymentMethodStore.getState().setMethod(DEFAULT_PAYMENT_METHOD);
  }
  await AsyncStorage.setItem(OWNER_KEY, accountId).catch(() => undefined);
}

/** Account deletion: the data is gone with the account, and so is the owner. */
export async function releaseDeviceData(): Promise<void> {
  await AsyncStorage.removeItem(OWNER_KEY).catch(() => undefined);
}
