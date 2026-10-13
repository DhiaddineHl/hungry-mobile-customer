import type { CartOutput } from '@/schemas/cart';
import {
  addActiveCartItem,
  fetchActiveCart,
  removeActiveCartItem,
  updateActiveCartItem,
} from '@/services/api/cart-service';
import {
  planCartSync,
  syncSignature,
  toCartQuote,
  type CartQuote,
  type CartSyncOp,
} from '@/services/api/cart-view-model';
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
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentCustomer } from './use-delivery-address';

/**
 * Keeps the local cart and the customer's server cart (`/carts/active`) in
 * step, and hands the screens the PRICE the backend puts on it.
 *
 * ONE cart per customer. The local store stays authoritative for what the
 * customer is building — it answers instantly and works offline — while the
 * server cart is what gets priced (delivery, service and additional fees from
 * the backend's fee rules) and what `POST /checkout` turns into orders. The
 * server stores the full line: product, chosen options and note.
 */

/**
 * Long enough that tapping `+` five times issues one sync rather than five,
 * short enough that leaving the screen straight after adding still saves.
 */
const SYNC_DEBOUNCE_MS = 800;

// --- Pushing local state up ---------------------------------------------

function runOp(op: CartSyncOp): Promise<CartOutput> {
  switch (op.type) {
    case 'remove':
      return removeActiveCartItem(op.itemId);
    case 'update':
      return updateActiveCartItem(op.itemId, op.quantity);
    case 'add':
      return addActiveCartItem(op.input);
  }
}

async function runSync(
  customerId: string,
  queryClient?: QueryClient
): Promise<CartOutput | null> {
  const state = useCartStore.getState();
  const { setSyncState } = state;

  // Nothing here and nothing ever written: there is no server cart to empty,
  // and reading one would only create it.
  if (state.items.length === 0 && !state.remote.cartId) return null;

  const signature = syncSignature(state.items);
  const cached = queryClient?.getQueryData<CartOutput>(cartKeys.active(customerId));
  if (
    cached &&
    state.remote.status === 'synced' &&
    state.remote.syncedSignature === signature
  ) {
    return cached;
  }

  setSyncState({ status: 'syncing', error: undefined });

  try {
    // Read first: the server cart may have been changed from another device,
    // and the diff has to be against what it holds, not what we last wrote.
    let cart = await fetchActiveCart();
    for (const op of planCartSync(state.items, cart)) {
      cart = await runOp(op);
    }

    // Written only once the calls have returned — never optimistically, so
    // the UI cannot show "saved" for a cart the server does not have.
    setSyncState({
      cartId: cart.id,
      syncedSignature: signature,
      status: 'synced',
      error: undefined,
    });
    queryClient?.setQueryData(cartKeys.active(customerId), cart);
    return cart;
  } catch (error) {
    // `syncedSignature` deliberately keeps its old value, so the next change
    // still sees a mismatch and retries.
    setSyncState({
      status: 'error',
      error: error instanceof Error ? error.message : 'Could not save your cart.',
    });
    throw error;
  }
}

/** The tail of the pass queue — see {@link syncCart}. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * One full pass of the sync engine against whatever the store holds when the
 * pass STARTS, resolving to the priced server cart (`null` when there is
 * none). Throws when the server could not be brought in step.
 *
 * Passes are queued, never concurrent: two interleaved diffs would each add
 * the same missing line. That is also what lets checkout simply await a pass
 * and know the server holds exactly the local cart.
 */
export function syncCart(
  customerId: string | null,
  queryClient?: QueryClient
): Promise<CartOutput | null> {
  // Signed out: do nothing, and leave the local cart completely alone. An
  // unsynced cart is still a usable cart.
  if (!customerId) return Promise.resolve(null);

  const pass = queue.then(() => runSync(customerId, queryClient));
  queue = pass.catch(() => undefined);
  return pass;
}

/**
 * Watches the cart and writes it to the backend.
 *
 * Mount once, from the cart tab. All this adds to {@link syncCart} is the
 * debounce — tapping `+` five times has to issue one sync, not five.
 */
