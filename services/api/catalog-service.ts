import { pageSchema } from '@/schemas/page';
import { z } from 'zod';
import { ApiError, apiClient } from './client';
import type { MenuScope } from './restaurant-view-model';

/**
 * Resolves which catalog a restaurant's menu lives in.
 *
 * The backend models NO relation between a restaurant and its products:
 * `Restaurant` has no catalog column and `ProductOutputData` has no restaurant
 * field (see docs/plans/restaurant-products-fetch-display-plan.md §2). The
 * back-office dashboard — which is what creates these menus — works around
 * that with a **deterministic code convention**, and this module reads the
 * same convention back:
 *
 *   catalog          RESTAURANT-MENU-<restaurantId>
 *   catalog version  RESTAURANT-MENU-<restaurantId>-V1
 *
 * (`hungry-frontend/src/hooks/useRestaurantMenu.ts`, `menuCatalogCode` /
 * `menuVersionCode`.) This is not a guess about ownership: the dashboard's
 * `createMenuProduct` bootstraps the catalog, version and category under
 * exactly these codes the first time a restaurant gets a dish, so any menu
 * that exists was created under them.
 *
 * The codes are built from the raw restaurant id and are NOT upper-cased —
 * the dashboard only upper-cases per-instance product codes (`uniqueCode`),
 * never these. An `EQUALS` filter is case-sensitive, so a menu that resolves
 * to nothing usually means the case drifted here.
 */

const CATALOGS = '/catalogs';
const CATALOG_VERSIONS = '/catalog-versions';

/** The code the dashboard files a restaurant's menu catalog under. */
export function menuCatalogCode(restaurantId: string): string {
  return `RESTAURANT-MENU-${restaurantId}`;
}

/** The code of that catalog's only version. */
export function menuVersionCode(restaurantId: string): string {
  return `${menuCatalogCode(restaurantId)}-V1`;
}

/**
 * `id` is required: an entry that cannot be addressed is useless as a scope,
 * and silently treating it as "not found" would hide a real backend change.
 */
const catalogEntrySchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  name: z.string().nullish(),
});

const catalogEntryPageSchema = pageSchema(catalogEntrySchema);

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

/**
 * The single entry with this `code`, or `null` when none exists.
 *
 * The CRUD `read(identifier)` route resolves its argument as a primary key
 * only (`UUID.fromString`), so an entity CANNOT be looked up by code there —
 * it would 500 on the parse. The list endpoint's `codes` filter is the only
 * way in, and `size: 1` is enough because codes are unique.
 */
async function findByCode(
  resource: string,
  code: string,
  what: string
): Promise<{ id: string } | null> {
  const { data } = await apiClient.get(`${resource}/all`, {
    params: {
      page: 0,
      size: 1,
      filter: JSON.stringify({
        codes: [{ operator: 'EQUALS', fieldValue: code, fieldType: 'STRING' }],
      }),
    },
  });

  const page = parseOrThrow(catalogEntryPageSchema, data, what);
  return page.content[0] ?? null;
}

/**
 * The catalog scope this restaurant's menu should be fetched with, or `null`
 * when no catalog was ever created for it.
 *
 * The version is looked up FIRST and on its own. Both codes are deterministic,
 * so the dashboard's catalog → version chain is only needed by the code path
 * that CREATES them; a reader can address the version directly and spend one
 * request instead of two. The catalog lookup is kept as a fallback for a menu
 * whose version was created under a different name.
 *
 * `null` is a legitimate answer, not an error: a restaurant whose menu was
 * never set up in the dashboard has no catalog, and the screens say so rather
 * than showing an empty menu.
 */
export async function fetchMenuScope(restaurantId: string): Promise<MenuScope | null> {
  const version = await findByCode(
    CATALOG_VERSIONS,
    menuVersionCode(restaurantId),
    'catalog version list'
  );
  if (version) return { catalogVersionId: version.id };

  const catalog = await findByCode(CATALOGS, menuCatalogCode(restaurantId), 'catalog list');
  if (catalog) return { catalogId: catalog.id };

  return null;
}
