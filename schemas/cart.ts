import { z } from 'zod';

/**
 * Runtime shape of the Hungry backend's cart payloads
 * (delivery.hungry.cart.application.model.CartOutputData).
 *
 * **The backend cart is the source of truth.** The app never keeps a cart of
 * its own: every change is a request (`POST /carts/active/items`, …) whose
 * response is the whole recalculated cart, and the cart screen always shows
 * the latest of those. That is why this schema carries prices, fees and totals
 * — they are computed on the server, on every read, and the app only displays
 * them. Nothing here is ever recomputed on the device.
 *
 * What a cart is made of:
 *   - `items`               the priced lines (options included), each tagged
 *                           with the restaurant that owns the dish
 *   - `applicablePromotions` what the promotion engine applied: product-based,
 *                           cart-based and customer-group-based alike
 *   - `deliveryFees`        one per restaurant, from its distance to the address
 *   - `serviceFee`          the app's fee, ONE per cart, split equally across
 *                           the orders the cart becomes
 *   - `additionalFees`      night, weather… surcharges
 *   - `orders`              exactly the orders a checkout will create, one per
 *                           restaurant, each with its own subtotal/fees/total
 *   - `blockers`            why checkout is not possible yet, if it is not
 *
 * As with every schema in this folder, nothing in the backend's OpenAPI
 * document is marked `required`, so fields are nullish (or `.catch`-ed to a
 * safe default) and the payload is parsed at the network boundary rather than
 * trusted through an interface. Money arrives as JSON numbers.
 */

/** `Cart.status`. `SUBMITTED` is what a cart becomes once checkout placed its orders. */
export const cartStatusSchema = z.enum(['ACTIVE', 'SUBMITTED', 'ABANDONED']);

/** A chosen option and what it adds to the unit price. */
export const cartItemOptionSchema = z.object({
  attributeId: z.string(),
  name: z.string().nullish(),
  price: z.number().nullish(),
});

/**
 * One priced line. `unitPrice` already includes the options; a free gift from
 * a promotion has `giftItem: true` and a `lineTotal` of zero.
 */
export const cartItemOutputSchema = z.object({
  id: z.string(),
  productId: z.string().nullish(),
  productCode: z.string().nullish(),
  productName: z.string().nullish(),
  quantity: z.number(),
  restaurantId: z.string().nullish(),
  restaurantName: z.string().nullish(),
  unitPrice: z.number().catch(0),
  lineTotal: z.number().catch(0),
  note: z.string().nullish(),
  giftItem: z.boolean().catch(false),
  options: z.array(cartItemOptionSchema).catch([]),
});

/** A promotion the engine applied. `restaurantId` is null for a cart-level one. */
export const cartPromotionSchema = z.object({
  promotionRuleId: z.string().nullish(),
  promotionRuleCode: z.string().nullish(),
  effectType: z.string().nullish(),
  amount: z.number().nullish(),
  currency: z.string().nullish(),
  message: z.string().nullish(),
  restaurantId: z.string().nullish(),
});

export const cartDeliveryFeeSchema = z.object({
  restaurantId: z.string(),
  restaurantName: z.string().nullish(),
  distanceKm: z.number().nullish(),
  amount: z.number(),
});

export const cartServiceFeeSchema = z.object({
  amount: z.number(),
  /** How many orders the fee is split across. */
  orderCount: z.number().catch(1),
});

export const cartAdditionalFeeSchema = z.object({
  code: z.string(),
  label: z.string().nullish(),
  scope: z.string().nullish(),
  amount: z.number(),
});

/** One order a checkout will create. */
export const cartOrderPreviewSchema = z.object({
  restaurantId: z.string(),
  restaurantName: z.string().nullish(),
  itemIds: z.array(z.string()).catch([]),
  subtotal: z.number().catch(0),
  discount: z.number().catch(0),
  deliveryFee: z.number().catch(0),
  serviceFeeShare: z.number().catch(0),
  additionalFees: z.array(cartAdditionalFeeSchema).catch([]),
  total: z.number().catch(0),
});

/**
 * Why checkout is not possible yet. Kept as plain strings on the wire so a
 * blocker added by a newer backend does not break an older app; the members the
 * app knows are listed in {@link CartBlocker}.
 */
