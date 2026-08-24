import type { CartOutput } from '@/schemas/cart';
import {
  deleteCart,
  fetchCustomerCarts,
  replaceCart,
} from '@/services/api/cart-service';
import {
  parseCartCode,
  syncSignature,
  toCartInput,
} from '@/services/api/cart-view-model';
import { fetchProductById } from '@/services/api/product-service';
import { selectPrice } from '@/services/api/product-view-model';
import { cartKeys } from '@/services/api/query-keys';
import { fetchRestaurantById } from '@/services/api/restaurant-service';
import { toRestaurantDetail } from '@/services/api/restaurant-view-model';
import {
  groupByRestaurant,
  lineSignature,
  useCartStore,
  type CartLine,
} from '@/store/cart-store';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCurrentCustomer } from './use-delivery-address';

/**
 * Keeps the local cart and its backend projection in step.
 *
 * The local store stays authoritative: it holds addons, per-line notes and
 * prices, none of which `Cart` has a column for. The backend cart is a durable
 * copy so a cart survives a reinstall — not a second opinion about what is in
 * it (plan §4.1).
 *
 * Every write is a DELETE followed by a POST, because `PUT /carts` answers 200
 * with an empty body and persists nothing. See `services/api/cart-service.ts`.
 */

/**
 * Long enough that tapping `+` five times issues one sync rather than five,
 * short enough that leaving the screen straight after adding still saves.
 */
const SYNC_DEBOUNCE_MS = 800;

// --- Pushing local state up ---------------------------------------------

/**
 * One full pass of the sync engine, against whatever the store holds RIGHT NOW.
 *
 * Deliberately a plain async function rather than something buried in an
 * effect: this is where every backend write decision is made, so it has to be
 * unit-testable without a renderer — the same reason `cart-view-model.ts` is a
 * pure module.
 *
 * `knownCartIds` is the caller's, and is mutated in place. It records cart ids
 * seen this session so an emptied group can still have its server row deleted:
 * `clearRestaurant` drops the group's sync state along with its items, and
 * without this map the id would be gone before the engine ever ran.
 */
export async function syncCarts(
  customerId: string | null,
  knownCartIds: Map<string, string>
): Promise<void> {
  // Signed out: do nothing, and leave the local cart completely alone. An
  // unsynced cart is still a usable cart.
  if (!customerId) return;

  const state = useCartStore.getState();
  const { setSyncState, clearSyncState } = state;
  const live = groupByRestaurant(state.items);
  const liveIds = new Set(live.map((group) => group.restaurantId));

  // Seed from the persisted slice so a cart written before a restart is still
  // reachable for deletion.
  for (const [restaurantId, sync] of Object.entries(state.remote)) {
    if (sync.cartId) knownCartIds.set(restaurantId, sync.cartId);
  }

  // 1. Groups the customer emptied or deleted: the server copy has to go.
  for (const [restaurantId, cartId] of Array.from(knownCartIds)) {
    if (liveIds.has(restaurantId)) continue;
    try {
      await deleteCart(cartId);
      knownCartIds.delete(restaurantId);
      clearSyncState(restaurantId);
    } catch {
      // Left in the map on purpose; the next pass tries again.
    }
  }

  // 2. Groups whose contents no longer match what was last written.
  for (const group of live) {
    const signature = syncSignature(group.items);
    const sync = useCartStore.getState().remote[group.restaurantId];

    if (sync?.syncedSignature === signature && sync.status === 'synced') continue;

    setSyncState(group.restaurantId, { status: 'syncing', error: undefined });

    try {
      const input = toCartInput({
        customerId,
        restaurantId: group.restaurantId,
        restaurantName: group.restaurantName,
        lines: group.items,
      });

      const saved = await replaceCart(
        input,
        sync?.cartId ?? knownCartIds.get(group.restaurantId)
      );

      if (saved) {
        knownCartIds.set(group.restaurantId, saved.id);
      } else {
        knownCartIds.delete(group.restaurantId);
      }

      // Written only once the create has returned — never optimistically, so
      // the UI cannot show "saved" for a cart the server does not have.
      setSyncState(group.restaurantId, {
        cartId: saved?.id ?? null,
        syncedSignature: signature,
        status: 'synced',
        error: undefined,
      });
    } catch (error) {
      // `syncedSignature` deliberately keeps its old value, so the next change
      // still sees a mismatch and retries.
      setSyncState(group.restaurantId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Could not save this cart.',
      });
    }
  }
}

/**
 * Watches the cart and writes each restaurant group to the backend.
 *
 * Mount once, from the cart screen. All this adds to {@link syncCarts} is the
 * debounce — tapping `+` five times has to issue one sync, not five — and a
 * guard so a second pass cannot start while the first is still writing.
 */
