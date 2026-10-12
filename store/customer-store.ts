import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface CustomerAccountState {
  /**
   * Keycloak account id (`sub`) captured at registration. Bridges the
   * pre-login onboarding gap: after sign-up the user saves an address before
   * ever logging in, so there is no token to read the sub from yet. Once
   * authenticated, screens should prefer `user.sub` from the auth context.
   */
  keycloakUserId: string | null;
  /** Backend Customer entity id returned by registration. */
  customerId: string | null;
  setAccount: (account: { keycloakUserId: string; customerId: string }) => void;
  clear: () => void;
}

export const useCustomerStore = create<CustomerAccountState>()(
  persist(
    (set) => ({
      keycloakUserId: null,
      customerId: null,

      setAccount: ({ keycloakUserId, customerId }) =>
        set({ keycloakUserId, customerId }),

      clear: () => set({ keycloakUserId: null, customerId: null }),
    }),
    {
      name: "hungry-customer-account",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
