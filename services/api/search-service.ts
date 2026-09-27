import type { Page } from '@/schemas/page';
import {
  combinedSearchResultSchema,
  searchProductPageSchema,
  searchRestaurantDocumentSchema,
  searchRestaurantPageSchema,
  type CombinedSearchResult,
  type SearchProductDocument,
  type SearchRestaurantDocument,
} from '@/schemas/search';
import { z } from 'zod';
import { ApiError, apiClient } from './client';

/**
 * Reads against `delivery.hungry.search.infrastructure.adapter.rest.SearchController` — the
 * backend's Solr-backed search index, not the JPA `/restaurants/all` / `/products/all` routes
 * `restaurant-service.ts` / `product-service.ts` read from.
 *
 * This is the ONE place in the app that talks to `/search/**`: a restaurant/product listing or
 * search results screen goes through here, a single-record-by-id read (an exact "does this row
 * exist" question) stays on the JPA services — the index is eventually consistent and the wrong
 * source of truth for that (see the plan this module implements).
 */

/** Turns a zod failure into an ApiError naming the offending field path — same convention as
 *  `restaurant-service.ts` / `product-service.ts`. */
function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown, what: string): z.infer<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
  throw new ApiError(
    `Unexpected ${what} from the server: ${path} — ${issue.message}. ` +
      `The app may need updating to match the backend.`
  );
}

/** The blended `q` search: both collections, grouped (not merged) by type - see
 *  `CombinedSearchResult`'s own javadoc for why they aren't ranked against each other. */
export async function searchAll(q: string, page = 0, size = 10): Promise<CombinedSearchResult> {
  const { data } = await apiClient.get('/search', { params: { q, page, size } });
  return parseOrThrow(combinedSearchResultSchema, data, 'search results');
}

export interface SearchRestaurantsParams {
  cuisine?: string;
  q?: string;
  openNow?: boolean;
  hasPromotion?: boolean;
  page?: number;
  size?: number;
}

/** A general restaurant browse/filter rail — replaces `/restaurants/all` for a listing page. */
export async function searchRestaurants(params: SearchRestaurantsParams = {}): Promise<Page<SearchRestaurantDocument>> {
  const { data } = await apiClient.get('/search/restaurants', { params });
  return parseOrThrow(searchRestaurantPageSchema, data, 'restaurant search results');
}

// A raw {numFound, documents} SolrQueryResult, not the Page envelope - popular-restaurants
// predates the paginated /search/restaurants endpoint and keeps its own, older shape.
const popularRestaurantsResultSchema = z.object({
  documents: z.array(searchRestaurantDocumentSchema).catch([]),
});

/** Enabled restaurants ranked by popularity (recent order volume), optionally personalized. */
export async function popularRestaurants(customerId?: string, page = 0, size = 10): Promise<SearchRestaurantDocument[]> {
  const { data } = await apiClient.get('/search/popular-restaurants', { params: { customerId, page, size } });
  return parseOrThrow(popularRestaurantsResultSchema, data, 'popular restaurants').documents;
}

export interface SearchProductsParams {
  /** A single restaurant's own menu - replaces the N-request-per-category fan-out `fetchMenu` does. */
  vendorId?: string;
  categoryId?: string;
  q?: string;
  sort?: 'price_asc' | 'price_desc' | 'name_asc' | 'newest';
  page?: number;
  size?: number;
}

/** A restaurant's menu (`vendorId`), or a cross-restaurant dish browse/search when it's omitted. */
export async function searchProducts(params: SearchProductsParams = {}): Promise<Page<SearchProductDocument>> {
  const { data } = await apiClient.get('/search/products', { params });
  return parseOrThrow(searchProductPageSchema, data, 'product search results');
}

export interface NearbyRestaurantsParams {
  lat: number;
  lon: number;
  radiusKm?: number;
  customerId?: string;
  page?: number;
  size?: number;
}

/** Enabled restaurants near a point, nearest first. */
export async function nearbyRestaurants(params: NearbyRestaurantsParams): Promise<Page<SearchRestaurantDocument>> {
  const { data } = await apiClient.get('/search/nearby-restaurants', { params });
  return parseOrThrow(searchRestaurantPageSchema, data, 'nearby restaurants');
}

// Re-exported so a caller only needs this module, not schemas/search.ts too.
export type { SearchProductDocument, SearchRestaurantDocument };
