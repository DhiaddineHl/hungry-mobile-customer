import { z } from 'zod';

/**
 * Runtime shape of the Hungry backend's order payloads
 * (delivery.hungry.order.application.model.*OutputData).
 *
 * Same convention as `schemas/cart.ts`: nothing in the backend's OpenAPI
 * document is marked `required`, so every field is nullish and the payload is
 * parsed at the network boundary rather than trusted through an interface.
 *
 * Orders are created by the server (`POST /checkout`), so this file only
 * describes what the app READS. Two things about the wire shape are worth
 * knowing:
 *
 *   - `OrderedProductOutputData.id` is the PRODUCT's id, not the id of the
 *     ordered-product row;
 *   - `OrderedProductAttributOutputData` returns `{id, code, name, price}` and
 *     no `attributeId`; its `id` is the attribute's.
 */

/**
 * `Order.status`. A new order is always `CREATED`; the other members are moved
 * by the restaurant, the delivery agent and the back-office, and only ever
 * *read* here.
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
  /** What this option adds to the unit price. */
  price: z.number().nullish(),
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
  /** The product's own price, before options. */
  unitPrice: z.number().nullish(),
  attributes: z.array(orderedProductAttributeOutputSchema).catch([]),
});

/**
 * One line of an order as the backend returns it.
 *
 * The ordered dish is nested under `product`.
 */
export const orderItemOutputSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  quantity: z.number().nullish(),
  product: orderedProductOutputSchema.nullish(),
  /** Per unit, options included; zero for a free gift. */
  unitPrice: z.number().nullish(),
  /** `unitPrice` times `quantity`. */
  total: z.number().nullish(),
  /** A free gift from a promotion. Absent on orders placed before gifts existed. */
  gift: z.boolean().optional().catch(false),
});

/** One discount or fee on an order, as it was granted/charged at checkout. */
export const orderAdjustmentOutputSchema = z.object({
  /** `PRODUCT_DISCOUNT`, `CART_DISCOUNT`, `DELIVERY_FEE`, `SERVICE_FEE` or `ADDITIONAL_FEE`. */
  type: z.string(),
  code: z.string().nullish(),
  label: z.string().nullish(),
  /** Always positive; the type says whether it is taken off or added. */
  amount: z.number(),
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
  /** The dropoff's readable line — the order's own, not the customer's default. */
  dropoffAddress: z.string().nullish(),
  status: orderStatusSchema.nullish().catch(null),
  comment: z.string().nullish(),
  items: z.array(orderItemOutputSchema).catch([]),
  /**
   * The money, computed and snapshotted by the server: items, minus discounts,
   * plus delivery, service and additional fees. The app displays these and never
   * recomputes them. Nullish because an order placed before the server priced
   * fees carries none, and `total` then equals `subtotal`.
   */
  subtotal: z.number().nullish(),
  discountTotal: z.number().nullish(),
  deliveryFee: z.number().nullish(),
  serviceFee: z.number().nullish(),
  additionalFees: z.number().nullish(),
  total: z.number().nullish(),
  currency: z.string().nullish(),
  /** Every discount and fee line, to itemise `total`. */
  adjustments: z.array(orderAdjustmentOutputSchema).optional().catch([]),
  /** ISO-8601 local date-time, no offset. */
  createdAt: z.string().nullish(),
});

export type OrderAdjustmentOutput = z.infer<typeof orderAdjustmentOutputSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderedProductAttributeOutput = z.infer<
  typeof orderedProductAttributeOutputSchema
>;
export type OrderedProductOutput = z.infer<typeof orderedProductOutputSchema>;
export type OrderItemOutput = z.infer<typeof orderItemOutputSchema>;
export type OrderOutput = z.infer<typeof orderOutputSchema>;