export function useCartSync() {
  const { data: customer } = useCurrentCustomer();
  const customerId = customer?.id ?? null;
  const queryClient = useQueryClient();

  const items = useCartStore((s) => s.items);

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
  // this changes and only then.
  const desired = syncSignature(items);

  useEffect(() => {
    if (!customerId) return;

    const timer = setTimeout(() => {
      // Failure is already on the store (the sync badge shows it).
      syncCart(customerId, queryClient).catch(() => undefined);
    }, SYNC_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [customerId, desired, retryNonce, queryClient]);

  return { retry };
}

// --- The price --------------------------------------------------------------

/**
 * What the backend charges for the cart as it stands — or `null` while the
 * server cart does not match the local one yet (a change still syncing), when
 * signed out, or when the cart is empty.
 *
 * Reads the same cache entry the sync engine writes, so every sync pass
 * refreshes it for free; the query itself only fetches when nothing is cached.
 */
export function useCartQuote(): {
  quote: CartQuote | null;
  isUpdating: boolean;
  error: unknown;
} {
  const { data: customer } = useCurrentCustomer();
  const customerId = customer?.id ?? null;
  const items = useCartStore((s) => s.items);
  const syncStatus = useCartStore((s) => s.remote.status);
  const syncError = useCartStore((s) => s.remote.error);

  const query = useQuery({
    queryKey: cartKeys.active(customerId ?? ''),
    queryFn: fetchActiveCart,
    enabled: !!customerId && items.length > 0,
    staleTime: 60_000,
  });

  const signature = syncSignature(items);
  const quote = useMemo(() => (query.data ? toCartQuote(query.data) : null), [query.data]);
  const current = quote && quote.signature === signature ? quote : null;

  return {
    quote: current,
    // No customer means no server cart to wait for (Continue must not hang on it).
    isUpdating: !!customerId && !current && items.length > 0 && syncStatus !== 'error' && !query.error,
    error: syncStatus === 'error' ? syncError : query.error,
  };
}

// --- Reading the server cart back down ------------------------------------

export interface HydratedCart {
  cart: CartOutput;
  /** The signature of the lines below, so hydration does not trigger a resync. */
  signature: string;
  lines: CartLine[];
}

/**
 * Rebuilds the server cart into local lines. Free gifts are the promotion
 * engine's, not the customer's, and are not restored as lines. A line without
 * a restaurant has no order to go into and is dropped.
 */
export async function hydrateLines(cart: CartOutput): Promise<CartLine[]> {
  const restaurants = new Map<string, Promise<RestaurantDetail | null>>();
  const restaurantFor = (id: string) => {
    let pending = restaurants.get(id);
    if (!pending) {
      pending = fetchRestaurantById(id)
        .then((output) => (output ? toRestaurantDetail(output) : null))
        .catch(() => null);
      restaurants.set(id, pending);
    }
    return pending;
  };

  const lines: CartLine[] = [];

  for (const item of cart.items ?? []) {
    if (item.giftItem || !item.productId || !item.restaurantId) continue;

    const quantity = item.quantity ?? 0;
    if (quantity <= 0 || item.unitPrice == null) continue;

    const addons = (item.options ?? [])
      .filter((option) => !!option.attributeId)
      .map((option) => ({
        id: option.attributeId!,
        name: option.name ?? '',
        price: option.price ?? 0,
      }));

    // Only for the logo — the name is already on the line.
    const restaurant = await restaurantFor(item.restaurantId);

    const line = {
      foodId: item.productId,
      name: item.productName ?? '',
      // Artwork is a separate request per product; fanning that out across a
      // whole cart is an N+1, so hydrated lines fall through to the
      // placeholder (MENU-01 §3.5).
      image: undefined,
      unitPrice: item.unitPrice,
      basePrice: item.unitPrice - addons.reduce((sum, addon) => sum + addon.price, 0),
      quantity,
      addons,
      note: item.note ?? undefined,
      restaurantId: item.restaurantId,
      restaurantName: restaurant?.name ?? item.restaurantName ?? '',
      restaurantLogo: restaurant?.logoPath,
      hydrated: true,
    };

    // Minted the same way `addItem` does, so a later local add of this dish
    // merges into this line instead of sitting beside it.
    lines.push({ ...line, lineId: lineSignature(line) });
  }

  return lines;
}

/** The customer's server cart rebuilt into local lines, or `null` when it is empty. */
export async function fetchHydratedCart(): Promise<HydratedCart | null> {
  const cart = await fetchActiveCart();
  const lines = await hydrateLines(cart);
  if (lines.length === 0) return null;
  return { cart, signature: syncSignature(lines), lines };
}

/**
 * Writes a hydrated cart into the store, unless the customer has meanwhile put
 * something in their cart on this device — that add must win (plan §4.5).
 * Returns whether anything was applied.
 */
export function applyHydratedCart(cart: HydratedCart | null): boolean {
  const store = useCartStore.getState();
  if (store.items.length > 0) return false;
  if (!cart || cart.lines.length === 0) return false;

  store.replaceAll(cart.lines);
  // Already synced by definition — these lines came FROM the server cart.
  store.setSyncState({
    cartId: cart.cart.id,
    syncedSignature: cart.signature,
    status: 'synced',
    error: undefined,
  });

  return true;
}

/**
 * Restores the customer's server cart onto an EMPTY local cart, once.
 *
 * A non-empty local cart suppresses hydration entirely — local wins (plan
 * §4.5): the device in the customer's hand is the better source.
 */
export function useHydrateCart() {
  const { data: customer } = useCurrentCustomer();
  const customerId = customer?.id ?? null;
  const queryClient = useQueryClient();

  const isLocalCartEmpty = useCartStore((s) => s.items.length === 0);

  /**
   * Hydration is a one-shot per session, not a subscription. Once the local
   * cart has had lines — restored from here or added by the customer, local
   * wins either way — emptying it must never pull the server copy back: that
   * would restore the very cart the customer just emptied.
   *
   * State adjusted during render rather than in an effect, so `enabled` below
   * is already off in the render where the cart first has lines.
   */
  const [settled, setSettled] = useState(false);
  if (!isLocalCartEmpty && !settled) setSettled(true);

  const query = useQuery({
    queryKey: cartKeys.hydration(customerId ?? ''),
    queryFn: fetchHydratedCart,
    enabled: !!customerId && isLocalCartEmpty && !settled,
    retry: false,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (settled || query.data === undefined || !customerId) return;
    // Applying fills the cart, which settles hydration on the next render.
    if (applyHydratedCart(query.data) && query.data) {
      queryClient.setQueryData(cartKeys.active(customerId), query.data.cart);
    }
  }, [settled, query.data, customerId, queryClient]);

  return { isHydrating: query.isFetching };
}
