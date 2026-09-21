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
import { fetchRestaurantIdForSection } from '@/services/api/menu-service';
import { fetchProductById } from '@/services/api/product-service';
import { selectPrice } from '@/services/api/product-view-model';
import { cartKeys } from '@/services/api/query-keys';
import { fetchRestaurantById } from '@/services/api/restaurant-service';
import {
  toRestaurantDetail,
  type RestaurantDetail,
} from '@/services/api/restaurant-view-model';
import {
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
 * ONE cart per customer. The local store stays authoritative: it holds
 * addons, per-line notes, prices and — crucially — which restaurant each line
 * is from, none of which `Cart` has a column for. The backend cart is a
 * durable copy so a cart survives a reinstall — not a second opinion about
 * what is in it (plan §4.1).
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
 */
export async function syncCart(customerId: string | null): Promise<void> {
  // Signed out: do nothing, and leave the local cart completely alone. An
  // unsynced cart is still a usable cart.
  if (!customerId) return;

  const state = useCartStore.getState();
  const { setSyncState, resetSyncState } = state;
  const sync = state.remote;

  // 1. The customer emptied the cart: the server copy has to go.
  if (state.items.length === 0) {
    if (!sync.cartId) return;
    try {
      await deleteCart(sync.cartId);
      resetSyncState();
    } catch {
      // Left in place on purpose; the next pass tries again.
    }
    return;
  }

  // 2. The contents no longer match what was last written.
  const signature = syncSignature(state.items);
  if (sync.syncedSignature === signature && sync.status === 'synced') return;

  setSyncState({ status: 'syncing', error: undefined });

  try {
    const saved = await replaceCart(
      toCartInput({ customerId, lines: state.items }),
      sync.cartId ?? undefined
    );

    // Written only once the create has returned — never optimistically, so
    // the UI cannot show "saved" for a cart the server does not have.
    setSyncState({
      cartId: saved?.id ?? null,
      syncedSignature: signature,
      status: 'synced',
      error: undefined,
    });
  } catch (error) {
    // `syncedSignature` deliberately keeps its old value, so the next change
    // still sees a mismatch and retries.
    setSyncState({
      status: 'error',
      error: error instanceof Error ? error.message : 'Could not save your cart.',
    });
  }
}

/**
 * Watches the cart and writes it to the backend.
 *
 * Mount once, from the cart screen. All this adds to {@link syncCart} is the
 * debounce — tapping `+` five times has to issue one sync, not five — and a
 * guard so a second pass cannot start while the first is still writing.
 */
export function useCartSync() {
  const { data: customer } = useCurrentCustomer();
  const customerId = customer?.id ?? null;

  const items = useCartStore((s) => s.items);

  const inFlight = useRef(false);

  /**
   * Bumped by {@link retry}. A failed cart's contents have not changed, so
   * `desired` below is identical and would never re-arm the effect on its own.
   */
  const [retryNonce, setRetryNonce] = useState(0);

  const retry = useCallback(() => {
    useCartStore.getState().setSyncState({ status: 'idle', error: undefined });
    setRetryNonce((nonce) => nonce + 1);
  }, []);

  // What the server SHOULD hold, as a plain string: the effect re-arms when
  // this changes and only then. Deriving it from `syncSignature` means an
  // addon or note edit — which the backend cannot store — does not re-arm it.
  const desired = syncSignature(items);

  useEffect(() => {
    if (!customerId) return;

    const timer = setTimeout(async () => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await syncCart(customerId);
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
  /**
   * The server row these lines came from — set only when they came from
   * exactly ONE cart written under the current code scheme. Lines folded
   * together from legacy per-restaurant rows have no single row to point at;
   * the sync engine writes one and deletes the rest.
   */
  cartId: string | null;
  /** The signature of the lines below, so hydration does not trigger a resync. */
  signature: string;
  lines: CartLine[];
}

/**
 * Per-hydration memo, so one restored cart resolves each restaurant and each
 * menu section once rather than once per line.
 */
interface HydrationCache {
  restaurants: Map<string, Promise<RestaurantDetail | null>>;
  sections: Map<string, Promise<string | null>>;
}

function restaurantFor(cache: HydrationCache, restaurantId: string) {
  let pending = cache.restaurants.get(restaurantId);
  if (!pending) {
    pending = fetchRestaurantById(restaurantId).then((output) =>
      output ? toRestaurantDetail(output) : null
    );
    cache.restaurants.set(restaurantId, pending);
  }
  return pending;
}

function restaurantIdForSection(cache: HydrationCache, sectionId: string) {
  let pending = cache.sections.get(sectionId);
  if (!pending) {
    pending = fetchRestaurantIdForSection(sectionId);
    cache.sections.set(sectionId, pending);
  }
  return pending;
}

/**
 * Rebuilds one backend cart into local lines. The result may be empty.
 *
 * Every line needs a restaurant: without one there is no order for checkout
 * to put it in. A legacy cart names its restaurant in its code; a current
 * cart does not, so the restaurant is resolved from the product's own menu
 * section (`fetchRestaurantIdForSection`). A line whose restaurant cannot be
 * resolved is dropped, as is one whose product is gone or has no applicable
 * price: rendering a nameless, unpriced or un-orderable line is worse than
 * not restoring it.
 */
async function hydrateLines(cart: CartOutput, cache: HydrationCache): Promise<CartLine[]> {
  const identity = parseCartCode(cart.code);
  if (!identity) return [];

  const lines: CartLine[] = [];

  for (const item of cart.items) {
    if (!item.productId) continue;

    const quantity = typeof item.quantity === 'number' ? item.quantity : 0;
    if (quantity <= 0) continue;

    const product = await fetchProductById(item.productId);
    if (!product) continue;

    const price = selectPrice(product.prices, new Date());
    if (!price) continue;

    let restaurantId = identity.restaurantId;
    if (!restaurantId) {
      for (const section of product.subcategories) {
        if (!section.id) continue;
        restaurantId = await restaurantIdForSection(cache, section.id);
        if (restaurantId) break;
      }
    }
    if (!restaurantId) continue;

    const restaurant = await restaurantFor(cache, restaurantId);
    if (!restaurant) continue;

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

  return lines;
}

/**
 * Two hydrated lines of the same dish — from two legacy rows, say — collapse
 * into one, exactly as two `addItem` calls would.
 */
function mergeLines(lines: CartLine[]): CartLine[] {
  const merged = new Map<string, CartLine>();
  for (const line of lines) {
    const existing = merged.get(line.lineId);
    merged.set(
      line.lineId,
      existing ? { ...existing, quantity: existing.quantity + line.quantity } : line
    );
  }
  return Array.from(merged.values());
}

/**
 * The customer's cart as the server holds it, rebuilt into local lines — or
 * `null` when there is nothing restorable.
 *
 * Every cart row of the customer is read, not just the current one: an
 * earlier build wrote one row per restaurant, and a customer upgrading with
 * three of those must get all three restaurants' dishes back in the one cart.
 */
export async function fetchHydratedCart(customerId: string): Promise<HydratedCart | null> {
  const carts = await fetchCustomerCarts(customerId);
  if (carts.length === 0) return null;

  const cache: HydrationCache = { restaurants: new Map(), sections: new Map() };
  const perCart = await Promise.all(carts.map((cart) => hydrateLines(cart, cache)));
  const lines = mergeLines(perCart.flat());
  if (lines.length === 0) return null;

  // Only a lone current-scheme row is "already synced". Anything else — legacy
  // rows, or several rows — has to be consolidated by the engine, which needs
  // a null id and signature to know that.
  const current = carts.length === 1 && parseCartCode(carts[0].code)?.restaurantId === null
    ? carts[0]
    : null;

  return {
    cartId: current?.id ?? null,
    signature: syncSignature(lines),
    lines,
  };
}

/**
 * Writes a hydrated cart into the store, unless the customer has meanwhile put
 * something in their cart on this device.
 *
 * Returns whether anything was applied. The emptiness check lives here rather
 * than only at the call site because the request is in flight for a while: the
 * customer may add a dish while it is, and that add must win (plan §4.5).
 */
export function applyHydratedCart(cart: HydratedCart | null): boolean {
  const store = useCartStore.getState();
  if (store.items.length > 0) return false;
  if (!cart || cart.lines.length === 0) return false;

  store.replaceAll(cart.lines);

  if (cart.cartId) {
    // Already synced by definition — these lines came FROM that row.
    store.setSyncState({
      cartId: cart.cartId,
      syncedSignature: cart.signature,
      status: 'synced',
      error: undefined,
    });
  } else {
    // Folded together from legacy rows: the engine must write the single cart
    // and delete them, which a fresh sync state is what makes it do.
    store.resetSyncState();
  }

  return true;
}

/**
 * Restores the customer's server cart onto an EMPTY local cart, once.
 *
 * A non-empty local cart suppresses hydration entirely — local wins (plan
 * §4.5). Merging two carts that disagree about addons has no correct answer,
 * and the device in the customer's hand is the better source.
 */
export function useHydrateCart() {
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
    queryFn: () => fetchHydratedCart(customerId!),
    enabled: !!customerId && isLocalCartEmpty,
    // `query-client` retries 500s twice, and this path reads carts whose
    // not-found IS a 500 — that would triple every probe for nothing.
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (done.current || query.data === undefined) return;
    done.current = true;
    applyHydratedCart(query.data);
  }, [query.data]);

  return { isHydrating: query.isFetching };
}
