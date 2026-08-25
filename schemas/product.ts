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
 *
 * `attributes` is populated by ONE route only: `/attribute-groups`, which
 * projects each group's options inline with their prices. Everywhere else the
 * field arrives null — `/product-configurations/{id}` stops at each group's own
 * fields, and no product payload carries groups at all — so `.catch([])` is
 * what keeps those shapes parseable rather than merely convenient.
 *
 * Each option also carries a flat back-reference to its own group. It is
 * ignored here: the reference has no `attributes` of its own, so reading it
 * would add nothing the parent object does not already say.
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

/**
 * How a product names its catalog and catalog version.
 *
 * These are OBJECTS on the wire, not strings: `ProductBaseInversePopulator`
 * builds a `CatalogOutputData` / `CatalogVersionOutputData` carrying exactly
 * `id`, `code` and `name`. Declaring them as strings made the whole menu page
 * fail to parse.
 */
export const catalogRefSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
});

/** delivery.hungry.product.application.model.ClassificationOutputData */
export const classificationSchema = z.object({
  id: z.string().nullish(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
});

/**
 * The `product_type` discriminator, as `ProductBasePopulator` derives it from
 * the runtime subtype: `1` = `StandardProduct`, `2` = `ConfigurableProduct`.
 *
 * A NUMBER rather than an enum on purpose. The backend's `resolveProductType`
 * answers `null` for a `Product` that is neither, and an unrecognised value
 * has to reach the client as data instead of failing the parse — a new subtype
 * appearing server-side must not blank the whole menu. `isConfigurableType` in
 * `services/api/product-service.ts` is the only place that reads the numbers.
 */
export const productTypeSchema = z.number();

/**
 * The base projection returned by `/products/all`.
 *
 * This endpoint is POLYMORPHIC — `Product` uses SINGLE_TABLE inheritance and
 * the base query returns standard AND configurable dishes alike. Since
 * `productType` was added to `ProductOutputData` it also says WHICH subtype
 * each row is, so one request now yields a fully labelled menu (see
 * `fetchMenu`).
 *
 * What it still omits is `configuration`: addons are projected only by
 * `/configurable-products`, and even there only the configuration's own
 * id/code/name — see `configurableProductOutputSchema`.
 *
 * There is also no image field at all. Product artwork comes from
 * `GET /files/products/{id}`, one request per product.
 */
export const productOutputSchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  productType: productTypeSchema.nullish(),
  catalog: catalogRefSchema.nullish(),
  catalogVersion: catalogRefSchema.nullish(),
  subcategories: z.array(categorySchema).catch([]),
  subclassifications: z.array(classificationSchema).catch([]),
  keywords: z.array(z.string()).catch([]),
  prices: z.array(priceSchema).catch([]),
});

/**
 * `/configurable-products/all` — the base projection plus its configuration.
 *
 * **`configuration.attributes` is always empty here.**
 * `ConfigurableProductBaseInversePopulator` builds a fresh
 * `ProductConfigurationOutputData` carrying only id/code/name/description and
 * never copies the groups across. The configuration's `id` is therefore the
 * only thing this projection adds that matters — it is the handle
 * `fetchProductConfiguration` reads the actual groups and options from.
 */
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
export type ProductType = z.infer<typeof productTypeSchema>;
export type Currency = z.infer<typeof currencySchema>;
export type TimeRestriction = z.infer<typeof timeRestrictionSchema>;
export type PriceCategory = z.infer<typeof priceCategorySchema>;
export type Price = z.infer<typeof priceSchema>;
export type Attribute = z.infer<typeof attributeSchema>;
export type AttributeGroup = z.infer<typeof attributeGroupSchema>;
export type ProductConfiguration = z.infer<typeof productConfigurationSchema>;
export type CatalogRef = z.infer<typeof catalogRefSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Classification = z.infer<typeof classificationSchema>;
export type ProductOutput = z.infer<typeof productOutputSchema>;
export type ConfigurableProductOutput = z.infer<typeof configurableProductOutputSchema>;
export type FileMetadata = z.infer<typeof fileMetadataSchema>;
