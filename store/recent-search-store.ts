import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** How many past queries the Search screen offers before typing (S1). */
const MAX_RECENT = 8;

interface RecentSearchState {
  queries: string[];
  add: (query: string) => void;
  clear: () => void;
}

/**
 * Searches the customer actually ran, newest first, so the Search screen is
 * never empty before typing. Device-local: it is a convenience, not history
 * anyone else needs.
 */
export const useRecentSearchStore = create<RecentSearchState>()(
  persist(
    (set) => ({
      queries: [],
      add: (query) =>
        set((state) => {
          const q = query.trim();
          if (!q) return state;
          const rest = state.queries.filter((existing) => existing.toLowerCase() !== q.toLowerCase());
          return { queries: [q, ...rest].slice(0, MAX_RECENT) };
        }),
      clear: () => set({ queries: [] }),
    }),
    {
      name: "hungry-recent-searches",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
