import { z } from 'zod';

/**
 * Runtime shape of the Hungry backend's order payloads
 * (delivery.hungry.order.application.model.*OutputData).
 *
 * Same convention as `schemas/cart.ts`: nothing in the backend's OpenAPI
 * document is marked `required`, so every field is nullish and the payload is
 * parsed at the network boundary rather than trusted through an interface.
 *
 * Three asymmetries between what the app SENDS and what it READS will bite
 * anyone who assumes the two mirror each other (plan §3.2,
 * `docs/plans/checkout-order-creation-plan.md`):
 *
 *   - the input nests the ordered product under `orderedProduct`, the output
 *     nests it under `product`;
 *   - `OrderedProductOutputData.id` is the PRODUCT's id, not the id of the
 *     ordered-product row;
 *   - `OrderedProductAttributOutputData` has an empty class body — it returns
 *     `{id, code, name}` and no `attributeId`, and its `id` is the attribute's.
 *
 * Also worth knowing before reading an order back: `Order.items` is
 * `mappedBy = "order"` and the backend's populator never sets the
 * back-reference, so a re-read of a freshly created order can return
 * `items: []` even though the create response showed them (plan §2.2). That is
 * a backend defect, not a parse failure — `items` is `.catch([])` so the order
 * still reads.
 */

/**
 * `Order.status`. The backend forces `CREATED` on every create
 * (`OrderBasePopulator` ignores whatever the client sends), so the other four
 * members are only ever *read*.
 *
 * Use sites pair this with `.nullish().catch(null)`: a status member the app
 * does not know about must degrade to "unknown status" rather than discard an
 * otherwise perfectly readable order.
 */
export const orderStatusSchema = z.enum([
  'CREATED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'CANCELLED',
]);

/**
 * One selected attribute (addon) of an ordered product, as returned.
 *
 * `OrderedProductAttributOutputData` extends the core output data with an
 * empty body, so this is genuinely all there is: no `attributeId`, no
 * `checked`. `id` IS the attribute's id, which is why the app never needs the
 * former.
 */
export const orderedProductAttributeOutputSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
});

/**
 * The product an order line was placed for, as returned.
 *
 * `id` is the product's id (see the module header), which makes `productId`
 * redundant on the wire — both are modelled because both are sent.
 */
export const orderedProductOutputSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  productId: z.string().nullish(),
  productCode: z.string().nullish(),
  productName: z.string().nullish(),
  attributes: z.array(orderedProductAttributeOutputSchema).catch([]),
});

/**
 * One line of an order as the backend returns it.
 *
 * Note the nesting key: `product`, not the `orderedProduct` the input uses.
 */
export const orderItemOutputSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  quantity: z.number().nullish(),
  product: orderedProductOutputSchema.nullish(),
});

/**
 * An order as the backend returns it.
 *
 * `id` is the only non-nullish field: it is what `GET /orders/{id}` needs, and
 * an order that cannot be addressed is not worth carrying through the app.
 *
 * The pickup/dropoff coordinates are denormalised copies of the restaurant's
 * and the customer's default address at create time. They are boxed `Double`s
 * on the backend and dereferenced without a null guard by `OrderConsumer`, so
 * an order that exists at all has them — but they stay nullish here because
 * this schema also has to parse whatever a broken write left behind.
 *
 * `createdAt` arrives as an ISO-8601 LOCAL date-time with no offset. Display
 * ordering only — never feed it straight to `new Date()` and compare against a
 * UTC instant (plan §3.7).
 */
export const orderOutputSchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  restaurantId: z.string().nullish(),
  restaurantCode: z.string().nullish(),
  restaurantName: z.string().nullish(),
  pickupLatitude: z.number().nullish(),
  pickupLongitude: z.number().nullish(),
  customerId: z.string().nullish(),
  customerCode: z.string().nullish(),
  customerFullName: z.string().nullish(),
  dropoffLatitude: z.number().nullish(),
  dropoffLongitude: z.number().nullish(),
  status: orderStatusSchema.nullish().catch(null),
  comment: z.string().nullish(),
  items: z.array(orderItemOutputSchema).catch([]),
  /** ISO-8601 local date-time, no offset. */
  createdAt: z.string().nullish(),
});

export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderedProductAttributeOutput = z.infer<
  typeof orderedProductAttributeOutputSchema
>;
export type OrderedProductOutput = z.infer<typeof orderedProductOutputSchema>;
export type OrderItemOutput = z.infer<typeof orderItemOutputSchema>;
export type OrderOutput = z.infer<typeof orderOutputSchema>;

// --- Input --------------------------------------------------------------

/**
 * What the app SENDS. Hand-written interfaces rather than zod schemas, exactly
 * as in `schemas/cart.ts`: this side of the wire is constructed by
 * `toOrderInput`, so there is no untrusted value to validate at runtime.
 *
 * Note what is deliberately absent:
 *   - `status` — the backend hard-codes `CREATED` and ignores what is sent;
 *   - any price, fee, total or payment field — no such column exists anywhere
 *     on `Order` or `OrderItem` (plan §3.3), and offering one would invite a
 *     caller to believe the backend charges something.
 */
export interface OrderedProductAttributeInput {
  code?: string;
  name?: string;
  attributeId: string;
  /**
   * IGNORED by the backend — `OrderedProductAttributeDirectBasePopulator`
   * never copies it (plan §2.3). Sent anyway so the payload is correct the day
   * that populator is fixed; the app treats a listed attribute as selected.
   */
  checked: boolean;
}

export interface OrderedProductInput {
  code?: string;
  name?: string;
  productId: string;
  /** Always an array, never `undefined` — `[]` when the line has no addons. */
  attributes: OrderedProductAttributeInput[];
}

export interface OrderItemInput {
  code?: string;
  name?: string;
  quantity: number;
  /** The input nesting key. The OUTPUT calls this `product`. */
  orderedProduct: OrderedProductInput;
}

export interface OrderInput {
  /**
   * REQUIRED in practice, for the same reason as `CartInput.code`: nothing on
   * the backend generates a code, so an omitted one persists as null.
   */
  code: string;
  name?: string;
  restaurantId: string;
  /** The backend `Customer.id` UUID — NOT the Keycloak `sub`. */
  customerId: string;
  comment?: string;
  items: OrderItemInput[];
}
