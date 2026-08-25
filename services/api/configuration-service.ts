import { pageSchema } from '@/schemas/page';
import { attributeGroupSchema, type AttributeGroup } from '@/schemas/product';
import { z } from 'zod';
import { ApiError, apiClient } from './client';

/**
 * Reads a configurable product's addon groups and the options inside them.
 *
 * Its own module rather than part of `product-service` because it answers a
 * different question — what a dish ASKS, not what it is — and because only the
 * food screen may call it. A menu grid must not: it is a request per dish.
 *
 * ## Where the data comes from
 *
 * `/attribute-groups/all` filtered by `productConfigurationId`, in one request.
 * The groups come back with `required` set and their options nested, each
 * option carrying its own prices — everything the food screen needs.
 *
 * The other routes nearby are all dead ends for this, which is worth knowing
 * before anyone tries to save the round-trip:
 *   - `/configurable-products/{id}` returns `configuration` with only
 *     id/code/name/description. Its `attributes` is always null —
 *     `ConfigurableProductBaseInversePopulator` builds a fresh output object
 *     and never copies the groups across. Its one use is supplying the
 *     configuration id this module is called with.
 *   - `/product-configurations/{id}` returns the groups but stops at each
 *     group's own fields, so the options are missing.
 *   - `/attributes/all` returns the options but narrows by `attributeGroupId`
 *     only, one group at a time.
 *
 * This module used to walk the last two — a configuration read plus one
 * request per group. `/attribute-groups` did not exist then; the back-office
 * could not persist a group either, which is why no configurable dish had any.
 */

const ATTRIBUTE_GROUPS = '/attribute-groups';

/**
 * Page size for one dish's groups.
 *
 * A ceiling, not a paging window: these are the questions a customer answers
 * on one screen ("Size", "Sauces", "Extras"), and nothing paginates through
 * them.
 */
const GROUPS_PAGE_SIZE = 50;

/**
 * Creation order, which is the order the restaurant entered the groups in.
 *
 * The controller's default is `createdAt` DESCENDING, which would show them
 * back to front. The backend reads any direction that is not the exact string
 * `"desc"` as ascending (`DefaultCrudRepository.createSortOrder`). The options
 * WITHIN each group are ordered server-side by `@OrderBy` on the association.
 */
const GROUPS_SORT = JSON.stringify([{ field: 'createdAt', direction: 'ASC' }]);

const attributeGroupPageSchema = pageSchema(attributeGroupSchema);

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
 * A configurable product's addon groups, each with its options attached.
 *
 * An empty list means the dish asks nothing — either its groups were never
 * entered in the back-office, or it has none by design. That is a real answer,
 * not an error: a filter matching no rows returns an empty page rather than
 * the 500 a missing id would answer on a `/{id}` route.
 *
 * Failures PROPAGATE rather than degrading to an empty list. "This dish has no
 * required choices" and "we could not find out what this dish requires" are
 * opposite instructions to the screen: the first allows the dish into the
 * cart, the second must not.
 *
 * Groups with no id are dropped — the screen keys selections by group id, so
 * one that cannot be identified cannot be tracked.
 */
export async function fetchProductConfiguration(
  configurationId: string
): Promise<AttributeGroup[]> {
  const { data } = await apiClient.get(`${ATTRIBUTE_GROUPS}/all`, {
    params: {
      page: 0,
      size: GROUPS_PAGE_SIZE,
      // A plain UUID string, not a FilterSpecification — `AttributeGroupFilter`
      // declares `productConfigurationId` as a bare UUID, exactly like
      // `ProductFilter` declares `categoryId`. Wrapping it in a specification
      // does not filter.
      filter: JSON.stringify({ productConfigurationId: configurationId }),
      sort: GROUPS_SORT,
    },
  });

  const page = parseOrThrow(attributeGroupPageSchema, data, 'addon groups');

  return page.content.filter((group) => !!group.id);
}
