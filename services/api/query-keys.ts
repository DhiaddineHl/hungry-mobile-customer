/**
 * Central query-key factory (see .agents/skills/tanstack-query-best-practices,
 * rules qk-factory-pattern / qk-hierarchical-organization). All customer
 * cache entries live under the 'customers' root so one invalidation of
 * `customerKeys.all` reaches every derived key.
 */
export const customerKeys = {
  all: ['customers'] as const,
  details: () => [...customerKeys.all, 'detail'] as const,
  /** Keyed by the Keycloak account id (the token's `sub`). */
  detail: (keycloakUserId: string) => [...customerKeys.details(), keycloakUserId] as const,
};

/**
 * Restaurant cache entries. Same shape as `customerKeys` so there is one
 * factory pattern in this codebase: `lists()` and `details()` are the
 * invalidation handles, `list(params)` and `detail(id)` the leaves.
 */
export const restaurantKeys = {
  all: ['restaurants'] as const,
  lists: () => [...restaurantKeys.all, 'list'] as const,
  /** Keyed by the query params so a filtered page never reads a plain page's cache. */
  list: (params: object) => [...restaurantKeys.lists(), params] as const,
  details: () => [...restaurantKeys.all, 'detail'] as const,
  /** Keyed by the restaurant's UUID — the backend resolves by id only, never by code. */
  detail: (id: string) => [...restaurantKeys.details(), id] as const,
};
