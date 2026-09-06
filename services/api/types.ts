/**
 * DTO shapes of the Hungry backend (hungry-backend, Spring Boot).
 * Mirrors delivery.hungry.customer.application.model.* and the shared
 * delivery.hungry.core value objects — keep in sync with the Java side.
 */

export interface Fullname {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}

export interface PersonalContact {
  phones?: string[] | null;
  email?: string | null;
}

export interface GeoCoordinates {
  latitude?: number | null;
  longitude?: number | null;
  altitude?: number | null;
}

/** delivery.hungry.core.application.model.localization.Address */
export interface BackendAddress {
  streetNumber?: string | null;
  streetName?: string | null;
  streetType?: string | null;
  streetDirection?: string | null;
  buildingName?: string | null;
  floor?: number | null;
  state?: string | null;
  municipality?: string | null;
  postalCode?: string | null;
  country?: string | null;
  coordinates?: GeoCoordinates | null;
  plusCode?: string | null;
  geohash?: string | null;
  formattedAddress?: string | null;
}

/** A customer's saved, labeled address ("home", "work", ...). */
export interface CustomerAddress {
  name: string;
  details: BackendAddress;
}

/**
 * CustomerInputData. `code` identifies the customer on updates; it defaults to
 * the Keycloak user id (the token's `sub`) at registration. `password` is only
 * sent at registration — the backend provisions the Keycloak login with it.
 * On update, fields left undefined are kept as-is server-side; `addresses`,
 * when present, replaces the saved list wholesale.
 */
export interface CustomerInput {
  code?: string;
  name?: string;
  fullname?: Fullname;
  contact?: PersonalContact;
  address?: BackendAddress;
  addresses?: CustomerAddress[];
  password?: string;
}

/** CustomerOutputData. */
export interface Customer {
  id: string;
  code?: string | null;
  name?: string | null;
  fullname?: Fullname | null;
  contact?: PersonalContact | null;
  address?: BackendAddress | null;
  addresses?: CustomerAddress[] | null;
  keycloakUserId?: string | null;
}

// ---------------------------------------------------------------------------
// E-mail verification (CustomerVerificationService)
// ---------------------------------------------------------------------------

/**
 * Answer to `POST /customers/verification/send`: everything the code screen
 * needs to draw itself. `codeLength` is authoritative — the backend decides how
 * many digits it generates, so the screen renders that many boxes rather than
 * assuming a number.
 */
export interface VerificationChallenge {
  email: string;
  codeLength: number;
  expiresInSeconds: number;
  /** Seconds the Resend button stays disabled after this send. */
  resendAvailableInSeconds: number;
  /** The address was already confirmed; nothing was sent and the app may move on. */
  alreadyVerified: boolean;
  /** False when the backend has no mail transport (dev) and only logged the code. */
  delivered: boolean;
}

/** Answer to `POST /customers/verification/confirm`. */
export interface VerificationResult {
  email: string;
  keycloakUserId: string;
  verified: boolean;
}

// ---------------------------------------------------------------------------
// Restaurants
//
// These types are INFERRED from the zod schemas in `schemas/restaurant.ts`,
// which is the single source of truth for the restaurant contract — there is
// deliberately no hand-written interface here that could drift from the parser
// that validates the payload at runtime.
// ---------------------------------------------------------------------------

/** The paged envelope is shared with products, so it lives in its own module. */
export type { Page } from '@/schemas/page';

export type {
  BusinessContact,
  RestaurantAccessibility,
  RestaurantAddress,
  RestaurantGeoCoordinates,
  RestaurantOutput,
  RestaurantPolicy,
  WorkingDay,
} from '@/schemas/restaurant';
