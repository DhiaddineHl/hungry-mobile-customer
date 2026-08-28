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
 * Where one restaurant group stands against its server-side copy.
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

interface CartState {
  items: CartLine[];
  /**
   * Sync bookkeeping, keyed by `restaurantId` — one entry per UI group, which
   * is one backend `Cart` row. Persisted so a restart does not re-issue a
   * delete-and-create for a cart that is already up to date.
   */
  remote: Record<string, CartSyncState>;
  addItem: (line: NewCartLine) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  removeItem: (lineId: string) => void;
  clearRestaurant: (restaurantId: string) => void;
  clear: () => void;
  setSyncState: (restaurantId: string, patch: Partial<CartSyncState>) => void;
  clearSyncState: (restaurantId: string) => void;
  /** Replaces the whole cart in one write — used by hydration. */
  replaceAll: (lines: CartLine[]) => void;
}

const EMPTY_SYNC_STATE: CartSyncState = {
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
 * The persisted shape at version 0 — `{ items }` only.
 *
 * Version 1 adds `remote`. A cart already on a customer's device must survive
 * the upgrade, so the migration ADDS the new slice rather than resetting the
 * state: dropping `items` here would silently empty a real cart on first launch
 * after an update.
 */
export function migrateCartState(persisted: unknown, version: number): CartState {
  const previous = (persisted ?? {}) as Partial<CartState>;

  if (version === 0) {
    return { ...previous, remote: {} } as CartState;
  }

  return previous as CartState;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      remote: {},

      addItem: (line) =>
        set((state) => {
          // Without a restaurant the line has no group to belong to: every
          // restaurant would collapse into one `""` group and the
          // one-cart-per-restaurant rule would break silently. Callers that
          // cannot resolve the restaurant must not add the line at all.
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

      clearRestaurant: (restaurantId) =>
        set((state) => {
          // The sync state goes with the items. Keeping a stale
          // `syncedSignature` would tell the engine the now-empty group is
          // already up to date, leaving the server copy behind forever.
          const { [restaurantId]: _removed, ...remote } = state.remote;
          return {
            items: state.items.filter((i) => i.restaurantId !== restaurantId),
            remote,
          };
        }),

      clear: () => set({ items: [], remote: {} }),

      setSyncState: (restaurantId, patch) =>
        set((state) => ({
          remote: {
            ...state.remote,
            [restaurantId]: {
              ...(state.remote[restaurantId] ?? EMPTY_SYNC_STATE),
              ...patch,
            },
          },
        })),

      clearSyncState: (restaurantId) =>
        set((state) => {
          const { [restaurantId]: _removed, ...remote } = state.remote;
          return { remote };
        }),

      replaceAll: (lines) => set({ items: lines }),
    }),
    {
      name: "hungry-cart",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
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
