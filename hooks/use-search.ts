import { searchKeys } from '@/services/api/query-keys';
import {
  nearbyRestaurants,
  popularRestaurants,
  searchAll,
  searchProducts,
  searchRestaurants,
  type NearbyRestaurantsParams,
  type SearchProductsParams,
  type SearchRestaurantsParams,
} from '@/services/api/search-service';
import { useQuery } from '@tanstack/react-query';

/**
 * Search-index queries — the read side of `services/api/search-service.ts`. Same
 * `queryOptions`-exported-alongside-the-hook shape as `hooks/use-restaurants.ts`, for the same
 * reason: an imperative prefetch (e.g. on the home screen, before the user opens search) and the
 * hook resolve to the same cache entry.
 *
 * A shorter staleTime than `restaurantsQueryOptions`' two minutes: a search result's whole point
 * is showing live pricing/promotion state, and the index itself refreshes in real time on the
 * backend (see the plan) — caching it as long as a restaurant's own profile would show a stale
 * discount.
 */
const SEARCH_STALE_TIME = 30 * 1000;

export function searchAllQueryOptions(q: string, page = 0) {
  return {
    queryKey: searchKeys.all_(q, page),
    queryFn: () => searchAll(q, page),
    enabled: q.trim().length > 0,
    staleTime: SEARCH_STALE_TIME,
  };
}

export function useSearchAll(q: string, page = 0) {
  return useQuery(searchAllQueryOptions(q, page));
}

export function searchRestaurantsQueryOptions(params: SearchRestaurantsParams = {}) {
  return {
    queryKey: searchKeys.restaurants(params),
    queryFn: () => searchRestaurants(params),
    staleTime: SEARCH_STALE_TIME,
  };
}

export function useSearchRestaurants(params: SearchRestaurantsParams = {}) {
  return useQuery(searchRestaurantsQueryOptions(params));
}

export function popularRestaurantsQueryOptions(customerId?: string, page = 0) {
  return {
    queryKey: searchKeys.popularRestaurants(customerId, page),
    queryFn: () => popularRestaurants(customerId, page),
    staleTime: SEARCH_STALE_TIME,
  };
}

export function usePopularRestaurants(customerId?: string, page = 0) {
  return useQuery(popularRestaurantsQueryOptions(customerId, page));
}

export function searchProductsQueryOptions(params: SearchProductsParams = {}) {
  return {
    queryKey: searchKeys.products(params),
    queryFn: () => searchProducts(params),
    staleTime: SEARCH_STALE_TIME,
  };
}

export function useSearchProducts(params: SearchProductsParams = {}) {
  return useQuery(searchProductsQueryOptions(params));
}

export function nearbyRestaurantsQueryOptions(params: NearbyRestaurantsParams) {
  return {
    queryKey: searchKeys.nearbyRestaurants(params),
    queryFn: () => nearbyRestaurants(params),
    staleTime: SEARCH_STALE_TIME,
  };
}

export function useNearbyRestaurants(params: NearbyRestaurantsParams) {
  return useQuery(nearbyRestaurantsQueryOptions(params));
}
