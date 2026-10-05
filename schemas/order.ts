import { z } from 'zod';
import { moneySchema } from './cart';

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
 * `Order.status` — mirrors the backend's `OrderStatus` enum. The backend forces
 * `CREATED` on every create (`OrderBasePopulator` ignores whatever the client
 * sends), so the other members are only ever *read*.
 *
 * `FINISHED` does NOT mean delivered: the order workflow closes the order the
 * moment the driver confirms PICKUP (`DeliveryPickedUpDelegate` →
 * `OrderFinishedDelegate`). Whether the food actually arrived is the
 * delivery's status — `orderStage` in `order-list-view-model.ts` combines the
 * two. `REJECTED` is the restaurant declining a `CREATED` order.
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
  'FINISHED',
  'REJECTED',
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
  /** Per unit, options included; zero for a free gift. */
  unitPrice: moneySchema,
  total: moneySchema,
  gift: z.boolean().nullish(),
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
   * The money, as the backend priced it at checkout (fee rules, promotions).
   * `deliveryFee`/`serviceFee`/`additionalFees` are null on an order that has
   * no charge of that kind — an order placed before checkout moved to the
   * backend has none at all. `total` = subtotal − discounts + every fee.
   */
  subtotal: moneySchema,
  discountTotal: moneySchema,
  deliveryFee: moneySchema,
  serviceFee: moneySchema,
  additionalFees: moneySchema,
  /** Every discount and fee line the order was placed with; empty on a legacy order. */
  adjustments: z
    .array(
      z.object({
        type: z.string().nullish(),
        code: z.string().nullish(),
        label: z.string().nullish(),
        amount: moneySchema,
      })
    )
    .nullish()
    .catch([]),
  total: moneySchema,
  currency: z.string().nullish(),
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
 * A one-off delivery point for ONE order — `Order.deliveryAddress` on the
 * backend, an embedded `Address` whose other fields are left unset.
 *
 * Sent only when the customer picked somewhere other than a saved address at
 * checkout. The backend stores it on the order alone: it is never added to the
 * customer's saved addresses, which is the whole point of the field.
 */
export interface OrderDeliveryAddressInput {
  formattedAddress: string;
  coordinates: { latitude: number; longitude: number };
}
