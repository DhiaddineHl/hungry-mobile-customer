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
