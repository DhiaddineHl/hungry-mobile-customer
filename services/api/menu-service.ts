import { pageSchema } from '@/schemas/page';
import { z } from 'zod';
import { ApiError, apiClient } from './client';

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
