import { z } from 'zod';

/**
 * Runtime shape of the Hungry backend's cart payloads
 * (delivery.hungry.cart.application.model.CartOutputData and friends).
 *
 * Same reasoning as `schemas/product.ts` and `schemas/restaurant.ts`: nothing
 * in the backend's OpenAPI document is marked `required`, so every field is
 * nullish and the payload is parsed at the network boundary rather than
 * trusted through an interface.
 *
 * The customer's cart lives at `/carts/active` and is PRICED ON EVERY READ by
 * `CartQuotePopulator`: line prices, promotions, the delivery fee of each
 * restaurant's order, the app service fee and any additional (night, weather…)
 * fee all come from the backend's fee rules. Nothing below is stored — it is
 * what a checkout would charge right now.
 */

/**
 * A `BigDecimal` on the wire. Jackson writes it as a JSON number, but a string
 * is accepted too so a serializer setting cannot break every price in the app.
 * An unparseable value degrades to `null` ("unknown"), never to zero.
 */
export const moneySchema = z
  .union([z.number(), z.string()])
  .transform((value) => {
    const amount = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(amount) ? amount : null;
  })
  .nullish()
  .catch(null);

/**
 * `Cart.status`. Use sites pair this with `.nullish().catch(null)`: an enum
 * member the app does not know about must degrade to "unknown status" rather
 * than discard an otherwise perfectly readable cart.
 */
export const cartStatusSchema = z.enum(['ACTIVE', 'SUBMITTED', 'ABANDONED']);

/** One chosen option of a cart line, and what it adds to the unit price. */
export const cartItemOptionSchema = z.object({
  attributeId: z.string().nullish(),
  name: z.string().nullish(),
  price: moneySchema,
});

/**
 * One priced line of a cart. `unitPrice` includes the chosen options; a free
 * gift (added by a promotion, not by the customer) has a `lineTotal` of zero.
 */
export const cartItemOutputSchema = z.object({
  id: z.string().nullish(),
  productId: z.string().nullish(),
  productCode: z.string().nullish(),
  productName: z.string().nullish(),
  quantity: z.number().nullish(),
  restaurantId: z.string().nullish(),
  restaurantName: z.string().nullish(),
  unitPrice: moneySchema,
  lineTotal: moneySchema,
  note: z.string().nullish(),
  giftItem: z.boolean().nullish(),
  options: z.array(cartItemOptionSchema).nullish().catch([]),
});

/** The delivery fee of one restaurant's order. */
export const cartDeliveryFeeSchema = z.object({
  restaurantId: z.string().nullish(),
  restaurantName: z.string().nullish(),
  distanceKm: z.number().nullish(),
  amount: moneySchema,
});

/** The app's fee for the whole cart, and how many orders it is split across. */
export const cartServiceFeeSchema = z.object({
  amount: moneySchema,
  orderCount: z.number().nullish(),
});

/** A situational fee (night, weather…) — `label` is the fee rule's name. */
export const cartAdditionalFeeSchema = z.object({
  code: z.string().nullish(),
  label: z.string().nullish(),
  scope: z.string().nullish(),
  amount: moneySchema,
});

/** One order a checkout will create — one per restaurant in the cart. */
export const cartOrderPreviewSchema = z.object({
  restaurantId: z.string().nullish(),
  restaurantName: z.string().nullish(),
  itemIds: z.array(z.string()).nullish().catch([]),
  subtotal: moneySchema,
  discount: moneySchema,
  deliveryFee: moneySchema,
  serviceFeeShare: moneySchema,
  additionalFees: z.array(cartAdditionalFeeSchema).nullish().catch([]),
  total: moneySchema,
});

/** The backend `Address` embeddable, as far as the cart screens read it. */
export const cartAddressSchema = z.looseObject({
  formattedAddress: z.string().nullish(),
  coordinates: z
    .object({
      latitude: z.number().nullish(),
      longitude: z.number().nullish(),
    })
    .nullish(),
});

/**
 * A cart as `/carts/active` (and every mutation under it) returns it.
 *
 * `blockers` are the backend's `CartBlocker` names — why `POST /checkout`
 * would answer 409 right now. Kept as plain strings so a new blocker the app
 * does not know yet still blocks rather than failing the parse.
 */
export const cartOutputSchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  customerId: z.string().nullish(),
  status: cartStatusSchema.nullish().catch(null),
  comment: z.string().nullish(),
  couponCode: z.string().nullish(),
  paymentMethod: z.string().nullish(),
  /** Null = the customer's default address. */
  deliveryAddress: cartAddressSchema.nullish().catch(null),
  items: z.array(cartItemOutputSchema).nullish().catch([]),
  /** ISO-8601 local date-time, no offset. */
  createdAt: z.string().nullish(),

  currency: z.string().nullish(),
  subtotal: moneySchema,
  discountTotal: moneySchema,
  feesTotal: moneySchema,
  total: moneySchema,
  deliveryFees: z.array(cartDeliveryFeeSchema).nullish().catch([]),
  serviceFee: cartServiceFeeSchema.nullish().catch(null),
  additionalFees: z.array(cartAdditionalFeeSchema).nullish().catch([]),
  orders: z.array(cartOrderPreviewSchema).nullish().catch([]),
  blockers: z.array(z.string()).nullish().catch([]),
});

export type CartStatus = z.infer<typeof cartStatusSchema>;
export type CartItemOutput = z.infer<typeof cartItemOutputSchema>;
export type CartOrderPreview = z.infer<typeof cartOrderPreviewSchema>;
export type CartOutput = z.infer<typeof cartOutputSchema>;

// --- Input --------------------------------------------------------------

/**
 * What the app SENDS. Hand-written interfaces rather than zod schemas: this
 * side of the wire is constructed by the app, so there is no untrusted value
 * to validate at runtime.
 */

/** `POST /carts/active/items` — no restaurant: the product's owner is the restaurant. */
export interface AddCartItemInput {
  productId: string;
  quantity: number;
  note?: string;
  /** The chosen options. The backend ignores entries with `checked: false`. */
  attributes: { attributeId: string; checked: boolean }[];
}

/**
 * `PUT /carts/active/checkout-options`. **Replace semantics**: every field is
 * written as sent, so a null `deliveryAddress` means "my default address".
 */
export interface CartCheckoutOptionsInput {
  deliveryAddress: CartDeliveryAddressInput | null;
  paymentMethod: string | null;
  comment: string | null;
  couponCode: string | null;
}

/**
 * A backend `Address`. A saved address is sent whole (street, floor…); a
 * point picked on the map needs only a readable line and the coordinates.
 */
export interface CartDeliveryAddressInput {
  formattedAddress?: string | null;
  coordinates?: { latitude?: number | null; longitude?: number | null } | null;
}