export function useCartSync() {
  const { data: customer } = useCurrentCustomer();
  const customerId = customer?.id ?? null;

  const items = useCartStore((s) => s.items);

  const knownCartIds = useRef(new Map<string, string>());
  const inFlight = useRef(false);

  /**
   * Bumped by {@link retry}. A failed group's contents have not changed, so
   * `desired` below is identical and would never re-arm the effect on its own.
   */
  const [retryNonce, setRetryNonce] = useState(0);

  const retry = useCallback((restaurantId: string) => {
    useCartStore.getState().setSyncState(restaurantId, {
      status: 'idle',
      error: undefined,
    });
    setRetryNonce((nonce) => nonce + 1);
  }, []);

  // What the server SHOULD hold, as a plain string: the effect re-arms when
  // this changes and only then. Deriving it from `syncSignature` means an
  // addon or note edit — which the backend cannot store — does not re-arm it.
  const desired = groupByRestaurant(items)
    .map((group) => `${group.restaurantId}=${syncSignature(group.items)}`)
    .sort()
    .join(';');

  useEffect(() => {
    if (!customerId) return;

    const timer = setTimeout(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await syncCarts(customerId, knownCartIds.current);
      } finally {
        inFlight.current = false;
      }
    }, SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [customerId, desired, retryNonce]);

  return { retry };
}

// --- Reading remote carts back down -------------------------------------

export interface HydratedCart {
  restaurantId: string;
  cartId: string;
  /** The signature of the lines below, so hydration does not trigger a resync. */
  signature: string;
  lines: CartLine[];
}

/**
 * Rebuilds one backend cart into local lines, or `null` when it cannot be
 * rebuilt faithfully.
 *
 * A cart is dropped entirely when its restaurant no longer resolves — without
 * one there is no group to file the lines under and no name to show. Individual
 * lines are dropped when the product is gone or has no applicable price:
 * rendering a nameless or unpriced line is worse than not restoring it.
 */
async function hydrateCart(cart: CartOutput): Promise<HydratedCart | null> {
  const identity = parseCartCode(cart.code);
  if (!identity) return null;

  const restaurantOutput = await fetchRestaurantById(identity.restaurantId);
  if (!restaurantOutput) return null;
  const restaurant = toRestaurantDetail(restaurantOutput);

  const lines: CartLine[] = [];

  for (const item of cart.items) {
    if (!item.productId) continue;

    const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
    if (quantity <= 0) continue;

    const product = await fetchProductById(item.productId);
    if (!product) continue;

    const price = selectPrice(product.prices, new Date());
    if (!price) continue;

    const line = {
      foodId: product.id,
      name: product.name ?? item.productName ?? '',
      // Artwork is a separate request per product; fanning that out across a
      // whole cart is an N+1, so hydrated lines fall through to the
      // placeholder (MENU-01 §3.5).
      image: undefined,
      unitPrice: price.amount,
      basePrice: price.amount,
      quantity,
      // NOT "the customer chose none" — `CartItem` is `{cart, product,
      // quantity}`, so addons and notes were never stored to begin with.
      addons: [],
      note: undefined,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantLogo: restaurant.logoPath,
      hydrated: true,
    };

    // Minted the same way `addItem` does, so a later local add of this dish
    // merges into this line instead of sitting beside it.
    lines.push({ ...line, lineId: lineSignature(line) });
  }

  if (lines.length === 0) return null;

  return {
    restaurantId: restaurant.id,
    cartId: cart.id,
    signature: syncSignature(lines),
    lines,
  };
}

/** Every restorable cart the customer has on the server. */
export async function fetchHydratedCarts(customerId: string): Promise<HydratedCart[]> {
  const carts = await fetchCustomerCarts(customerId);
  const hydrated = await Promise.all(carts.map((cart) => hydrateCart(cart)));
  return hydrated.filter((cart): cart is HydratedCart => cart !== null);
}

/**
 * Writes hydrated carts into the store, unless the customer has meanwhile put
 * something in their cart on this device.
 *
 * Returns whether anything was applied. The emptiness check lives here rather
 * than only at the call site because the request is in flight for a while: the
 * customer may add a dish while it is, and that add must win (plan §4.5).
 */
export function applyHydratedCarts(carts: HydratedCart[]): boolean {
  const store = useCartStore.getState();
  if (store.items.length > 0) return false;
  if (carts.length === 0) return false;

  store.replaceAll(carts.flatMap((cart) => cart.lines));

  for (const cart of carts) {
    // Already synced by definition — these lines came FROM the server.
    store.setSyncState(cart.restaurantId, {
      cartId: cart.cartId,
      syncedSignature: cart.signature,
      status: 'synced',
    });
  }

  return true;
}

/**
 * Restores the customer's server carts onto an EMPTY local cart, once.
 *
 * A non-empty local cart suppresses hydration entirely — local wins (plan
 * §4.5). Merging two carts that disagree about addons has no correct answer,
 * and the device in the customer's hand is the better source.
 */
export function useHydrateCarts() {
  const { data: customer } = useCurrentCustomer();
  const customerId = customer?.id ?? null;

  const isLocalCartEmpty = useCartStore((s) => s.items.length === 0);

  /**
   * Hydration is a one-shot per session, not a subscription.
   *
   * Read only inside the effect, never in `enabled`: emptying the cart
   * re-enables the query, which then serves its cached result — and without
   * this guard that would restore the very cart the customer just deleted.
   */
  const done = useRef(false);

  const query = useQuery({
    queryKey: cartKeys.list(customerId ?? ''),
    queryFn: () => fetchHydratedCarts(customerId!),
    enabled: !!customerId && isLocalCartEmpty,
    // `query-client` retries 500s twice, and this path reads carts whose
    // not-found IS a 500 — that would triple every probe for nothing.
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (done.current || !query.data) return;
    done.current = true;
    applyHydratedCarts(query.data);
  }, [query.data]);

  return { isHydrating: query.isFetching };
}
