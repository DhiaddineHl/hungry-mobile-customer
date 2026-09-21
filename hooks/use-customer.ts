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
 * Resolves the customer record for the logged-in account into the cache, and
 * answers `null` when the backend has none.
 *
 * It deliberately does NOT create one. Accounts created by in-app signup
 * always have a record (the backend writes both in a single transaction), so
 * `null` means exactly one thing: a Keycloak-provisioned account — a Google
 * sign-in — that has never been through a profile form. The router turns that
 * `null` into the profile-completion screen, which is the only place the
 * record is created, once there is a name and a phone number to put in it.
 *
 * Creating an empty record here instead (as this used to) would satisfy the
 * "has a record" test with a nameless, phoneless customer and there would be
 * no later moment at which to ask for those details.
 */
export async function resolveCustomerForAccount(
  queryClient: QueryClient,
  keycloakUserId: string
): Promise<Customer | null> {
  return queryClient.fetchQuery(customerQueryOptions(keycloakUserId));
}

/**
 * Creates the customer record behind a social login, with the details the
 * profile-completion screen collected (Google supplies the name; the phone
 * number is never in an OIDC token, so it is always asked for).
 *
 * `POST /customers/me` rather than `POST /customers`: the Keycloak account
 * already exists — Keycloak made it while brokering to Google — and the
 * unauthenticated endpoint would answer 409 because it always provisions a
 * new one. See `createCustomerForAccount`.
 */
export function useCompleteSocialProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      firstName,
      lastName,
      email,
      phoneNumber,
    }: {
      firstName: string;
      lastName: string;
      email?: string;
      phoneNumber: string;
    }) =>
      createCustomerForAccount({
        name: `${firstName} ${lastName}`.trim(),
        fullname: { firstName, lastName },
        contact: { email, phones: [phoneNumber] },
      }),
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
