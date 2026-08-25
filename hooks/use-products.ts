import { useRestaurantImageSourceFromPath } from '@/hooks/use-restaurant-image';
import type { Page } from '@/schemas/page';
import type { AttributeGroup } from '@/schemas/product';
import { fetchMenuScope } from '@/services/api/catalog-service';
import { fetchProductConfiguration } from '@/services/api/configuration-service';
import {
  fetchMenu,
  fetchProductById,
  fetchProductImageUrl,
  isUuid,
  type FetchMenuParams,
  type MenuProductOutput,
} from '@/services/api/product-service';
import {
  addonAmounts,
  groupBySection,
  toAddonGroups,
  type MenuSectionData,
} from '@/services/api/product-view-model';
import { catalogKeys, productKeys } from '@/services/api/query-keys';
import {
  menuScopeOf,
  type MenuScope,
  type RestaurantDetail,
} from '@/services/api/restaurant-view-model';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ImageSource } from 'expo-image';
import { useCallback, useMemo } from 'react';

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

// Which catalog a restaurant's menu lives in is set once, when the back-office
// creates the menu, and never edited afterwards. It outlives the menu's own
// staleness window by a wide margin for the same reason artwork does.
const MENU_SCOPE_STALE_TIME = 30 * 60 * 1000;

export function menuQueryOptions(scope: MenuScope | null, params: FetchMenuParams = {}) {
  return {
    queryKey: productKeys.list(scope, params),
    queryFn: (): Promise<Page<MenuProductOutput>> => fetchMenu(scope!, params),
    // No scope means no catalog, and there is no query that could stand in for
    // one — see `menuScopeOf` and `fetchMenuScope`. Firing a request would
    // either 500 or return some other restaurant's products.
    enabled: scope !== null,
    staleTime: MENU_STALE_TIME,
    select: (page: Page<MenuProductOutput>): MenuSectionData[] =>
      groupBySection(page.content, new Date()),
  };
}

/**
 * Where a restaurant's menu lives, resolved from the deterministic catalog
 * code the back-office files it under. See `services/api/catalog-service.ts`.
 *
 * Its own query rather than part of the menu query so the answer is cached per
 * restaurant and shared by every menu query against it — a section filter or a
 * search term re-fetches the menu, never the catalog it lives in.
 */
export function menuScopeQueryOptions(restaurantId: string | null | undefined) {
  return {
    queryKey: catalogKeys.scope(restaurantId ?? ''),
    queryFn: (): Promise<MenuScope | null> => fetchMenuScope(restaurantId!),
    enabled: !!restaurantId,
    staleTime: MENU_SCOPE_STALE_TIME,
  };
}

export function productQueryOptions(id: string | null | undefined) {
  return {
    queryKey: productKeys.detail(id ?? ''),
    queryFn: (): Promise<MenuProductOutput | null> => fetchProductById(id!),
    // A non-UUID param can only ever come back 500 here, so it is not worth a
    // request — and a 500 would be indistinguishable from a real fault.
    enabled: !!id && isUuid(id),
    staleTime: MENU_STALE_TIME,
  };
}

/** What `useRestaurantMenu` resolves to when there is nothing to fetch. */
export interface UnavailableMenu {
  status: 'unavailable';
  reason: 'no-catalog';
}

/**
 * A restaurant's menu, already grouped into sections.
 *
 * The catalog is found in one of two ways. If the restaurant payload carries a
 * catalog link, that wins and costs nothing (`menuScopeOf`). It does not carry
 * one today, so the fallback is what actually runs: resolve the catalog from
 * the deterministic code the back-office files it under (`fetchMenuScope`).
 *
 * Returns a discriminated `{ status: 'unavailable' }` when that resolution
 * comes back empty — a restaurant whose menu was never created. Callers must
 * handle it explicitly rather than reading an empty list, because "this
 * restaurant has no menu connected" and "this restaurant's menu is empty" are
 * different things to tell a customer.
 *
 * `isPending` deliberately covers the catalog lookup as well as the menu
 * fetch, and `unavailable` stays null until that lookup has actually settled.
 * Otherwise every restaurant would flash "no menu" for the duration of one
 * round-trip, since callers check `unavailable` before `isPending` — it is the
 * more specific state.
 */
