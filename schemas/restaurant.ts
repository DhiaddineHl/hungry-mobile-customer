import { z } from 'zod';

/**
 * Runtime shape of the Hungry backend's restaurant payloads
 * (delivery.hungry.restaurant.application.model.RestaurantOutputData).
 *
 * Nothing in the backend's OpenAPI document is marked `required`, so every
 * field here is nullish — an interface-only model would let the compiler bless
 * accesses the payload never guarantees. Parsing at the network boundary turns
 * a backend shape change into one reported error instead of an `undefined`
 * crash deep in a component.
 *
 * Collections use `.catch([])` rather than `.nullish()`: a null or absent
 * `cuisines` resolves to an empty array so no caller has to optional-chain
 * before iterating.
 */

export const geoCoordinatesSchema = z.object({
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  altitude: z.number().nullish(),
});

/** delivery.hungry.core.application.model.localization.Address */
export const backendAddressSchema = z.object({
  streetNumber: z.string().nullish(),
  streetName: z.string().nullish(),
  streetType: z.string().nullish(),
  streetDirection: z.string().nullish(),
  buildingName: z.string().nullish(),
  floor: z.number().nullish(),
  state: z.string().nullish(),
  municipality: z.string().nullish(),
  postalCode: z.string().nullish(),
  country: z.string().nullish(),
  coordinates: geoCoordinatesSchema.nullish(),
  plusCode: z.string().nullish(),
  geohash: z.string().nullish(),
  formattedAddress: z.string().nullish(),
});

export const businessContactSchema = z.object({
  phones: z.array(z.string()).catch([]),
  email: z.string().nullish(),
});

/**
 * One shift. `dayOfWeek` is **ISO** — 1 = Monday … 7 = Sunday — which is not
 * JavaScript's `Date.getDay()` numbering; see `isRestaurantOpen`. A day with
 * two shifts arrives as two entries sharing the same `dayOfWeek`.
 */
export const workingDaySchema = z.object({
  dayOfWeek: z.number().nullish(),
  isBusinessDay: z.boolean().nullish(),
  /** "HH:mm" */
  open: z.string().nullish(),
  /** "HH:mm" */
  close: z.string().nullish(),
});

export const accessibilitySchema = z.object({
  wheelchairAccessible: z.boolean().nullish(),
});

export const policySchema = z.object({
  petFriendly: z.boolean().nullish(),
  familyFriendly: z.boolean().nullish(),
});

export const restaurantOutputSchema = z.object({
  id: z.string(),
  code: z.string().nullish(),
  name: z.string().nullish(),
  /** ISO date, e.g. "2019-04-01". */
  establishmentDate: z.string().nullish(),
  foundedYear: z.number().nullish(),
  /** Java `Set` — iteration order is not stable, so sort before displaying. */
  cuisines: z.array(z.string()).catch([]),
  dishes: z.array(z.string()).catch([]),
  seatingCapacity: z.number().nullish(),
  indoorCapacity: z.number().nullish(),
  hasIndoorSeating: z.boolean().nullish(),
  outdoorCapacity: z.number().nullish(),
  hasOutdoorSeating: z.boolean().nullish(),
  accessibility: accessibilitySchema.nullish(),
  policy: policySchema.nullish(),
  address: backendAddressSchema.nullish(),
  contact: businessContactSchema.nullish(),
  /** Relative `/files/...` path behind bearer auth — see services/api/image-url.ts. */
  logoUrl: z.string().nullish(),
  /** Relative `/files/...` path behind bearer auth — see services/api/image-url.ts. */
  coverImageUrl: z.string().nullish(),
  days: z.array(workingDaySchema).catch([]),
  enabled: z.boolean().nullish(),
  /**
   * The catalog a restaurant's menu lives in. NEITHER field is served today —
   * the backend has no link at all between a restaurant and its products (see
   * docs/plans/restaurant-products-fetch-display-plan.md §2). They are modelled
   * ahead of the §2.1 backend change so `menuScopeOf` starts returning a real
   * scope the moment the field appears, with no schema edit.
   */
  catalogId: z.string().nullish(),
  catalogVersionId: z.string().nullish(),
});

export type RestaurantGeoCoordinates = z.infer<typeof geoCoordinatesSchema>;
export type RestaurantAddress = z.infer<typeof backendAddressSchema>;
export type BusinessContact = z.infer<typeof businessContactSchema>;
export type WorkingDay = z.infer<typeof workingDaySchema>;
export type RestaurantAccessibility = z.infer<typeof accessibilitySchema>;
export type RestaurantPolicy = z.infer<typeof policySchema>;
export type RestaurantOutput = z.infer<typeof restaurantOutputSchema>;
