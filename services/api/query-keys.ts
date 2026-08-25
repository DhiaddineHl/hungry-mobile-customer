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

/**
 * Catalog cache entries, in the same shape as the factories above.
 *
 * Only one leaf: which catalog a restaurant's menu lives in. It is keyed by
 * the RESTAURANT id rather than by a catalog id, because resolving the one
 * from the other is the whole point of the entry (see `fetchMenuScope`) — the
 * caller never has a catalog id to key on.
 */
export const catalogKeys = {
  all: ['catalogs'] as const,
  scopes: () => [...catalogKeys.all, 'scope'] as const,
  scope: (restaurantId: string) => [...catalogKeys.scopes(), restaurantId] as const,
};

/**
 * Product (menu) cache entries, in the same shape as the two factories above.
 *
 * `list` takes the catalog **scope** as well as the params: products are not
 * addressed by restaurant anywhere in the backend, so the scope is the only
 * thing separating one restaurant's menu from another's. Leaving it out of the
 * key would let two restaurants read each other's cached menu.
 */
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (scope: object | null, params: object) =>
    [...productKeys.lists(), scope, params] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  /** Keyed by the product's UUID — the backend resolves by id only, never by code. */
  detail: (id: string) => [...productKeys.details(), id] as const,
  images: () => [...productKeys.all, 'image'] as const,
  /** Artwork is a separate request per product — see `fetchProductImageUrl`. */
  image: (id: string) => [...productKeys.images(), id] as const,
  configurations: () => [...productKeys.all, 'configuration'] as const,
  /**
   * A configurable dish's addon groups, keyed by the CONFIGURATION id rather
   * than the product id: the configuration is what
   * `fetchProductConfiguration` addresses, and keying by product would fetch
   * the same groups again for every dish that shares a configuration.
   */
  configuration: (configurationId: string) =>
    [...productKeys.configurations(), configurationId] as const,
};

/**
 * Cart cache entries, in the same shape as the three factories above.
 *
 * `list` is keyed by the CUSTOMER and `detail` by the cart `code`, not by ids:
 * `Cart` has no restaurant column and the `customerIds` filter answers 500, so
 * the `"hc:<customerId>:<restaurantId>"` code is what actually addresses a cart
 * (see `services/api/cart-view-model.ts`).
 */
export const cartKeys = {
  all: ['carts'] as const,
  lists: () => [...cartKeys.all, 'list'] as const,
  /** Keyed by the backend `Customer.id` UUID — never the Keycloak `sub`. */
  list: (customerId: string) => [...cartKeys.lists(), customerId] as const,
  details: () => [...cartKeys.all, 'detail'] as const,
  /** Keyed by the cart `code`, the only field that identifies a cart by restaurant. */
  detail: (code: string) => [...cartKeys.details(), code] as const,
};

/**
 * Order cache entries, in the same shape as the four factories above.
 *
 * There is deliberately **no `list`**: every filter on `/orders/all` is either
 * a 500 or silently ignored (see `services/api/order-service.ts`), so there is
 * no way to ask for one customer's orders. A `lists()` handle here would be an
 * invalidation target for a query that cannot exist.
 */
export const orderKeys = {
  all: ['orders'] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  /** Keyed by the order's UUID — the backend resolves by id only, never by code. */
  detail: (id: string) => [...orderKeys.details(), id] as const,
};