export function useRestaurantMenu(
  restaurant: RestaurantDetail | null | undefined,
  params: FetchMenuParams = {}
) {
  const declaredScope = useMemo(
    () => (restaurant ? menuScopeOf(restaurant) : null),
    [restaurant]
  );

  // Skipped entirely when the payload already answers the question, and while
  // the restaurant itself is still loading.
  const scopeQuery = useQuery(
    menuScopeQueryOptions(restaurant && !declaredScope ? restaurant.id : null)
  );

  const scope = declaredScope ?? scopeQuery.data ?? null;

  const query = useQuery(menuQueryOptions(scope, params));

  // `isLoading` rather than `isPending`: a disabled query stays pending
  // forever, which would pin the menu to its skeleton.
  const resolvingScope = scopeQuery.isLoading;

  // `restaurant` being absent is still loading, not unavailable: the caller
  // has not resolved which restaurant this is yet.
  const unavailable: UnavailableMenu | null =
    restaurant && scope === null && !resolvingScope && !scopeQuery.isError
      ? { status: 'unavailable', reason: 'no-catalog' }
      : null;

  const refetch = useCallback(() => {
    // The catalog lookup is refetched first: when IT is what failed, the menu
    // query is still disabled and retrying it alone would do nothing.
    void scopeQuery.refetch();
    return query.refetch();
  }, [scopeQuery, query]);

  return {
    ...query,
    isPending: resolvingScope || (scope !== null && query.isPending),
    error: query.error ?? scopeQuery.error,
    refetch,
    scope,
    unavailable,
  };
}

/** One product by UUID. `data` is `null` when no such product exists. */
export function useProduct(id: string | null | undefined) {
  return useQuery(productQueryOptions(id));
}

/** Stable identity so the memos below do not re-run while the query is idle. */
const EMPTY_GROUPS: AttributeGroup[] = [];

/**
 * A configurable dish's addon groups, options included.
 *
 * Its own query rather than part of `useProduct` because it is a SEPARATE and
 * more expensive read — one request for the configuration plus one per group,
 * since nothing in the backend projects them together (see
 * `services/api/configuration-service.ts`). Keeping it separate is also what
 * keeps it easy to see that only the food-detail screen pays for it.
 *
 * Disabled for a standard dish and for a configurable one with no
 * configuration id, which both mean "nothing to ask" — the query never fires
 * and `data` stays undefined.
 *
 * Cached as long as the menu it came from: a restaurant edits its options at
 * the same rhythm it edits its dishes.
 */
export function productConfigurationQueryOptions(product: MenuProductOutput | null | undefined) {
  const configurationId = product?.isConfigurable ? product.configuration?.id : null;

  return {
    queryKey: productKeys.configuration(configurationId ?? ''),
    queryFn: (): Promise<AttributeGroup[]> => fetchProductConfiguration(configurationId!),
    enabled: !!configurationId,
    staleTime: MENU_STALE_TIME,
  };
}

/**
 * A configurable dish's addon groups, plus whether they are still being
 * resolved.
 *
 * `isResolving` is not cosmetic and callers must honour it: a configurable
 * dish renders with NO groups until this settles, so a screen that only looked
 * at the list would let the customer add a dish whose required choices simply
 * had not arrived yet. It is `isLoading` rather than `isPending` because a
 * disabled query — a standard dish — stays pending forever.
 */
export function useProductConfiguration(product: MenuProductOutput | null | undefined) {
  const query = useQuery(productConfigurationQueryOptions(product));

  return {
    groups: query.data ?? EMPTY_GROUPS,
    isResolving: query.isLoading,
    error: query.error,
  };
}

/**
 * Addon groups in the shape the food screen renders, mapped once per data
 * change rather than per render.
 */
export function useAddonGroups(groups: AttributeGroup[]) {
  return useMemo(() => toAddonGroups(groups, new Date()), [groups]);
}

/**
 * The same addons' surcharges as numbers, keyed by option id — what the
 * running total is computed from. Memoized alongside {@link useAddonGroups} so
 * the two always describe the same options at the same instant.
 */
export function useAddonAmounts(groups: AttributeGroup[]) {
  return useMemo(() => addonAmounts(groups, new Date()), [groups]);
}

