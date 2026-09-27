import { z } from 'zod';
import { displayFormatSchema } from './product';
import { pageSchema } from './page';

/**
 * Runtime shape of the Hungry backend's search-index documents
 * (`org.jfwk.solr.application.model.VendorSolrDocument` / `ProductSolrDocument`,
 * as served by `delivery.hungry.search.infrastructure.adapter.rest.SearchController`).
 *
 * These are Solr documents, not JPA output DTOs — every field is nullish for
 * the same reason `schemas/restaurant.ts`/`schemas/product.ts` are: nothing
 * here is contractually guaranteed present, and a field only appears once
 * something has actually written it (a restaurant with no reviews yet has no
 * `ratingAverage`, a dish with no live discount has no `promotionLabel`).
 */

export const searchRestaurantDocumentSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  brandName: z.string().nullish(),
  cuisines: z.array(z.string()).catch([]),
  dishes: z.array(z.string()).catch([]),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  formattedAddress: z.string().nullish(),
  municipality: z.string().nullish(),
  country: z.string().nullish(),
  logoUrl: z.string().nullish(),
  coverImageUrl: z.string().nullish(),
  enabled: z.boolean().nullish(),
  ratingAverage: z.number().nullish(),
  ratingCount: z.number().nullish(),
  priceRangeMin: z.number().nullish(),
  priceRangeMax: z.number().nullish(),
  currencyIsoCode: z.string().nullish(),
  currencySymbol: z.string().nullish(),
  currencyDecimalPlaces: z.number().nullish(),
  currencyDisplayFormat: displayFormatSchema.nullish(),
  /** One entry per working shift, as `"<isoDayOfWeek>|<1-or-0 open>|<HH:mm>|<HH:mm>"` -
   *  see `WorkingHoursEvaluator` on the backend for the same format read server-side. */
  days: z.array(z.string()).catch([]),
  hasActivePromotion: z.boolean().nullish(),
  promotionHeadline: z.string().nullish(),
  score: z.number().nullish(),
});

export type SearchRestaurantDocument = z.infer<typeof searchRestaurantDocumentSchema>;

export const searchProductDocumentSchema = z.object({
  id: z.string(),
  vendorId: z.string().nullish(),
  vendorName: z.string().nullish(),
  name: z.string().nullish(),
  description: z.string().nullish(),
  price: z.number().nullish(),
  currencyCode: z.string().nullish(),
  currencySymbol: z.string().nullish(),
  currencyDecimalPlaces: z.number().nullish(),
  currencyDisplayFormat: displayFormatSchema.nullish(),
  /** `price` after the best currently-automatic discount; equal to `price` when none applies. */
  effectivePrice: z.number().nullish(),
  promotionLabel: z.string().nullish(),
  hasActivePromotion: z.boolean().nullish(),
  /** Set only for a coupon-gated rule - "apply this code", no price implied. */
  promotionCode: z.string().nullish(),
  tags: z.array(z.string()).catch([]),
  categoryIds: z.array(z.string()).catch([]),
  available: z.boolean().nullish(),
  vendorRating: z.number().nullish(),
  vendorMunicipality: z.string().nullish(),
  vendorEnabled: z.boolean().nullish(),
});

export type SearchProductDocument = z.infer<typeof searchProductDocumentSchema>;

/** `delivery.hungry.search.application.model.CombinedSearchResult` - grouped, not blended
 *  (see that record's own javadoc: cross-collection relevance scores aren't comparable). */
export const combinedSearchResultSchema = z.object({
  restaurants: z.object({
    numFound: z.number().nullish(),
    documents: z.array(searchRestaurantDocumentSchema).catch([]),
  }),
  products: z.object({
    numFound: z.number().nullish(),
    documents: z.array(searchProductDocumentSchema).catch([]),
  }),
});

export type CombinedSearchResult = z.infer<typeof combinedSearchResultSchema>;

export const searchRestaurantPageSchema = pageSchema(searchRestaurantDocumentSchema);
export const searchProductPageSchema = pageSchema(searchProductDocumentSchema);
