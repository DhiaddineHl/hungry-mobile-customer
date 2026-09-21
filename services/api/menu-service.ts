import { pageSchema } from '@/schemas/page';
import { z } from 'zod';
import { ApiError, apiClient, isApiError } from './client';

/**
 * Resolves WHERE a restaurant's menu lives.
 *
 * The backend still models NO relation between a restaurant and its products:
 * `Restaurant` has no catalog column and `ProductOutputData` has no restaurant
 * field (see docs/plans/restaurant-products-fetch-display-plan.md §2). What
 * changed is the convention the back-office writes menus under, and this
 * module reads the new one back.
 *
 * **A menu is a CATEGORY, not a catalog.** The whole platform now stages its
 * products in ONE catalog and ONE catalog version, and a restaurant's menu is
 * a category inside them:
 *
 *   menu category            RESTAURANT-MENU-<restaurantId>   (one per restaurant)
 *     └── section categories Pizzas, Drinks, …                (supercategory = the menu)
 *           └── products
 *
 * (`hungry-frontend/src/hooks/useRestaurantMenu.ts`: `menuCategoryCode`,
 * `ensureMenuSection`, `loadRestaurantMenu`.)
 *
 * The consequence for reads is the important part: **the catalog scope is no
 * longer a scope at all**. Filtering products by `catalogVersionId` now returns
 * every restaurant's dishes, because every restaurant shares that version. The
 * SECTION ids are what separate one menu from another, so they are what this
 * module resolves and what `fetchMenu` filters on.
 *
 * The code is built from the raw restaurant id and is NOT upper-cased — the
 * back-office only upper-cases per-instance product codes (`uniqueCode`), never
 * this one. An `EQUALS` filter is case-sensitive, so a menu that resolves to
 * nothing usually means the case drifted here.
 */

const CATEGORIES = '/categories';

/** Sections per menu. Far above any real menu; one request covers them all. */
const MAX_SECTIONS = 100;

/** The code the back-office files a restaurant's menu category under. */
export function menuCategoryCode(restaurantId: string): string {
  return `RESTAURANT-MENU-${restaurantId}`;
}

/**
 * `id` is required: a section that cannot be addressed cannot be filtered on,
 * and silently dropping it would hide part of a menu.
 */
const categorySchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  active: z.boolean().nullish(),
  visible: z.boolean().nullish(),
});

const categoryPageSchema = pageSchema(categorySchema);

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

/** One section of a menu — "Pizzas", "Drinks" — as products are fetched by. */
export interface MenuSection {
  id: string;
  name: string | null;
}

/**
 * The categories one restaurant's menu is read through.
 *
 * `sections` can legitimately be EMPTY: a menu category exists as soon as the
 * restaurant is created, and stays sectionless until the first dish is added.
 * That is an empty menu, not a missing one — which is why this resolves to a
 * scope rather than to `null`.
 */
export interface MenuScope {
  /** The restaurant's own menu category. */
  menuCategoryId: string;
  /** Its subcategories — the categories products actually hang off. */
  sections: MenuSection[];
}

/**
 * The single category with this `code`, or `null` when none exists.
 *
 * The CRUD `read(identifier)` route resolves its argument as a primary key
 * only (`UUID.fromString`), so an entity CANNOT be looked up by code there —
 * it would 500 on the parse. The list endpoint's `codes` filter is the only
 * way in, and `size: 1` is enough because codes are unique.
 */
async function findByCode(code: string): Promise<z.infer<typeof categorySchema> | null> {
  const { data } = await apiClient.get(`${CATEGORIES}/all`, {
    params: {
      page: 0,
      size: 1,
      filter: JSON.stringify({
        codes: [{ operator: 'EQUALS', fieldValue: code, fieldType: 'STRING' }],
      }),
    },
  });

  const page = parseOrThrow(categoryPageSchema, data, 'category list');
  return page.content[0] ?? null;
}

/**
 * A category is fetched from unless it is explicitly switched off. Filtering
 * here rather than in the query keeps `active` / `visible` off the wire: the
 * same rule already decides what `groupBySection` renders, and a section that
 * would be hidden is not worth a product request.
 */
