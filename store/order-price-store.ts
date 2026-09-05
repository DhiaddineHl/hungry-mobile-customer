import type { OrderTotals } from '@/services/api/order-view-model';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * What each order cost, kept on the device that placed it.
 *
 * **This exists because the backend stores no prices at all.** `Order` and
 * `OrderItem` have no price, fee or total column (plan §3.3), so an order read
 * back from the server can say what was ordered but never what it cost. The
 * only moment those numbers exist is checkout, on this device — so that is
 * where they are captured, and this is where they are kept.
 *
 * It is a RECEIPT, not a source of truth for money: nothing is charged from it
 * and nothing is sent from it. An order placed on another device, or before
 * this shipped, simply has no entry, and the order screen falls back to
 * today's menu prices and says so.
 */

export interface OrderPriceAddon {
  name: string;
  /** Per-unit surcharge, already included in the line's `unitPrice`. */
  price: number;
}

export interface OrderPriceLine {
  /**
   * The cart line id, which is also the `code` sent on the order item — the
   * handle that matches this line to the one the server returns.
   */
  lineId: string;
  /** The product id, the fallback match when an item comes back with no code. */
  foodId: string;
  name: string;
  quantity: number;
  /** Per-unit price INCLUDING the addons chosen for this line. */
  unitPrice: number;
  basePrice: number;
  addons: OrderPriceAddon[];
}

export interface OrderPriceSnapshot extends OrderTotals {
  lines: OrderPriceLine[];
  /** When it was captured — used only to evict the oldest entries. */
  savedAt: string;
}

/**
 * How many orders keep their prices.
 *
 * A cap, because this is persisted device storage that only ever grows: a
 * customer ordering weekly for two years would otherwise carry hundreds of
 * receipts they will never scroll back to. The oldest are dropped first, which
 * matches which ones a customer stops caring about.
 */
export const MAX_SNAPSHOTS = 60;

interface OrderPriceState {
  /** Keyed by the backend order id. */
  snapshots: Record<string, OrderPriceSnapshot>;
  record: (orderId: string, snapshot: OrderPriceSnapshot) => void;
  forget: (orderId: string) => void;
  clear: () => void;
}

/** The newest {@link MAX_SNAPSHOTS} entries, oldest dropped. */
function evictOldest(
  snapshots: Record<string, OrderPriceSnapshot>
): Record<string, OrderPriceSnapshot> {
  const entries = Object.entries(snapshots);
  if (entries.length <= MAX_SNAPSHOTS) return snapshots;

  return Object.fromEntries(
    entries
      .sort(([, a], [, b]) => b.savedAt.localeCompare(a.savedAt))
      .slice(0, MAX_SNAPSHOTS)
  );
}

export const useOrderPriceStore = create<OrderPriceState>()(
  persist(
    (set) => ({
      snapshots: {},

      record: (orderId, snapshot) =>
        set((state) => ({
          snapshots: evictOldest({ ...state.snapshots, [orderId]: snapshot }),
        })),

      forget: (orderId) =>
        set((state) => {
          if (!(orderId in state.snapshots)) return state;
          const { [orderId]: _dropped, ...rest } = state.snapshots;
          return { snapshots: rest };
        }),

      clear: () => set({ snapshots: {} }),
    }),
    {
      name: 'hungry-order-prices',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * One order's captured prices, or `null` when this device did not place it.
 *
 * Subscribes to that one entry, so a screen showing an order does not re-render
 * when a different order is placed.
 */
export function useOrderPriceSnapshot(
  orderId: string | null | undefined
): OrderPriceSnapshot | null {
  return useOrderPriceStore((state) =>
    orderId ? (state.snapshots[orderId] ?? null) : null
  );
}