export const CART_BLOCKERS = [
  'EMPTY_CART',
  'NO_DELIVERY_ADDRESS',
  'NO_ADDRESS_COORDINATES',
  'RESTAURANT_LOCATION_MISSING',
] as const;
export type CartBlocker = (typeof CART_BLOCKERS)[number];

export function isKnownBlocker(value: string): value is CartBlocker {
  return (CART_BLOCKERS as readonly string[]).includes(value);
}

/** The cart's own delivery address. Only what the app reads back; the rest is passed through. */
export const cartDeliveryAddressSchema = z.looseObject({
  formattedAddress: z.string().nullish(),
  coordinates: z
    .object({
      latitude: z.number().nullish(),
      longitude: z.number().nullish(),
    })
    .nullish(),
});

/**
 * The customer's ACTIVE cart, recalculated.
 *
 * `id` is the only non-nullish text field. The totals default to zero rather
 * than failing the parse: a cart that cannot be priced is still a cart the
 * customer must be able to empty.
 */
export const cartOutputSchema = z.object({
  id: z.string(),
  status: cartStatusSchema.nullish().catch(null),
  currency: z.string().nullish(),
  comment: z.string().nullish(),
  couponCode: z.string().nullish(),
  paymentMethod: z.string().nullish(),
  /** Null = deliver to the customer's default address. */
  deliveryAddress: cartDeliveryAddressSchema.nullish(),
  items: z.array(cartItemOutputSchema).catch([]),
  applicablePromotions: z.array(cartPromotionSchema).catch([]),
  deliveryFees: z.array(cartDeliveryFeeSchema).catch([]),
  serviceFee: cartServiceFeeSchema.nullish(),
  additionalFees: z.array(cartAdditionalFeeSchema).catch([]),
  orders: z.array(cartOrderPreviewSchema).catch([]),
  subtotal: z.number().catch(0),
  discountTotal: z.number().catch(0),
  feesTotal: z.number().catch(0),
  total: z.number().catch(0),
  blockers: z.array(z.string()).catch([]),
  /** ISO-8601 local date-time, no offset. Display ordering only. */
  createdAt: z.string().nullish(),
});

export type CartStatus = z.infer<typeof cartStatusSchema>;
export type CartItemOption = z.infer<typeof cartItemOptionSchema>;
export type CartItemOutput = z.infer<typeof cartItemOutputSchema>;
export type CartPromotion = z.infer<typeof cartPromotionSchema>;
export type CartDeliveryFee = z.infer<typeof cartDeliveryFeeSchema>;
export type CartServiceFee = z.infer<typeof cartServiceFeeSchema>;
export type CartAdditionalFee = z.infer<typeof cartAdditionalFeeSchema>;
export type CartOrderPreview = z.infer<typeof cartOrderPreviewSchema>;
export type CartOutput = z.infer<typeof cartOutputSchema>;

// --- Input --------------------------------------------------------------

/**
 * What the app SENDS. Hand-written interfaces rather than zod schemas: this
 * side of the wire is constructed by the app itself, so there is no untrusted
 * value to validate at runtime.
 *
 * Note what is deliberately absent: a customer id, a cart id and every price.
 * The cart is "mine" by the access token, and the server prices everything.
 */
export interface AddCartItemInput {
  productId: string;
  quantity: number;
  /** The customer's note for this line. Part of what makes two lines of a dish distinct. */
  note?: string;
  /** The chosen options. Always an array — `[]` for a dish with none. */
  attributes: { attributeId: string; checked: boolean }[];
}

/** A one-off delivery point for the whole cart, as the backend's embedded `Address` reads it. */
export interface CartDeliveryAddressInput {
  formattedAddress: string;
  coordinates: { latitude: number; longitude: number };
}

/**
 * Everything the customer decides before placing the order. **Replace
 * semantics**: all four are written as sent, so send them all every time.
 * `deliveryAddress: null` means "deliver to my default address" and clears a
 * point picked earlier.
 */
export interface CheckoutOptionsInput {
  deliveryAddress: CartDeliveryAddressInput | null;
  paymentMethod: string | null;
  comment: string | null;
  couponCode: string | null;
}
