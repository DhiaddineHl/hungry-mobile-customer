import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FavoriteImage } from "./favorites-store";

/**
 * A cart line's artwork: the SAME union the favorites store persists — a
 * relative backend path, or a bundled `require(...)` module id. Aliased rather
 * than re-declared so the two stores cannot drift apart, and resolved at
 * render time through `useStoredImageSource` so a stored line survives a
 * change of `EXPO_PUBLIC_API_URL`.
 */
export type CartImage = FavoriteImage;

export interface CartAddon {
  id: string;
  name: string;
  price: number;
}

export interface CartLine {
  /** Stable id for this configured line (same food + addons + note merge). */
  lineId: string;
  foodId: string;
  name: string;
  image?: CartImage;
  /** Per-unit price including selected addons. */
  unitPrice: number;
  basePrice: number;
  quantity: number;
  addons: CartAddon[];
  note?: string;
  restaurantId: string;
  restaurantName: string;
  restaurantLogo?: CartImage;
  /**
   * Rebuilt from the server rather than added on this device.
   *
   * The backend stores only `{product, quantity}` per line, so a hydrated line
   * has NO addons and NO note — not because the customer chose none, but
   * because those were never persisted. The UI says so plainly instead of
   * implying the customisations survived.
   */
  hydrated?: boolean;
}

export type NewCartLine = Omit<CartLine, "lineId">;

/**
 * Where the cart stands against its server-side copy.
 *
 * `synced` means the signature in `syncedSignature` was successfully written;
 * it is set only after a create returns, never optimistically, so the UI can
 * never show a success state for a cart the server does not have.
 */
export type CartSyncStatus = "idle" | "syncing" | "synced" | "error";

export interface CartSyncState {
  /** The backend `Cart.id`, once one exists. */
  cartId: string | null;
  /** The `syncSignature` that was last written successfully. */
  syncedSignature: string | null;
  status: CartSyncStatus;
  error?: string;
}

/**
 * ONE cart per customer, whatever the lines are from.
 *
 * Lines from several restaurants sit side by side in `items`; each still
 * carries its `restaurantId`, because that is what checkout splits on — one
 * backend `Order` per restaurant, out of the one cart. The backend holds the
 * same shape: `Cart` has no restaurant column, `CartItem` is `{product,
 * quantity}`, and `ux_cart_customer_active` allows a customer exactly one
 * ACTIVE cart row.
 */
interface CartState {
  items: CartLine[];
  /**
   * Sync bookkeeping for THE cart — one backend `Cart` row. Persisted so a
   * restart does not re-issue a delete-and-create for a cart that is already
   * up to date.
   */
  remote: CartSyncState;
  addItem: (line: NewCartLine) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  removeItem: (lineId: string) => void;
  /**
   * Drops every line from one restaurant. Checkout calls this once that
   * restaurant's order is confirmed; the other restaurants' lines stay.
   */
  clearRestaurant: (restaurantId: string) => void;
  clear: () => void;
  setSyncState: (patch: Partial<CartSyncState>) => void;
  resetSyncState: () => void;
  /** Replaces the whole cart in one write — used by hydration. */
  replaceAll: (lines: CartLine[]) => void;
}

export const EMPTY_SYNC_STATE: CartSyncState = {
  cartId: null,
  syncedSignature: null,
  status: "idle",
};

/**
 * Signature that lets identical configurations merge into one line.
 *
 * Exported so hydration can mint a `lineId` the same way `addItem` does — a
 * hydrated line and a later local add of the same dish must collapse into one
 * line, which they only do if both compute the id from here.
 */
export function lineSignature(line: NewCartLine): string {
  const addonKey = line.addons
    .map((a) => a.id)
    .sort()
    .join(",");
  return `${line.restaurantId}|${line.foodId}|${addonKey}|${line.note ?? ""}`;
}

/**
 * Persisted-shape history:
 *
 *   - version 0 — `{ items }` only;
 *   - version 1 — adds `remote`, keyed by restaurant id (one server cart per
 *     restaurant);
 *   - version 2 — `remote` is ONE sync state (one server cart per customer).
 *
 * A cart already on a customer's device must survive every upgrade, so each
 * step keeps `items` and only reshapes the bookkeeping: dropping `items` here
 * would silently empty a real cart on first launch after an update.
 *
 * Going from 1 to 2 resets the sync state rather than translating it. The
 * per-restaurant rows it pointed at are not the cart the engine now writes,
 * and `replaceCart` deletes every one of the customer's server carts before
 * creating the single new one — so nothing is lost by forgetting their ids.
 */
