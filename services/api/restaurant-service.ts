import {
  pageSchema,
  restaurantOutputSchema,
  type Page,
  type RestaurantOutput,
} from '@/schemas/restaurant';
import { z } from 'zod';
import { ApiError, apiClient, isApiError } from './client';

/**
 * Restaurant reads against the gateway.
 *
 * Every response is parsed through the zod schemas before it leaves this
 * module, so a backend shape change surfaces here as a named `ApiError`
 * instead of an `undefined` several components downstream.
 *
 * The backend has three sharp edges this module works around, all verified
 * live (see docs/plans/restaurants-fetch-display-plan.md §2.4):
 *   - a missing restaurant answers **500**, not 404;
 *   - filtering on `cuisines`/`dishes` answers **500** (they are
 *     `@ElementCollection`s the specification cannot handle);
 *   - an unknown `sort` field answers **500**.
 */

/**
 * Entity properties the backend can actually sort by. Deliberately a closed
 * union rather than a string: an unknown field is a 500, so caller input must
 * never reach the query.
 */
export type RestaurantSortField = 'name' | 'createdAt' | 'modifiedAt' | 'foundedYear';

const restaurantPageSchema = pageSchema(restaurantOutputSchema);

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

export interface FetchRestaurantsParams {
  page?: number;
  size?: number;
  /** Substring match on the restaurant name, applied server-side via LIKE. */
  nameLike?: string;
  sort?: RestaurantSortField;
}

/**
 * One page of restaurants.
 *
 * Note that `enabled` is not filterable server-side, and neither is any
 * cuisine or dish — those have to be narrowed client-side by the caller.
 */
export async function fetchRestaurants(
  params: FetchRestaurantsParams = {}
): Promise<Page<RestaurantOutput>> {
  const { page = 0, size = 10, nameLike, sort } = params;

  // Only `names` is emitted here. A `cuisines` or `dishes` key would 500.
  const query: Record<string, string | number> = { page, size };

  if (nameLike?.trim()) {
    query.filter = JSON.stringify({
      names: [{ operator: 'LIKE', fieldValue: nameLike.trim(), fieldType: 'STRING' }],
    });
  }

  if (sort) {
    query.sort = JSON.stringify([{ field: sort, direction: 'ASC' }]);
  }

  // axios handles the encoding once, so no call site hand-builds a query string.
  const { data } = await apiClient.get('/restaurants/all', { params: query });
  return parseOrThrow(restaurantPageSchema, data, 'restaurant list');
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `id` is shaped like a UUID — the only form `/restaurants/{id}` accepts. */
export function isUuid(id: string): boolean {
  return UUID.test(id);
}

/**
 * One restaurant by UUID, or `null` when it does not exist.
 *
 * The backend answers a missing id with **500 NoSuchElementException** rather
 * than 404, so a 500 on a well-formed UUID is read as not-found. A genuine
 * server fault on a valid id is indistinguishable from a missing record at
 * this layer — the trade is deliberate: showing "restaurant not found" for a
 * transient backend fault is less harmful than showing a retrying error
 * screen for every dead link, and the retry policy in query-client would
 * otherwise spend three round-trips on each one.
 *
 * A 400 (non-UUID id) and a 404 (should the backend ever be fixed) are
 * likewise not-found. Anything else re-throws.
 */
export async function fetchRestaurantById(id: string): Promise<RestaurantOutput | null> {
  // Save the round-trip: a non-UUID can only ever come back 400.
  if (!isUuid(id)) return null;

  try {
    const { data } = await apiClient.get(`/restaurants/${encodeURIComponent(id)}`);
    return parseOrThrow(restaurantOutputSchema, data, 'restaurant');
  } catch (error) {
    if (isApiError(error, 404) || isApiError(error, 400)) return null;
    if (isApiError(error, 500)) return null;
    throw error;
  }
}
