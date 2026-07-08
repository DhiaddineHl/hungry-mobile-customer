import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type FavoriteType = "restaurant" | "food";

export interface FavoriteItem {
  id: string;
  type: FavoriteType;
  name: string;
  image: any;
  /** Categories (restaurant) or short description (food). */
  subtitle?: string;
  price?: string;
  rating?: string;
  reviewCount?: string;
  /** For a food item, the restaurant it belongs to (for navigation). */
  restaurantId?: string;
}

/** Namespaced key so a restaurant and a food can share a raw id. */
function keyOf(type: FavoriteType, id: string): string {
  return `${type}:${id}`;
}

interface FavoritesState {
  items: FavoriteItem[];
  toggle: (item: FavoriteItem) => void;
  remove: (type: FavoriteType, id: string) => void;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set) => ({
      items: [],

      toggle: (item) =>
        set((state) => {
          const exists = state.items.some(
            (i) => keyOf(i.type, i.id) === keyOf(item.type, item.id),
          );
          if (exists) {
            return {
              items: state.items.filter(
                (i) => keyOf(i.type, i.id) !== keyOf(item.type, item.id),
              ),
            };
          }
          return { items: [item, ...state.items] };
        }),

      remove: (type, id) =>
        set((state) => ({
          items: state.items.filter(
            (i) => keyOf(i.type, i.id) !== keyOf(type, id),
          ),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "hungry-favorites",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/** Reactive helper: is a given item currently favorited? */
export function useIsFavorite(type: FavoriteType, id: string): boolean {
  return useFavoritesStore((s) =>
    s.items.some((i) => i.type === type && i.id === id),
  );
}
