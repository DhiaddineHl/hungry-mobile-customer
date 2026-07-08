import { AddressData } from '@/types/location';
import { apiClient } from './client';
import { Customer, CustomerAddress, CustomerInput } from './types';

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
