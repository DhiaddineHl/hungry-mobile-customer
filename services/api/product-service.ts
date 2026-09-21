import { pageSchema, type Page } from '@/schemas/page';
import {
  configurableProductOutputSchema,
  fileMetadataSchema,
  productOutputSchema,
  type ConfigurableProductOutput,
} from '@/schemas/product';
import { z } from 'zod';
import { ApiError, apiClient, isApiError } from './client';
import type { MenuScope } from './menu-service';

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
 * A menu holds BOTH product subtypes and must show both:
 * `StandardProduct` (`product_type` 1) is ordered as-is, `ConfigurableProduct`
 * (2) asks the customer for choices or supplements first.
 *
 * `/products/all` is the polymorphic query — it returns every dish in the
 * catalog — and since `productType` was added to `ProductOutputData` it also
 * says which subtype each row is. One request therefore yields a fully
 * labelled menu; the parallel `/configurable-products/all` lookup this module
 * used to run existed only to recover the discriminator by id membership, and
 * is gone.
 *
 * `/configurable-products/{id}` is still needed for ONE thing: the
 * configuration's id, which the base projection does not carry. Nothing else
 * about it is useful — see `configurableProductOutputSchema`, its
 * `configuration.attributes` is always empty.
 */
const PRODUCTS = '/products';
const CONFIGURABLE_PRODUCTS = '/configurable-products';

/**
 * The `product_type` discriminator values, mirroring the `@DiscriminatorValue`
 * on each `Product` subclass. Only `isConfigurableType` reads them.
 */
const PRODUCT_TYPE_CONFIGURABLE = 2;

/**
 * Whether a `productType` means "the customer configures this before ordering".
 *
 * Anything that is not explicitly the configurable discriminator — including
 * `null`, which `resolveProductType` answers for a subtype it does not know —
 * is treated as standard. That is the safe direction to be wrong in: a dish
 * mislabelled standard is still orderable at its base price, whereas one
 * mislabelled configurable opens a sheet with nothing in it.
 */
export function isConfigurableType(productType: number | null | undefined): boolean {
  return productType === PRODUCT_TYPE_CONFIGURABLE;
}

/**
 * Entity properties the backend can actually sort by. Deliberately a closed
 * union rather than a string: an unknown field is a 500, so caller input must
 * never reach the query.
 */
export type ProductSortField = 'name' | 'code' | 'createdAt';

const productPageSchema = pageSchema(productOutputSchema);
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
  /**
   * Narrows to one menu section — a plain UUID, and one of the section ids the
   * scope carries. Anything else reads as an empty menu.
   */
  categoryId?: string;
  /** Substring match on the product name, applied server-side via LIKE. */
  nameLike?: string;
  /** Applied to EACH section's request, not to the merged menu. */
  page?: number;
  size?: number;
  sort?: ProductSortField;
}

/**
 * `ProductFilter` mixes two shapes, which is easy to get wrong:
 * `ids`/`codes`/`names` take a `FilterSpecification[]`, while `catalogId`,
 * `catalogVersionId` and `categoryId` take a plain UUID string. Wrapping the
 * latter in a specification object does not filter — it fails.
 *
 * `catalogId` / `catalogVersionId` are deliberately NOT modelled here any
 * more. Every restaurant now stages its menu in the same platform catalog
 * version, so filtering on one returns the whole platform's dishes — see the
 * header of `services/api/menu-service.ts`. `categoryId` is the only field
 * that actually narrows to one restaurant.
 */
interface ProductFilter {
  categoryId?: string;
  names?: { operator: string; fieldValue: string; fieldType: string }[];
}

/**
 * One dish on a menu: the base projection, plus whether ordering it requires
 * the customer to configure anything.
 *
 * `isConfigurable` is `productType === 2` and nothing more — a fact about the
 * row, decided by the backend's discriminator rather than inferred. It is kept
 * as a derived boolean rather than leaving callers to read `productType`
 * because the mapping from discriminator to meaning belongs in exactly one
 * place.
 *
 * `configuration` is present only on the detail read, and only ever carries
 * the configuration's own id/code/name — never its groups. Those come from
 * `fetchProductConfiguration` in `services/api/configuration-service.ts`.
 */
export interface MenuProductOutput extends ConfigurableProductOutput {
  isConfigurable: boolean;
}

/**
 * Products per section request. A section holds far fewer dishes than this;
 * the size is high because the menu screen renders every section at once and
 * has no "load more" affordance to page one with.
 */
const SECTION_PAGE_SIZE = 100;

/** One section's page of dishes, already labelled with their subtype. */
async function fetchSection(
  categoryId: string,
  params: FetchMenuParams
): Promise<Page<MenuProductOutput>> {
  const { nameLike, page = 0, size = SECTION_PAGE_SIZE, sort } = params;

  const filter: ProductFilter = { categoryId };

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
  const { data } = await apiClient.get(`${PRODUCTS}/all`, { params: query });

  const menu = parseOrThrow(productPageSchema, data, 'menu');

  return {
    ...menu,
    content: menu.content.map((product) => ({
      ...product,
      isConfigurable: isConfigurableType(product.productType),
    })),
  };
}

/** The envelope for a menu with no section to read — never a request. */
function emptyPage(page: number): Page<MenuProductOutput> {
  return { content: [], number: page, totalPages: 0, totalElements: 0, last: true };
}

