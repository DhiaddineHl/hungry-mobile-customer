/**
 * Checkout fees.
 *
 * PLACEHOLDERS. There is no fee, price, amount, subtotal or total field
 * anywhere on `Order` or `OrderItem`, and no pricing endpoint — grepping the
 * whole backend for `fee` in the order and delivery modules returns nothing
 * (plan §3.3, `docs/plans/checkout-order-creation-plan.md`).
 *
 * They live here, in one module, so that when a real pricing service ships
 * there is exactly ONE place to delete rather than a constant inlined in every
 * screen that shows a total (plan §4.2).
 *
 * Do NOT invent a fees endpoint for these, and do NOT derive them from
 * distance: OSRM routing does exist in the backend, but it is wired to driver
 * assignment, not to customer pricing.
 */

/** DT — placeholder, no backend concept. */
export const SERVICE_FEE = 3;

/** DT — placeholder, no backend concept. Struck through while waived. */
export const DELIVERY_FEE = 2.5;

/**
 * Whether delivery is currently free. A constant, not a promotion: there is no
 * voucher, campaign or loyalty concept in the backend either.
 */
export const DELIVERY_FEE_WAIVED = true;

/** What the customer actually pays for delivery right now. */
export const CHARGED_DELIVERY_FEE = DELIVERY_FEE_WAIVED ? 0 : DELIVERY_FEE;
