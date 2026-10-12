/**
 * The payment methods the checkout offers, and their labels.
 *
 * A LOCAL PREFERENCE and nothing more. Grepping the entire backend
 * (case-insensitively) for `payment` returns zero files: there is no payment
 * method, no payment status, no transaction and no provider integration
 * anywhere (plan §3.3, `docs/plans/checkout-order-creation-plan.md`).
 *
 * This module is deliberately free of React and of any store import so that
 * `services/api/order-view-model.ts` — a pure module — can name a method in the
 * order's `comment` without dragging a component tree, reanimated or
 * AsyncStorage into a unit test. The icons live with the modal, which is the
 * only place that renders them.
 */

export type PaymentMethodId = "cash" | "points" | "bank" | "sim";

/** In the order `design/Order Details - Payment Method.png` lists them. */
export const PAYMENT_METHOD_IDS: PaymentMethodId[] = [
  "cash",
  "points",
  "bank",
  "sim",
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodId, string> = {
  cash: "Cash",
  points: "Hungry Points",
  bank: "Bank",
  sim: "SIM Credits",
};

/** Cash on delivery is the only method that is actually settled today. */
export const DEFAULT_PAYMENT_METHOD: PaymentMethodId = "cash";

/** The label for one method, for use outside the sheet (e.g. the order row). */
export function paymentMethodLabel(id: PaymentMethodId): string {
  return PAYMENT_METHOD_LABELS[id] ?? PAYMENT_METHOD_LABELS[DEFAULT_PAYMENT_METHOD];
}

/**
 * Stated in plain words because nothing behind these options moves money.
 * Do not soften this into "coming soon" — the customer is about to place a
 * real order that a driver will really deliver.
 */
export const PAYMENT_DISCLOSURE =
  "Only Cash is settled on delivery. The other methods aren't processed yet, " +
  "so choosing one doesn't pay for your order.";
