import { z } from 'zod';

/**
 * Runtime shape of the Hungry backend's cart payloads
 * (delivery.hungry.cart.application.model.*OutputData).
 *
 * Same reasoning as `schemas/product.ts` and `schemas/restaurant.ts`: nothing
 * in the backend's OpenAPI document is marked `required`, so every field is
 * nullish and the payload is parsed at the network boundary rather than
 * trusted through an interface.
 *
 * Two things are worth knowing before reading a cart:
 *
 *   - `CartItemOutputData.name` is ALWAYS null. `CartItemPopulator`'s direct
 *     populator sets only `quantity` and `product`; it never calls
 *     `CoreModelBasePopulator`, so the item-level `code`/`name` a client sends
 *     are dropped on the way in. Read `productName` instead.
 *   - There is no restaurant, no addon, no per-line note and no price field
 *     anywhere on a cart. Those live only on the device (see
 *     `services/api/cart-view-model.ts` and plan §3.4).
 */

/**
 * `Cart.status`. The backend forces `ACTIVE` on every create
 * (`CartBasePopulator`), so the other two members are only ever *read*.
 *
 * Use sites pair this with `.nullish().catch(null)`: an enum member the app
 * does not know about must degrade to "unknown status" rather than discard an
 * otherwise perfectly readable cart.
 */
export const cartStatusSchema = z.enum(['ACTIVE', 'SUBMITTED', 'ABANDONED']);

/**
 * One line of a cart as the backend returns it.
 *
 * `name` is modelled because it is on the wire, not because it is usable — it
 * is always null (see the module header). `productName` is the readable label.
 */
export const cartItemOutputSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  /** Always null on the wire — use `productName`. */
  name: z.string().nullish(),
  productId: z.string().nullish(),
  productCode: z.string().nullish(),
  productName: z.string().nullish(),
  quantity: z.number().nullish(),
});

/**
 * A cart as the backend returns it.
 *
 * `id` is the only non-nullish field: it is what `DELETE /carts/{id}` needs,
 * and a cart that cannot be addressed is not worth carrying through the app.
 *
 * `createdAt` arrives as an ISO-8601 LOCAL date-time with no offset. It is used
 * for display ordering only — never feed it straight to `new Date()` and
 * compare against a UTC instant (plan §3.7).
 */
export const cartOutputSchema = z.object({
  id: z.string(),
  /** `"hc:<customerId>:<restaurantId>"` for carts this app wrote — see `parseCartCode`. */
  code: z.string().nullish(),
  name: z.string().nullish(),
  customerId: z.string().nullish(),
  customerCode: z.string().nullish(),
  customerFullName: z.string().nullish(),
  status: cartStatusSchema.nullish().catch(null),
  comment: z.string().nullish(),
  items: z.array(cartItemOutputSchema).catch([]),
  /** ISO-8601 local date-time, no offset. */
  createdAt: z.string().nullish(),
});

export type CartStatus = z.infer<typeof cartStatusSchema>;
export type CartItemOutput = z.infer<typeof cartItemOutputSchema>;
export type CartOutput = z.infer<typeof cartOutputSchema>;

// --- Input --------------------------------------------------------------

/**
 * What the app SENDS. Hand-written interfaces rather than zod schemas: this
 * side of the wire is constructed by `toCartInput`, so there is no untrusted
 * value to validate at runtime — a schema here would only re-check the app's
 * own output.
 *
 * Note what is deliberately absent:
 *   - `status` — the backend hard-codes `ACTIVE` and ignores whatever is sent,
 *     so offering the field would only invite a caller to believe otherwise;
 *   - addons, per-line notes and prices — no columns exist for them.
 */
export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CartInput {
  /**
   * REQUIRED in practice. Nothing on the backend generates a code — no
   * `@PrePersist`, no generator — so an omitted code persists as null and the
   * cart becomes findable only by an id the app would then have to store
   * locally (plan §3.3).
   */
  code: string;
  name?: string;
  /** The backend `Customer.id` UUID — NOT the Keycloak `sub`. */
  customerId?: string;
  comment?: string;
  items: CartItemInput[];
}
