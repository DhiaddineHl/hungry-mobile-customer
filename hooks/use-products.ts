import { useRestaurantImageSourceFromPath } from '@/hooks/use-restaurant-image';
import type { Page } from '@/schemas/page';
import type { AttributeGroup } from '@/schemas/product';
import { fetchMenuScope, type MenuScope } from '@/services/api/menu-service';
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
  selectPrice,
  toAddonGroups,
  type MenuSectionData,
} from '@/services/api/product-view-model';
import { menuKeys, productKeys } from '@/services/api/query-keys';
import { type RestaurantDetail } from '@/services/api/restaurant-view-model';
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

// A menu's sections are edited far less often than the dishes inside them —
// adding a dish to an existing section changes nothing here — so the scope
// outlives the menu's own staleness window, for the same reason artwork does.
const MENU_SCOPE_STALE_TIME = 30 * 60 * 1000;

export function menuQueryOptions(scope: MenuScope | null, params: FetchMenuParams = {}) {
  // The SECTION IDS are the cache identity, not the whole scope object: the
  // section names ride along for grouping, and re-fetching a menu because one
  // was renamed would be churn. A menu with no section keys as an empty list,
  // which is exactly what it is.
  const sectionIds = scope?.sections.map((section) => section.id) ?? null;

  return {
    queryKey: productKeys.list(sectionIds, params),
    queryFn: (): Promise<Page<MenuProductOutput>> => fetchMenu(scope!, params),
    // No scope means the restaurant has no menu category at all, and there is
    // no query that could stand in for one — see `fetchMenuScope`. Firing a
    // request would return some other restaurant's products.
    enabled: scope !== null,
    staleTime: MENU_STALE_TIME,
    // Grouped against the menu's OWN sections, so a dish also filed into
    // another restaurant's category cannot open a section here.
    select: (page: Page<MenuProductOutput>): MenuSectionData[] =>
      groupBySection(page.content, new Date(), sectionIds ?? undefined),
  };
}

/**
 * Which categories a restaurant's menu is made of, resolved from the
 * deterministic code the back-office files the menu category under. See
 * `services/api/menu-service.ts`.
 *
 * Its own query rather than part of the menu query so the answer is cached per
 * restaurant and shared by every menu query against it — a section filter or a
 * search term re-fetches the dishes, never the sections they hang off.
 */
export function menuScopeQueryOptions(restaurantId: string | null | undefined) {
  return {
    queryKey: menuKeys.scope(restaurantId ?? ''),
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
  reason: 'no-menu';
}

/**
 * A restaurant's menu, already grouped into sections.
 *
 * Two steps, because the backend offers no shorter route. The restaurant's
 * menu CATEGORY is resolved from the deterministic code the back-office files
 * it under, together with its sections (`fetchMenuScope`); the dishes are then
 * read section by section (`fetchMenu`). The restaurant payload carries no
 * shortcut past that — it names no catalog, and a catalog would not identify a
 * menu anyway now that every restaurant's dishes are staged in the same one.
 *
 * Returns a discriminated `{ status: 'unavailable' }` when that resolution
 * comes back empty — a restaurant whose menu was never created. Callers must
 * handle it explicitly rather than reading an empty list, because "this
 * restaurant has no menu connected" and "this restaurant's menu is empty" are
 * different things to tell a customer. A menu category that exists with NO
 * section is the second of those: it resolves to a scope and an empty list.
 *
 * `isPending` deliberately covers the section lookup as well as the dish
 * fetch, and `unavailable` stays null until that lookup has actually settled.
 * Otherwise every restaurant would flash "no menu" for the duration of one
 * round-trip, since callers check `unavailable` before `isPending` — it is the
 * more specific state.
 */
export function useRestaurantMenu(
  restaurant: RestaurantDetail | null | undefined,
  params: FetchMenuParams = {}
) {
  // Skipped while the restaurant itself is still loading — its id is what the
  // menu category's code is built from.
  const scopeQuery = useQuery(menuScopeQueryOptions(restaurant ? restaurant.id : null));

  const scope = scopeQuery.data ?? null;

  const query = useQuery(menuQueryOptions(scope, params));

  // `isLoading` rather than `isPending`: a disabled query stays pending
  // forever, which would pin the menu to its skeleton.
  const resolvingScope = scopeQuery.isLoading;

  // `restaurant` being absent is still loading, not unavailable: the caller
  // has not resolved which restaurant this is yet.
  const unavailable: UnavailableMenu | null =
    restaurant && scope === null && !resolvingScope && !scopeQuery.isError
      ? { status: 'unavailable', reason: 'no-menu' }
      : null;

  const refetch = useCallback(() => {
    // The section lookup is refetched first: when IT is what failed, the menu
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
 * Flattens per-product results to the product (or `null`) each id resolved to.
 *
 * Module-level for the identity reason `collectImagePaths` documents:
 * `useQueries` re-runs `combine` whenever the function itself is new.
 */
function collectProducts(
  results: UseQueryResult<MenuProductOutput | null, Error>[]
): (MenuProductOutput | null)[] {
  return results.map((result) => result.data ?? null);
}

/**
 * Today's unit price for each product, keyed by product id.
 *
 * **This is the menu price NOW, not the price anyone paid.** It exists for one
 * caller: a placed order whose prices this device never captured (see
 * `store/order-price-store.ts`). The backend keeps no price on an order and no
 * history on a `Price`, so a dish repriced since resolves to its new amount —
 * which is why every screen using this must say the number is a menu price.
 *
 * `null` for a product that could not be resolved, or that has no applicable
 * price right now: unknown, never free. Ids are de-duplicated, so a dish
 * ordered on two lines costs one request, and each answer is the same cache
 * entry the menu and the dish screen already use.
 *
 * Pass an empty list to fetch nothing — which is what the order screen does
 * whenever it has a receipt to read instead.
 */
export function useMenuUnitPrices(productIds: string[] = EMPTY_IDS) {
  const ids = useMemo(
    () => Array.from(new Set(productIds.filter(isUuid))),
    [productIds]
  );

  const products = useQueries({
    queries: ids.map((id) => productQueryOptions(id)),
    combine: collectProducts,
  });

  return useMemo(() => {
    const now = new Date();
    const prices = new Map<string, number | null>();
    products.forEach((product, index) => {
      prices.set(ids[index], product ? (selectPrice(product.prices, now)?.amount ?? null) : null);
    });
    return prices;
  }, [ids, products]);
}

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
