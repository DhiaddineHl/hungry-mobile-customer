import { useAuth } from '@/contexts/auth-context';
import { BackendAddress, Customer, CustomerAddress } from '@/services/api/types';
import { useCustomerStore } from '@/store/customer-store';
import { useDeliveryAddressStore } from '@/store/delivery-address-store';
import { useCustomer } from './use-customer';

/**
 * The signed-in customer record. Reads the Keycloak account id from the auth
 * session, falling back to the id persisted at registration so the record is
 * reachable during the pre-login onboarding gap. Backed by React Query, so the
 * result is shared (and cached) everywhere this hook is used.
 */
export function useCurrentCustomer() {
  const { user } = useAuth();
  const pendingKeycloakUserId = useCustomerStore((s) => s.keycloakUserId);
  const keycloakUserId = user?.sub ?? pendingKeycloakUserId;
  return useCustomer(keycloakUserId);
}

/** Human-facing label for a saved address ("home" → "Home"). */
export function formatAddressName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * The backend has no `isDefault` flag — the default delivery address is the
 * one mirrored onto the customer's top-level `address`. Match a saved entry to
 * it by formatted address, then by coordinates.
 */
function matchesTopLevel(entry: CustomerAddress, top: BackendAddress): boolean {
  if (top.formattedAddress && entry.details.formattedAddress) {
    return entry.details.formattedAddress === top.formattedAddress;
  }
  const ec = entry.details.coordinates;
  const tc = top.coordinates;
  if (ec && tc) {
    return ec.latitude === tc.latitude && ec.longitude === tc.longitude;
  }
  return false;
}

/**
 * Resolves which saved address is active: the explicitly selected one, else
 * the customer's default (top-level `address`), else the first saved entry.
 */
function resolveSelected(
  customer: Customer | null | undefined,
  selectedName: string | null
): CustomerAddress | null {
  const list = customer?.addresses ?? [];
  if (list.length === 0) return null;
  if (selectedName) {
    const hit = list.find((a) => a.name === selectedName);
    if (hit) return hit;
  }
  if (customer?.address) {
    const def = list.find((a) => matchesTopLevel(a, customer.address!));
    if (def) return def;
  }
  return list[0];
}

/**
 * The active delivery address plus the full saved list and a setter — the
 * single source the header, popover, and checkout should read from.
 */
export function useDeliveryAddress() {
  const { data: customer, isLoading } = useCurrentCustomer();
  const selectedName = useDeliveryAddressStore((s) => s.selectedName);
  const select = useDeliveryAddressStore((s) => s.select);

  const addresses = customer?.addresses ?? [];
  const selected = resolveSelected(customer, selectedName);

  return {
    customer,
    isLoading,
    addresses,
    selected,
    selectedName: selected?.name ?? null,
    select,
  };
}
