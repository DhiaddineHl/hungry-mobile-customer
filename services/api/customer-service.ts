import { AddressData } from '@/types/location';
import { apiClient } from './client';
import {
  Customer,
  CustomerAddress,
  CustomerInput,
  VerificationChallenge,
  VerificationResult,
} from './types';

export interface CustomerRegistration {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
}

/**
 * Registers a customer: one call, and the backend provisions the Keycloak
 * login account and the Customer entity atomically (same flow as employees
 * in the back-office). Runs unauthenticated — the user has no session yet.
 */
export async function registerCustomer(registration: CustomerRegistration): Promise<Customer> {
  const input: CustomerInput = {
    name: `${registration.firstName} ${registration.lastName}`.trim(),
    fullname: { firstName: registration.firstName, lastName: registration.lastName },
    contact: {
      email: registration.email,
      phones: registration.phoneNumber ? [registration.phoneNumber] : [],
    },
    password: registration.password,
  };
  const { data } = await apiClient.post<Customer>('/customers', input);
  return data;
}

/**
 * Asks the backend to mail a one-time code to a registered address — the first
 * step of the verification gate that sits between sign-up and the address
 * onboarding. Also the "Resend" action.
 *
 * Runs unauthenticated: it happens before the user's first login, so there is
 * no token to send. Rejected with 429 inside the resend cool-down, whose
 * remaining seconds come back in the ProblemDetail.
 */
export async function sendVerificationCode(email: string): Promise<VerificationChallenge> {
  const { data } = await apiClient.post<VerificationChallenge>('/customers/verification/send', {
    email,
  });
  return data;
}

/**
 * Redeems the code. On success the backend flips the Keycloak account's
 * `emailVerified` flag, which is what every later token reports in its
 * `email_verified` claim.
 *
 * Throws ApiError(400) for a wrong code, 410 for an expired one and 429 once
 * the attempts are used up — the screen tells those apart to decide whether to
 * push the user towards "Resend".
 */
export async function confirmVerificationCode(
  email: string,
  code: string
): Promise<VerificationResult> {
  const { data } = await apiClient.post<VerificationResult>('/customers/verification/confirm', {
    email,
    code,
  });
  return data;
}

/**
 * Creates the customer record for the account the current access token belongs
 * to, and returns the existing one if there already is one (the endpoint is
 * idempotent).
 *
 * Social logins never pass through `registerCustomer`: Keycloak provisions the
 * account itself when brokering to Google, so `POST /customers` — which always
 * creates a NEW Keycloak user — answers 409 for them. `POST /customers/me` is
 * the authenticated counterpart: it attaches a record to the identity the token
 * already proves, so no password is sent and the `sub` is never taken from this
 * body. Email and name are read from Keycloak server-side; only the optional
 * extras below are ours to send.
 */
export async function createCustomerForAccount(
  extras: Pick<CustomerInput, 'name' | 'contact'> = {}
): Promise<Customer> {
  const { data } = await apiClient.post<Customer>('/customers/me', extras);
  return data;
}

/**
 * Resolves the customer record linked to a Keycloak account (the access
 * token's `sub` claim). Throws ApiError(404) when no record exists — e.g. an
 * account created through Google sign-in rather than in-app registration.
 */
export async function getCustomerByAccount(keycloakUserId: string): Promise<Customer> {
  const { data } = await apiClient.get<Customer>(
    `/customers/by-account/${encodeURIComponent(keycloakUserId)}`
  );
  return data;
}

/**
 * Partial update: the backend resolves the customer by `code` (= the Keycloak
 * user id for app-registered customers) and only applies the fields present.
 */
export async function updateCustomer(input: CustomerInput): Promise<Customer> {
  const { data } = await apiClient.put<Customer>('/customers', input);
  return data;
}

/**
 * Whether the customer already has somewhere to deliver to — either a saved
 * labeled address or the top-level default one.
 *
 * Presence of the `address` object alone is not enough: a record can carry one
 * whose every field is empty, which is not an address anyone can deliver to.
 * Coordinates or a formatted address is the minimum the map and checkout need.
 */
export function hasDeliveryAddress(customer: Customer | null | undefined): boolean {
  if (!customer) return false;
  if ((customer.addresses?.length ?? 0) > 0) return true;
  const address = customer.address;
  if (!address) return false;
  return !!(address.formattedAddress || address.coordinates);
}

/**
 * Maps the address captured by the onboarding/map screens to the backend's
 * CustomerAddress shape. The label becomes the address name (the customer's
 * identifier for it); door number and free-form notes go into the closest
 * structured slots the backend Address offers.
 */
export function toCustomerAddress(data: AddressData): CustomerAddress {
  const name =
    data.label === 'custom' ? data.customLabel?.trim() || 'other' : data.label;
  const floor = data.floorNumber ? parseInt(data.floorNumber, 10) : NaN;
  return {
    name,
    details: {
      streetNumber: data.doorNumber || undefined,
      buildingName: data.additionalInfo || undefined,
      floor: Number.isFinite(floor) ? floor : undefined,
      coordinates: {
        latitude: data.coords.latitude,
        longitude: data.coords.longitude,
      },
      formattedAddress: data.addressText || undefined,
    },
  };
}