/**
 * How long a resolved artwork path stays fresh. Artwork changes far less often
 * than a menu does, so it outlives the menu's staleness window — and a menu
 * grid re-entered from a dish detail then costs no image requests at all.
 */
const PRODUCT_IMAGE_STALE_TIME = 30 * 60 * 1000;

/**
 * The cache entry holding one product's artwork path.
 *
 * Colocated and shared by the single-product hook and the menu-wide one below,
 * so a dish whose image the grid already resolved renders its detail screen
 * from cache rather than re-fetching.
 */
export function productImageQueryOptions(id: string | null | undefined) {
  return {
    queryKey: productKeys.image(id ?? ''),
    queryFn: (): Promise<string | null> => fetchProductImageUrl(id!),
    // A non-UUID could only ever come back empty — see `fetchProductImageUrl`.
    enabled: !!id && isUuid(id),
    staleTime: PRODUCT_IMAGE_STALE_TIME,
  };
}

/**
 * A product's artwork path, or `null` when it has none.
 *
 * Its own query rather than part of `useProduct` because it is a SEPARATE
 * request: products carry no image field, so artwork costs one
 * `GET /files/products/{id}` per dish.
 */
export function useProductImageUrl(id: string | null | undefined) {
  return useQuery(productImageQueryOptions(id));
}

/** Stable identity so an empty menu does not re-run the memos below. */
const EMPTY_IDS: string[] = [];

/**
 * Flattens the per-product results to one path (or `null`) per id, in the
 * order they were asked for.
 *
 * Module-level, and returning a plain ARRAY of strings, for two reasons that
 * both come down to identity: `useQueries` re-runs `combine` whenever the
 * function itself is new, so an inline closure would recompute every render;
 * and it structurally compares the combined value, which preserves the array
 * across renders in which no image actually changed. A `Map` would fail that
 * comparison and hand every card a freshly built source each pass.
 */
function collectImagePaths(
  results: UseQueryResult<string | null, Error>[]
): (string | null)[] {
  return results.map((result) => result.data ?? null);
}

/**
 * Artwork for a list of menu products, as the lookup the cards render from.
 *
 * **This is deliberately one request per product** — the N+1 the plan (§3.5)
 * flagged. There is no batch files endpoint and no image field on
 * `ProductOutputData`, so a menu that shows real dish photos has no cheaper
 * shape available today. What keeps it affordable is scope and caching: the
 * caller passes only the ids it is actually rendering (a tab filter narrows
 * the list), ids are de-duplicated here, and each answer then stays fresh for
 * {@link PRODUCT_IMAGE_STALE_TIME} and is shared with the food-detail screen,
 * which reads the same cache entry. If the backend grows a batch endpoint or a
 * product image field, this hook is the one place that changes.
 *
 * `productIds` must be memoized by the caller: a fresh array every render
 * would rebuild the observer list on every pass.
 *
 * Returns a resolver rather than raw paths because the value the backend sends
 * is a RELATIVE `/files/...` path that still has to be joined onto the API
 * base and carry the bearer token `/files/**` requires — see
 * `useRestaurantImageSourceFromPath`. `undefined` means "no artwork yet",
 * which is what makes a card fall through to its placeholder.
 */
export function useProductImageSources(productIds: string[] = EMPTY_IDS) {
  const ids = useMemo(
    () => Array.from(new Set(productIds.filter(isUuid))),
    [productIds]
  );

  const paths = useQueries({
    queries: ids.map((id) => productImageQueryOptions(id)),
    combine: collectImagePaths,
  });

  const toSource = useRestaurantImageSourceFromPath();

  // Built once per change rather than per lookup: a source object rebuilt on
  // every render would hand `<Image>` a new prop each time the screen
  // re-renders — and it does, on every scroll frame that toggles the compact
  // header — so the artwork would reload under the customer.
  const sources = useMemo(() => {
    const built = new Map<string, ImageSource>();
    paths.forEach((path, index) => {
      if (path) built.set(ids[index], toSource(path));
    });
    return built;
  }, [ids, paths, toSource]);

  return useCallback((productId: string) => sources.get(productId), [sources]);
}