function isDisplayable(category: { active?: boolean | null; visible?: boolean | null }): boolean {
  return category.active !== false && category.visible !== false;
}

/**
 * The sections of one restaurant's menu, or `null` when the restaurant has no
 * menu category at all.
 *
 * `null` is a legitimate answer, not an error: a restaurant whose menu was
 * never created in the back-office has no category, and the screens say so
 * rather than showing an empty menu.
 *
 * Two requests, both unavoidable: the menu category can only be found by code,
 * and its children can only be found by its id.
 */
export async function fetchMenuScope(restaurantId: string): Promise<MenuScope | null> {
  const menu = await findByCode(menuCategoryCode(restaurantId));
  if (!menu) return null;

  const { data } = await apiClient.get(`${CATEGORIES}/all`, {
    params: {
      page: 0,
      size: MAX_SECTIONS,
      // `supercategoryId` is a plain UUID on `CategoryFilter`, NOT a
      // FilterSpecification — wrapping it in one does not filter, it fails.
      filter: JSON.stringify({ supercategoryId: menu.id }),
    },
  });

  const page = parseOrThrow(categoryPageSchema, data, 'menu section list');

  return {
    menuCategoryId: menu.id,
    sections: page.content
      .filter(isDisplayable)
      .map((category) => ({ id: category.id, name: category.name ?? null })),
  };
}

// --- Reading a menu backwards: which restaurant a product belongs to --------

/**
 * `GET /categories/{id}` returns the list projection plus the parent links —
 * `supercategoryIds` is what lets a section be walked back up to its menu.
 */
const categoryDetailSchema = categorySchema.extend({
  supercategoryIds: z.array(z.string()).catch([]),
});

const MENU_CATEGORY_CODE_PREFIX = 'RESTAURANT-MENU-';

/** The restaurant id a menu category's code was built from, or `null`. */
export function restaurantIdFromMenuCategoryCode(code: string | null | undefined): string | null {
  if (!code || !code.startsWith(MENU_CATEGORY_CODE_PREFIX)) return null;
  const restaurantId = code.slice(MENU_CATEGORY_CODE_PREFIX.length);
  return restaurantId || null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One category by id, or `null` when it does not exist.
 *
 * Same trade as `fetchRestaurantById`: a missing id answers 500, so a 500 on
 * a well-formed UUID is read as not-found rather than as a fault.
 */
async function fetchCategoryById(id: string): Promise<z.infer<typeof categoryDetailSchema> | null> {
  if (!UUID.test(id)) return null;

  try {
    const { data } = await apiClient.get(`${CATEGORIES}/${encodeURIComponent(id)}`);
    return parseOrThrow(categoryDetailSchema, data, 'category');
  } catch (error) {
    if (isApiError(error, 404) || isApiError(error, 400)) return null;
    if (isApiError(error, 500)) return null;
    throw error;
  }
}

/**
 * The restaurant whose menu a section belongs to, or `null` when the section
 * is not under any restaurant's menu.
 *
 * This is `fetchMenuScope` walked in the other direction: a product lists its
 * section categories, a section lists its supercategories, and the one whose
 * code is `RESTAURANT-MENU-<restaurantId>` is the menu. It exists for cart
 * hydration, where the only thing the server hands back per line is a
 * product id (`CartItem` has no restaurant) and checkout needs to know which
 * restaurant to order each line from.
 *
 * Two requests per section. Callers restoring a whole cart memoise by section
 * id — every dish in one section resolves to the same restaurant.
 */
export async function fetchRestaurantIdForSection(sectionId: string): Promise<string | null> {
  const section = await fetchCategoryById(sectionId);
  if (!section) return null;

  for (const parentId of section.supercategoryIds) {
    const parent = await fetchCategoryById(parentId);
    const restaurantId = restaurantIdFromMenuCategoryCode(parent?.code);
    if (restaurantId) return restaurantId;
  }

  return null;
}
