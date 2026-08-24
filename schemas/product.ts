import { z } from 'zod';

/**
 * Runtime shape of the Hungry backend's product payloads
 * (delivery.hungry.product.application.model.*OutputData).
 *
 * Same reasoning as `schemas/restaurant.ts`: nothing in the backend's OpenAPI
 * document is marked `required`, so every field is nullish and the payload is
 * parsed at the network boundary rather than trusted through an interface.
 *
 * Collections use `.catch([])` so a null or absent `prices` resolves to an
 * empty array and no caller has to optional-chain before iterating. `prices`
 * in particular is a LIST, not a scalar — see `selectPrice` in
 * `services/api/product-view-model.ts` for which entry actually applies.
 */

/**
 * How `symbol` sits against the amount: `PREFIX` → "DT 9.68", `SUFFIX` →
 * "9.68 DT". Modelled as an enum rather than a string because the formatter
 * branches on it; an unrecognised value is nullish and falls back to SUFFIX.
 */
export const displayFormatSchema = z.enum(['PREFIX', 'SUFFIX']);

export const currencySchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  isoCode: z.string().nullish(),
  symbol: z.string().nullish(),
  decimalPlaces: z.number().nullish(),
  displayFormat: displayFormatSchema.nullish(),
  active: z.boolean().nullish(),
});

/**
 * The window a price is valid in. **Either bound may be null**, meaning
 * open-ended in that direction — a promo with an `effectiveTo` but no
 * `effectiveFrom` has always applied and stops on the given date.
 */
export const timeRestrictionSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  /** ISO date-time. */
  effectiveFrom: z.string().nullish(),
  /** ISO date-time. */
  effectiveTo: z.string().nullish(),
});

/** Free-form on the wire (BASE, PROMOTIONAL, …) — the client never branches on it. */
export const priceCategorySchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
});

export const priceSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  amount: z.number().nullish(),
  currency: currencySchema.nullish(),
  category: priceCategorySchema.nullish(),
  restriction: timeRestrictionSchema.nullish(),
});

/** One selectable addon, e.g. "Egg". Its own `prices` list is the surcharge. */
export const attributeSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  prices: z.array(priceSchema).catch([]),
});

/**
 * A set of addons offered together, e.g. "Add some sauce".
 *
 * `required` is the ONLY selection rule the backend carries: there is no field
 * saying whether the group is single- or multi-select, and none capping the
 * number of choices — see `UNBACKED_ADDON_FIELDS`.
 */
export const attributeGroupSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  required: z.boolean().nullish(),
  attributes: z.array(attributeSchema).catch([]),
});

export const productConfigurationSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  attributes: z.array(attributeGroupSchema).catch([]),
});

/**
 * A menu section. `active` and `visible` are both honoured when grouping —
 * either being explicitly `false` hides the section (see `groupBySection`).
 */
export const categorySchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  keywords: z.array(z.string()).catch([]),
  active: z.boolean().nullish(),
  visible: z.boolean().nullish(),
});

/** delivery.hungry.product.application.model.ClassificationOutputData */
export const classificationSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
});

/**
 * The base projection returned by `/products/all`.
 *
 * Note what is NOT here: `configuration` (addons live only on the
 * configurable-products endpoint — `Product` uses SINGLE_TABLE inheritance and
 * the base endpoint silently omits it) and any image field at all. Product
 * artwork comes from `GET /files/products/{id}`, one request per product.
 */
export const productOutputSchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  catalog: z.string().nullish(),
  catalogVersion: z.string().nullish(),
  subcategories: z.array(categorySchema).catch([]),
  subclassifications: z.array(classificationSchema).catch([]),
  keywords: z.array(z.string()).catch([]),
  prices: z.array(priceSchema).catch([]),
});

/** `/configurable-products/all` — the base projection plus its addon groups. */
export const configurableProductOutputSchema = productOutputSchema.extend({
  configuration: productConfigurationSchema.nullish(),
});

/** One entry of `GET /files/products/{id}`; `url` is a relative `/files/...` path. */
export const fileMetadataSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  url: z.string().nullish(),
  contentType: z.string().nullish(),
  size: z.number().nullish(),
});

export type DisplayFormat = z.infer<typeof displayFormatSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type TimeRestriction = z.infer<typeof timeRestrictionSchema>;
export type PriceCategory = z.infer<typeof priceCategorySchema>;
export type Price = z.infer<typeof priceSchema>;
export type Attribute = z.infer<typeof attributeSchema>;
export type AttributeGroup = z.infer<typeof attributeGroupSchema>;
export type ProductConfiguration = z.infer<typeof productConfigurationSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Classification = z.infer<typeof classificationSchema>;
export type ProductOutput = z.infer<typeof productOutputSchema>;
export type ConfigurableProductOutput = z.infer<typeof configurableProductOutputSchema>;
export type FileMetadata = z.infer<typeof fileMetadataSchema>;
