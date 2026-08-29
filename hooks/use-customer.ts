import { isApiError } from '@/services/api/client';
import {
  createCustomerForAccount,
  CustomerRegistration,
  getCustomerByAccount,
  registerCustomer,
  toCustomerAddress,
  updateCustomer,
} from '@/services/api/customer-service';
import { customerKeys } from '@/services/api/query-keys';
import { Customer, CustomerInput } from '@/services/api/types';
import { useCustomerStore } from '@/store/customer-store';
import { AddressData } from '@/types/location';
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Shared query options for the customer-by-account fetch. Colocated so both
 * the `useCustomer` hook and imperative prefetches (e.g. warming the cache
 * right after login in the auth context) resolve to the exact same cache
 * entry and 404-as-null behaviour.
 */
export function customerQueryOptions(keycloakUserId: string | null | undefined) {
  return {
    queryKey: customerKeys.detail(keycloakUserId ?? ''),
    queryFn: async (): Promise<Customer | null> => {
      try {
        return await getCustomerByAccount(keycloakUserId!);
      } catch (error) {
        if (isApiError(error, 404)) return null;
        throw error;
      }
    },
    enabled: !!keycloakUserId,
    // Profile data rarely changes outside this device's own mutations.
    staleTime: 5 * 60 * 1000,
  };
}

/**
 * Guarantees the logged-in account has a customer record, and seeds the cache
 * with it.
 *
 * Accounts created by in-app signup already have one (the backend writes both
 * in a single transaction). Accounts created by Keycloak itself — a Google
 * sign-in, brokered by Keycloak — do not: nothing ever called `POST
 * /customers` for them, and it would answer 409 if it did, because that
 * endpoint always provisions a new Keycloak user. `POST /customers/me` fills
 * that gap and is idempotent, so this is safe to run after every login and
 * session restore, including for accounts that predate it.
 */
export async function ensureCustomerForAccount(
  queryClient: QueryClient,
  keycloakUserId: string
): Promise<Customer | null> {
  const existing = await queryClient.fetchQuery(customerQueryOptions(keycloakUserId));
  if (existing) return existing;

  const created = await createCustomerForAccount();
  queryClient.setQueryData(customerKeys.detail(keycloakUserId), created);
  return created;
}

/**
 * The customer record linked to a Keycloak account (`sub`). Returns `null`
 * data (instead of erroring) when the backend has no record for the account,
 * e.g. one created via Google sign-in before this sync existed.
 */
export function useCustomer(keycloakUserId: string | null | undefined) {
  return useQuery(customerQueryOptions(keycloakUserId));
}

/**
 * Self-registration: one backend call creates the Keycloak login and the
 * Customer entity atomically. On success the account ids are persisted to
 * the customer store so the pre-login onboarding (address screen) can
 * address the record, and the detail cache is seeded with the response.
 */
export function useRegisterCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (registration: CustomerRegistration) => registerCustomer(registration),
    onSuccess: (customer) => {
      if (customer.keycloakUserId) {
        useCustomerStore.getState().setAccount({
          keycloakUserId: customer.keycloakUserId,
          customerId: customer.id,
        });
        queryClient.setQueryData(customerKeys.detail(customer.keycloakUserId), customer);
      }
    },
  });
}

/** Generic partial update of the customer record (resolved by `code`). */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInput) => updateCustomer(input),
    onSuccess: (customer) => {
      if (customer.keycloakUserId) {
        queryClient.setQueryData(customerKeys.detail(customer.keycloakUserId), customer);
      }
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}

/**
 * Upserts a batch of labeled addresses into the customer's saved list. The
 * backend replaces the `addresses` list wholesale on update, so the current
 * list is fetched first and entries with the same label are replaced. The
 * entry at `defaultIndex` also becomes the customer's top-level `address`,
 * which is how the backend models the default delivery address.
 */
export function useSaveAddresses() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      keycloakUserId,
      addresses,
      defaultIndex = 0,
    }: {
      keycloakUserId: string;
      addresses: AddressData[];
      defaultIndex?: number;
    }) => {
      const current = await queryClient.fetchQuery({
        queryKey: customerKeys.detail(keycloakUserId),
        queryFn: () => getCustomerByAccount(keycloakUserId),
        staleTime: 0,
      });
      const entries = addresses.map(toCustomerAddress);
      const names = new Set(entries.map((e) => e.name));
      const others = (current.addresses ?? []).filter((a) => !names.has(a.name));
      const defaultEntry = entries[defaultIndex] ?? entries[0];
      return updateCustomer({
        code: current.code ?? keycloakUserId,
        addresses: [...others, ...entries],
        address: defaultEntry?.details,
      });
    },
    onSuccess: (customer, { keycloakUserId }) => {
      queryClient.setQueryData(customerKeys.detail(keycloakUserId), customer);
      queryClient.invalidateQueries({ queryKey: customerKeys.all });
    },
  });
}
