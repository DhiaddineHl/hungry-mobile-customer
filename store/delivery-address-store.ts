import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * The saved address the customer is currently ordering to. Only the address
 * `name` (its identity key, e.g. "home"/"work") is stored — the address data
 * itself lives in the customer query cache, so keeping just the name keeps the
 * selection in sync when the address is later edited. `null` means "not chosen
 * yet", and consumers fall back to the customer's default address.
 */
interface DeliveryAddressState {
  selectedName: string | null;
  select: (name: string) => void;
  clear: () => void;
}

export const useDeliveryAddressStore = create<DeliveryAddressState>()(
  persist(
    (set) => ({
      selectedName: null,
      select: (name) => set({ selectedName: name }),
      clear: () => set({ selectedName: null }),
    }),
    {
      name: "hungry-delivery-address",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