export function migrateCartState(persisted: unknown, version: number): CartState {
  const previous = (persisted ?? {}) as Partial<CartState>;

  if (version <= 1) {
    return { ...previous, remote: { ...EMPTY_SYNC_STATE } } as CartState;
  }

  return previous as CartState;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      remote: { ...EMPTY_SYNC_STATE },

      addItem: (line) =>
        set((state) => {
          // Without a restaurant the line has no order to end up in: checkout
          // splits the cart by `restaurantId`, and a line under `""` would be
          // sent as an order for no restaurant. Callers that cannot resolve
          // the restaurant must not add the line at all.
          if (!line.restaurantId) return state;

          const lineId = lineSignature(line);
          const existing = state.items.find((i) => i.lineId === lineId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === lineId
                  ? { ...i, quantity: i.quantity + line.quantity }
                  : i,
              ),
            };
          }
          return { items: [...state.items, { ...line, lineId }] };
        }),

      setQuantity: (lineId, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.lineId === lineId ? { ...i, quantity: Math.max(0, quantity) } : i,
            )
            .filter((i) => i.quantity > 0),
        })),

      increment: (lineId) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i,
          ),
        })),

      decrement: (lineId) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.lineId === lineId ? { ...i, quantity: i.quantity - 1 } : i,
            )
            .filter((i) => i.quantity > 0),
        })),

      removeItem: (lineId) =>
        set((state) => ({
          items: state.items.filter((i) => i.lineId !== lineId),
        })),

      // The sync state is deliberately left alone: the cart still exists, it
      // just has fewer lines, and `syncedSignature` no longer matching is
      // exactly what makes the engine write the smaller cart on its next pass.
      clearRestaurant: (restaurantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.restaurantId !== restaurantId),
        })),

      clear: () => set({ items: [], remote: { ...EMPTY_SYNC_STATE } }),

      setSyncState: (patch) =>
        set((state) => ({ remote: { ...state.remote, ...patch } })),

      resetSyncState: () => set({ remote: { ...EMPTY_SYNC_STATE } }),

      replaceAll: (lines) => set({ items: lines }),
    }),
    {
      name: "hungry-cart",
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      migrate: migrateCartState,
    },
  ),
);

// --- Derived selectors -----------------------------------------------------

export interface RestaurantCartGroup {
  restaurantId: string;
  restaurantName: string;
  restaurantLogo?: CartImage;
  items: CartLine[];
  totalQuantity: number;
  totalPrice: number;
}

/**
 * The cart split by restaurant — the shape checkout turns into orders, and
 * the shape the cart screens render under one heading per restaurant.
 *
 * Groups keep first-appearance order, so a restaurant does not jump around
 * the screen as lines are added to it.
 */
export function groupByRestaurant(items: CartLine[]): RestaurantCartGroup[] {
  const map = new Map<string, RestaurantCartGroup>();
  for (const item of items) {
    let group = map.get(item.restaurantId);
    if (!group) {
      group = {
        restaurantId: item.restaurantId,
        restaurantName: item.restaurantName,
        restaurantLogo: item.restaurantLogo,
        items: [],
        totalQuantity: 0,
        totalPrice: 0,
      };
      map.set(item.restaurantId, group);
    }
    group.items.push(item);
    group.totalQuantity += item.quantity;
    group.totalPrice += item.unitPrice * item.quantity;
  }
  return Array.from(map.values());
}

export function formatDT(value: number): string {
  return value.toFixed(2).replace(".", ",") + " DT";
}

/**
 * Total number of units across every line — what the tab-bar badge shows.
 *
 * Counts quantities rather than lines so bumping a dish from 1 to 2 moves the
 * badge, and returns a primitive so subscribers only re-render when the number
 * itself changes.
 */
export function selectCartItemCount(state: Pick<CartState, "items">): number {
  return state.items.reduce((total, item) => total + item.quantity, 0);
}

/** What every line adds up to, before any fee. */
export function cartSubtotal(items: Pick<CartLine, "unitPrice" | "quantity">[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}
