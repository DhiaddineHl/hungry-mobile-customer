import { pageSchema, type Page } from '@/schemas/page';
import {
  configurableProductOutputSchema,
  fileMetadataSchema,
  type ConfigurableProductOutput,
} from '@/schemas/product';
import { z } from 'zod';
import { ApiError, apiClient, isApiError } from './client';
import type { MenuScope } from './restaurant-view-model';

/**
 * Product reads against the gateway.
 *
 * Every response is parsed through the zod schemas before it leaves this
 * module, so a backend shape change surfaces here as a named `ApiError`
 * instead of an `undefined` several components downstream.
 *
 * The sharp edges this module works around are the same family as the
 * restaurant service's, but broader (see
 * docs/plans/restaurant-products-fetch-display-plan.md §3.4):
 *   - a missing product answers **500**, not 404;
 *   - a MALFORMED id also answers 500, not 400 — `ProductControllerAdvice`
 *     registers only the filter editor and no exception handlers, so unlike
 *     `/restaurants/abc` there is no 400 to distinguish it;
 *   - the free-text filter key `ProductFilter` exposes alongside `names`
 *     answers 500 (`isMember` applied to an `@ElementCollection` of basic
 *     strings — plan §3.3), so this module never emits it and the filter type
 *     below cannot express it;
 *   - an unknown `sort` field answers 500.
 */

/**
 * Everything here goes to `/configurable-products/all`, never `/products/all`.
 *
 * `Product` uses SINGLE_TABLE inheritance and the base endpoint returns the
 * base projection, which silently omits `configuration` — addons would simply
 * be invisible, with no error to notice.
 */
const CONFIGURABLE_PRODUCTS = '/configurable-products';

/**
 * Entity properties the backend can actually sort by. Deliberately a closed
 * union rather than a string: an unknown field is a 500, so caller input must
 * never reach the query.
 */
export type ProductSortField = 'name' | 'code' | 'createdAt';

const configurableProductPageSchema = pageSchema(configurableProductOutputSchema);
const fileMetadataListSchema = z.array(fileMetadataSchema);

/** Turns a zod failure into an ApiError naming the offending field path. */
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

export interface FetchMenuParams {
  /** Narrows to one menu section. A plain UUID string, like the scope keys. */
  categoryId?: string;
  /** Substring match on the product name, applied server-side via LIKE. */
  nameLike?: string;
  page?: number;
  size?: number;
  sort?: ProductSortField;
}

/**
 * `ProductFilter` mixes two shapes, which is easy to get wrong:
 * `ids`/`codes`/`names` take a `FilterSpecification[]`, while `catalogId`,
 * `catalogVersionId` and `categoryId` take a plain UUID string. Wrapping the
 * latter in a specification object does not filter — it fails.
 */
interface ProductFilter {
  catalogId?: string;
  catalogVersionId?: string;
  categoryId?: string;
  names?: { operator: string; fieldValue: string; fieldType: string }[];
}

/**
 * One page of a restaurant's menu.
 *
 * The scope comes from `menuScopeOf`, so a caller cannot reach this function
 * without a catalog link and there is no "fetch everything and guess which
 * products belong to this restaurant" path.
 */
export async function fetchMenu(
  scope: MenuScope,
  params: FetchMenuParams = {}
): Promise<Page<ConfigurableProductOutput>> {
  const { categoryId, nameLike, page = 0, size = 20, sort } = params;

  const filter: ProductFilter =
    'catalogVersionId' in scope
      ? { catalogVersionId: scope.catalogVersionId }
      : { catalogId: scope.catalogId };

  if (categoryId) filter.categoryId = categoryId;

  // Product search goes through `names` + LIKE, exactly as restaurant search
  // does. The free-text alternative 500s — see the module header and plan §3.3.
  if (nameLike?.trim()) {
    filter.names = [{ operator: 'LIKE', fieldValue: nameLike.trim(), fieldType: 'STRING' }];
  }

  const query: Record<string, string | number> = {
    page,
    size,
    filter: JSON.stringify(filter),
  };

  if (sort) {
    query.sort = JSON.stringify([{ field: sort, direction: 'ASC' }]);
  }

  // axios handles the encoding once, so no call site hand-builds a query string.
  const { data } = await apiClient.get(`${CONFIGURABLE_PRODUCTS}/all`, { params: query });
  return parseOrThrow(configurableProductPageSchema, data, 'menu');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` is shaped like a UUID — the only form the id routes accept. */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}

/**
 * One product by UUID, or `null` when it does not exist.
 *
 * A missing id answers **500 NoSuchElementException**, so a 500 on a
 * well-formed UUID is read as not-found. A genuine server fault on a valid id
 * is INDISTINGUISHABLE from a missing record at this layer — the trade is
 * deliberate, and the same one `fetchRestaurantById` makes: showing "not
 * found" for a transient fault is less harmful than showing a retrying error
 * screen for every dead link, and `query-client`'s retry policy would
 * otherwise spend three round-trips on each one.
 *
 * A malformed id is rejected before the request rather than after: unlike the
 * restaurant routes it would answer 500 too, so there would be nothing in the
 * response to tell the two cases apart.
 *
 * Note the route: the plan documents the by-id 500s against `/products/{id}`,
 * but that is the base projection with no `configuration`, and the food-detail
 * screen exists to show addons. This calls the configurable analogue of the
 * verified `/configurable-products/all`, following the same `/all` + `/{id}`
 * pairing every other resource here uses. If that route turns out not to
 * exist, its 404 lands in the same not-found branch as a missing product, so
 * the screen degrades to "not found" rather than breaking.
 */
export async function fetchProductById(id: string): Promise<ConfigurableProductOutput | null> {
  // Save the round-trip: a non-UUID can only ever come back 500 here.
  if (!isUuid(id)) return null;

  try {
    const { data } = await apiClient.get(
      `${CONFIGURABLE_PRODUCTS}/${encodeURIComponent(id)}`
    );
    return parseOrThrow(configurableProductOutputSchema, data, 'product');
  } catch (error) {
    if (isApiError(error, 404) || isApiError(error, 400)) return null;
    if (isApiError(error, 500)) return null;
    throw error;
  }
}

/**
 * The path of the first image the backend holds for a product, or `null` when
 * it holds none.
 *
 * Products have NO image field of their own — unlike restaurants, which got
 * `logoUrl` and `coverImageUrl` — so artwork costs a separate request per
 * product. **Call this only from the food-detail screen**: fanning it out
 * across a menu grid is an N+1, and list views use a placeholder instead
 * (plan §3.5).
 *
 * The path is returned RAW — relative, exactly as the backend sent it — for
 * the same reason RESTO-01 persists `logoPath` rather than a resolved URL: a
 * stored absolute URL bakes in whatever `EXPO_PUBLIC_API_URL` was set to when
 * it was saved. Render sites resolve it through
 * `useRestaurantImageSourceFromPath`, which also attaches the bearer token
 * `/files/**` requires.
 */
export async function fetchProductImageUrl(id: string): Promise<string | null> {
  if (!isUuid(id)) return null;

  try {
    const { data } = await apiClient.get(`/files/products/${encodeURIComponent(id)}`);
    const files = parseOrThrow(fileMetadataListSchema, data, 'product image list');
    // An unknown id answers `200 []` rather than an error, so an empty list is
    // the normal "this product has no artwork" answer.
    return files.find((file) => !!file.url)?.url ?? null;
  } catch (error) {
    if (isApiError(error, 404) || isApiError(error, 400)) return null;
    throw error;
  }
}
