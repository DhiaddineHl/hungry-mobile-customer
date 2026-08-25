import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  DEFAULT_PAYMENT_METHOD,
  type PaymentMethodId,
} from "@/constants/payment-methods";

/**
 * The customer's chosen payment method.
 *
 * This is a LOCAL PREFERENCE and nothing more. Grepping the entire backend
 * (case-insensitively) for `payment` returns zero files: there is no payment
 * method, no payment status, no transaction and no provider integration
 * anywhere (plan §3.3, `docs/plans/checkout-order-creation-plan.md`).
 *
 * Nothing here charges anything. The only channel that carries the selection
 * off the device is the order's free-text `comment` — see `buildOrderComment`
 * in `services/api/order-view-model.ts` — and the UI must never imply that
 * choosing "Bank" moved any money.
 *
 * The id union and the default live in `constants/payment-methods.ts` so that
 * pure modules can name a method without importing AsyncStorage; they are
 * re-exported here because this store is where callers expect to find them.
 */
export type { PaymentMethodId };
export { DEFAULT_PAYMENT_METHOD };

interface PaymentMethodState {
  method: PaymentMethodId;
  setMethod: (method: PaymentMethodId) => void;
}

export const usePaymentMethodStore = create<PaymentMethodState>()(
  persist(
    (set) => ({
      method: DEFAULT_PAYMENT_METHOD,

      setMethod: (method) => set({ method }),
    }),
    {
      name: "hungry-payment-method",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
