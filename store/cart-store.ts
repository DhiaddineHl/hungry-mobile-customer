import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
  image: any;
  /** Per-unit price including selected addons. */
  unitPrice: number;
  basePrice: number;
  quantity: number;
  addons: CartAddon[];
  note?: string;
  restaurantId: string;
  restaurantName: string;
  restaurantLogo?: any;
}

export type NewCartLine = Omit<CartLine, "lineId">;

interface CartState {
  items: CartLine[];
  addItem: (line: NewCartLine) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  increment: (lineId: string) => void;
  decrement: (lineId: string) => void;
  removeItem: (lineId: string) => void;
  clearRestaurant: (restaurantId: string) => void;
  clear: () => void;
}

/** Signature that lets identical configurations merge into one line. */
function lineSignature(line: NewCartLine): string {
  const addonKey = line.addons
    .map((a) => a.id)
    .sort()
    .join(",");
  return `${line.restaurantId}|${line.foodId}|${addonKey}|${line.note ?? ""}`;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (line) =>
        set((state) => {
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
        set((state) => ({
          items: state.items.filter((i) => i.restaurantId !== restaurantId),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "hungry-cart",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// --- Derived selectors -----------------------------------------------------

export interface RestaurantCartGroup {
  restaurantId: string;
  restaurantName: string;
  restaurantLogo?: any;
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