/**
 * A restaurant's menu, standard and configurable dishes alike.
 *
 * **One request per SECTION**, run in parallel. Products are not addressable
 * by restaurant and no longer by catalog either — every restaurant stages its
 * menu in the same platform catalog version, so a `catalogVersionId` filter
 * returns the whole platform's dishes. The section categories resolved by
 * `fetchMenuScope` are the only thing that narrows to one restaurant, and
 * `ProductFilter.categoryId` takes exactly one of them, so the fan-out is what
 * the backend's filter shape leaves available. Sections are few (a menu has a
 * handful), the requests are independent, and the whole set is cached as one
 * menu query.
 *
 * `/products/all` is polymorphic, so each of those requests returns standard
 * AND configurable dishes, and `productType` labels every row — see the
 * endpoint note at the top of this module. Neither subtype's addons are
 * readable from a list endpoint at all, so there is nothing a further request
 * could usefully add here; the food screen resolves them per dish.
 *
 * A dish filed under two sections comes back from both and is kept ONCE: the
 * duplicate is an artifact of the fan-out, not of the menu. Which sections it
 * belongs to is read off its own `subcategories` when the menu is grouped, so
 * de-duplicating here loses nothing.
 */
export async function fetchMenu(
  scope: MenuScope,
  params: FetchMenuParams = {}
): Promise<Page<MenuProductOutput>> {
  const { categoryId, page = 0 } = params;

  // A section filter narrows the fan-out to one request. An id that is not one
  // of this menu's sections reads as an empty menu rather than as another
  // restaurant's section — the scope is what decides which products are this
  // restaurant's, so a caller must not be able to step outside it.
  const sections = categoryId
    ? scope.sections.filter((section) => section.id === categoryId)
    : scope.sections;

  if (sections.length === 0) return emptyPage(page);

  const pages = await Promise.all(
    sections.map((section) => fetchSection(section.id, params))
  );

  const products = new Map<string, MenuProductOutput>();
  for (const sectionPage of pages) {
    for (const product of sectionPage.content) {
      if (!products.has(product.id)) products.set(product.id, product);
    }
  }

  return {
    content: [...products.values()],
    number: page,
    // The envelope describes the MERGED menu, so `totalElements` counts the
    // dishes actually returned rather than summing the sections — a dish in
    // two sections would otherwise be counted twice. `last` is false as soon
    // as any one section has more to give.
    totalPages: Math.max(...pages.map((sectionPage) => sectionPage.totalPages ?? 1)),
    totalElements: products.size,
    last: pages.every((sectionPage) => sectionPage.last !== false),
  };
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
 * BOTH subtypes are reachable here, and `productType` is what decides how.
 * `/products/{id}` resolves against the polymorphic base, so it answers for
 * every dish and its `productType` says which subtype the row is. Only a
 * configurable dish then costs a second request, to `/configurable-products/{id}`
 * — the sole projection carrying the CONFIGURATION ID that
 * `fetchProductConfiguration` needs to reach the addon groups.
 *
 * This replaces a try-configurable-then-fall-back-to-base sequence that had to
 * read a 500 from the first route as "then it must be standard". That was two
 * requests for every standard dish, and it could not tell a real fault on a
 * configurable dish from a standard one — the dish would silently render
 * without its required choices. Asking the discriminator removes the guess.
 *
 * A configurable dish whose second request fails is returned WITHOUT its
 * configuration rather than failing the screen: the dish itself was read
 * successfully, and `isConfigurable` still says a choice is owed, so the food
 * screen keeps it out of the cart instead of pricing it as if it had none.
 */
export async function fetchProductById(id: string): Promise<MenuProductOutput | null> {
  // Save the round-trip: a non-UUID can only ever come back 500 here.
  if (!isUuid(id)) return null;

  const path = encodeURIComponent(id);

  let base;
  try {
    const { data } = await apiClient.get(`${PRODUCTS}/${path}`);
    base = parseOrThrow(productOutputSchema, data, 'product');
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }

  if (!isConfigurableType(base.productType)) {
    return { ...base, isConfigurable: false };
  }

  try {
    const { data } = await apiClient.get(`${CONFIGURABLE_PRODUCTS}/${path}`);
    return {
      ...parseOrThrow(configurableProductOutputSchema, data, 'product'),
      isConfigurable: true,
    };
  } catch {
    // See the note above: the dish is still shown, still marked configurable,
    // and simply has no configuration to resolve groups from.
    return { ...base, isConfigurable: true };
  }
}

/**
 * Whether a failure means "no such product here" rather than a real fault.
 *
 * 500 is included because a missing id answers `500 NoSuchElementException` —
 * see the note above `fetchProductById`.
 */
function isNotFound(error: unknown): boolean {
  return isApiError(error, 404) || isApiError(error, 400) || isApiError(error, 500);
}

/**
 * The path of the first image the backend holds for a product, or `null` when
 * it holds none.
 *
 * Products have NO image field of their own — unlike restaurants, which got
 * `logoUrl` and `coverImageUrl` — so artwork costs a separate request per
 * product, and there is no batch files endpoint to ask for several at once.
 * A menu grid showing real dish photos therefore pays one request per card
 * (plan §3.5). Call it through `useProductImageSources`, which is where that
 * fan-out is scoped to the visible sections, de-duplicated and cached; going
 * straight to this function from a list view repeats it uncached.
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
