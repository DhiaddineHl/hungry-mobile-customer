import type { Page } from '@/schemas/page';
import type { ConfigurableProductOutput } from '@/schemas/product';
import {
  fetchMenu,
  fetchProductById,
  fetchProductImageUrl,
  isUuid,
  type FetchMenuParams,
} from '@/services/api/product-service';
import {
  addonAmounts,
  groupBySection,
  toAddonGroups,
  type MenuSectionData,
} from '@/services/api/product-view-model';
import { productKeys } from '@/services/api/query-keys';
import {
  menuScopeOf,
  type MenuScope,
  type RestaurantDetail,
} from '@/services/api/restaurant-view-model';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/**
 * Menu queries. Query options are colocated and exported, as in
 * `hooks/use-restaurants.ts`, so an imperative prefetch and the hook resolve
 * to the same cache entry and the same view-model mapping.
 *
 * Mapping runs in `select` rather than in the query function so TanStack Query
 * memoizes it — the DTO stays in the cache and components re-map only when the
 * underlying data actually changes, not on every render.
 */

// A menu changes far less often than a restaurant's availability: dishes and
// prices are edited occasionally, opening hours effectively per day.
const MENU_STALE_TIME = 5 * 60 * 1000;

export function menuQueryOptions(scope: MenuScope | null, params: FetchMenuParams = {}) {
  return {
    queryKey: productKeys.list(scope, params),
    queryFn: (): Promise<Page<ConfigurableProductOutput>> => fetchMenu(scope!, params),
    // No scope means no catalog link, and there is no query that could stand
    // in for one — see `menuScopeOf`. Firing a request would either 500 or
    // return some other restaurant's products.
    enabled: scope !== null,
    staleTime: MENU_STALE_TIME,
    select: (page: Page<ConfigurableProductOutput>): MenuSectionData[] =>
      groupBySection(page.content, new Date()),
  };
}

export function productQueryOptions(id: string | null | undefined) {
  return {
    queryKey: productKeys.detail(id ?? ''),
    queryFn: (): Promise<ConfigurableProductOutput | null> => fetchProductById(id!),
    // A non-UUID param can only ever come back 500 here, so it is not worth a
    // request — and a 500 would be indistinguishable from a real fault.
    enabled: !!id && isUuid(id),
    staleTime: MENU_STALE_TIME,
  };
}

/** What `useRestaurantMenu` resolves to when there is nothing to fetch. */
export interface UnavailableMenu {
  status: 'unavailable';
  reason: 'no-catalog-link';
}

/**
 * A restaurant's menu, already grouped into sections.
 *
 * Returns a discriminated `{ status: 'unavailable' }` — with no request fired
 * — when the restaurant carries no catalog link, which is every restaurant
 * today (see `menuScopeOf` and plan §2). Callers must handle that case
 * explicitly rather than reading an empty list, because "this restaurant has
 * no menu connected" and "this restaurant's menu is empty" are different
 * things to tell a customer.
 */
export function useRestaurantMenu(
  restaurant: RestaurantDetail | null | undefined,
  params: FetchMenuParams = {}
) {
  const scope = useMemo(
    () => (restaurant ? menuScopeOf(restaurant) : null),
    [restaurant]
  );

  const query = useQuery(menuQueryOptions(scope, params));

  // `restaurant` being absent is still loading, not unavailable: the caller
  // has not resolved which restaurant this is yet.
  const unavailable: UnavailableMenu | null =
    restaurant && scope === null ? { status: 'unavailable', reason: 'no-catalog-link' } : null;

  return { ...query, scope, unavailable };
}

/** One product by UUID. `data` is `null` when no such product exists. */
export function useProduct(id: string | null | undefined) {
  return useQuery(productQueryOptions(id));
}

/**
 * A product's addon groups, mapped once per data change rather than per
 * render. Kept beside `useProduct` rather than folded into its `select` so a
 * caller that only needs the name and price does not pay for the mapping.
 */
export function useAddonGroups(product: ConfigurableProductOutput | null | undefined) {
  return useMemo(() => (product ? toAddonGroups(product, new Date()) : []), [product]);
}

/**
 * A product's addon surcharges as numbers, keyed by option id — what the
 * running total is computed from. Memoized alongside {@link useAddonGroups} so
 * the two always describe the same product at the same instant.
 */
export function useAddonAmounts(product: ConfigurableProductOutput | null | undefined) {
  return useMemo(
    () => (product ? addonAmounts(product, new Date()) : new Map<string, number>()),
    [product]
  );
}

/**
 * A product's artwork, or `null` when it has none.
 *
 * Its own query rather than part of `useProduct` because it is a SEPARATE
 * request — products carry no image field — and because that keeps it easy to
 * see that only the food-detail screen calls it. A menu grid must not: one
 * request per card is an N+1 (plan §3.5).
 *
 * Artwork changes far less often than a menu does, so it outlives the menu's
 * staleness window.
 */
export function useProductImageUrl(id: string | null | undefined) {
  return useQuery({
    queryKey: productKeys.image(id ?? ''),
    queryFn: (): Promise<string | null> => fetchProductImageUrl(id!),
    enabled: !!id && isUuid(id),
    staleTime: 30 * 60 * 1000,
  });
}
