import { restaurantKeys } from '@/services/api/query-keys';
import {
  fetchRestaurantById,
  fetchRestaurants,
  isUuid,
  type FetchRestaurantsParams,
} from '@/services/api/restaurant-service';
import {
  toRestaurantDetail,
  toRestaurantSummary,
  type RestaurantDetail,
  type RestaurantSummary,
} from '@/services/api/restaurant-view-model';
import type { Page } from '@/schemas/page';
import type { RestaurantOutput } from '@/schemas/restaurant';
import { useQuery } from '@tanstack/react-query';

/**
 * Restaurant catalog queries. Query options are colocated and exported (as in
 * `hooks/use-customer.ts`) so an imperative prefetch and the hook resolve to
 * the exact same cache entry and the same view-model mapping.
 *
 * Mapping runs in `select` rather than in the query function so TanStack Query
 * memoizes it — the DTO stays in the cache and the components re-map only when
 * the underlying data actually changes, not on every render.
 */

// Restaurants change more often than a customer profile (hours, new venues)
// but nowhere near per-second, so two minutes of freshness.
const RESTAURANT_STALE_TIME = 2 * 60 * 1000;

export function restaurantsQueryOptions(params: FetchRestaurantsParams = {}) {
  return {
    queryKey: restaurantKeys.list(params),
    queryFn: (): Promise<Page<RestaurantOutput>> => fetchRestaurants(params),
    staleTime: RESTAURANT_STALE_TIME,
    select: (page: Page<RestaurantOutput>): RestaurantSummary[] =>
      page.content.map((restaurant) => toRestaurantSummary(restaurant)),
  };
}

export function restaurantQueryOptions(id: string | null | undefined) {
  return {
    queryKey: restaurantKeys.detail(id ?? ''),
    queryFn: (): Promise<RestaurantOutput | null> => fetchRestaurantById(id!),
    // A non-UUID param can only ever come back 400, so it is not worth a request.
    enabled: !!id && isUuid(id),
    staleTime: RESTAURANT_STALE_TIME,
    select: (restaurant: RestaurantOutput | null): RestaurantDetail | null =>
      restaurant ? toRestaurantDetail(restaurant) : null,
  };
}

/** A page of restaurants, already mapped to the card view model. */
export function useRestaurants(params: FetchRestaurantsParams = {}) {
  return useQuery(restaurantsQueryOptions(params));
}

/** One restaurant by UUID. `data` is `null` when no such restaurant exists. */
export function useRestaurant(id: string | null | undefined) {
  return useQuery(restaurantQueryOptions(id));
}
