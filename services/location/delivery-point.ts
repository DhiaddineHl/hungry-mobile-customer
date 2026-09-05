import type { AddressData, LocationCoords } from '@/types/location';
import * as Location from 'expo-location';

/**
 * Picking a delivery point on a map, and turning it into something the
 * customer record can hold.
 *
 * Pure except for {@link describeCoordinates}, which asks the platform's
 * geocoder — everything else is arithmetic and mapping, so the rules below are
 * unit-tested rather than only observable by dragging a map.
 *
 * ## Why a re-pinned point is SAVED at all
 *
 * `OrderInput` carries no address (see `services/api/order-view-model.ts`): the
 * backend delivers to whatever sits on the customer's top-level `address`, and
 * dereferences its coordinates without a null guard. A point picked at
 * checkout therefore has to reach the customer record to mean anything — there
 * is no per-order address field to put it in.
 *
 * It is written to a DEDICATED entry ({@link CUSTOM_ADDRESS_NAME}) rather than
 * over the selected one: nudging the pin at checkout must not silently move
 * the customer's saved "Home". The entry is reused on every re-pin, so this
 * grows the saved list by one at most.
 */

/**
 * The name the checkout's re-pinned address is filed under.
 *
 * Deliberately the same name every time: a customer who re-pins on three
 * orders should end up with one extra address, not three.
 */
export const CUSTOM_ADDRESS_NAME = 'custom';

/**
 * How far the map has to settle from the saved point before it counts as a
 * different one.
 *
 * A map never returns the exact centre it was handed — the camera lands within
 * a few metres of it — so a zero tolerance would offer to "save" a point the
 * customer never moved. 20 m is inside one building and well under what a
 * driver could act on.
 */
export const SAME_POINT_TOLERANCE_METERS = 20;

/** Metres per degree of latitude; near enough constant everywhere. */
const METERS_PER_DEGREE = 111_320;

/** "35.8256, 10.6369" — the honest label for a point with no known name. */
export function formatCoordinates(coords: LocationCoords): string {
  return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
}

/**
 * Approximate metres between two points.
 *
 * Equirectangular, not haversine: the comparisons here are over tens of metres
 * on one map screen, where the flat-earth error is millimetres, and the
 * longitude term is scaled by `cos(latitude)` so the approximation does not
 * drift away from the equator.
 */
export function distanceBetween(a: LocationCoords, b: LocationCoords): number {
  const midLatitude = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const dLat = (a.latitude - b.latitude) * METERS_PER_DEGREE;
  const dLng = (a.longitude - b.longitude) * METERS_PER_DEGREE * Math.cos(midLatitude);
  return Math.hypot(dLat, dLng);
}

/**
 * Whether these are different delivery points.
 *
 * Two absent points are the same absence; one absent point is a change. A
 * non-finite coordinate is treated as absent rather than compared — `NaN`
 * comparisons would answer "same" and quietly keep an unusable point.
 */
export function coordinatesDiffer(
  a: LocationCoords | null | undefined,
  b: LocationCoords | null | undefined,
  toleranceMeters: number = SAME_POINT_TOLERANCE_METERS
): boolean {
  const first = isUsable(a) ? a : null;
  const second = isUsable(b) ? b : null;

  if (!first || !second) return first !== second;

  return distanceBetween(first, second) > toleranceMeters;
}

function isUsable(coords: LocationCoords | null | undefined): coords is LocationCoords {
  return (
    !!coords &&
    Number.isFinite(coords.latitude) &&
    Number.isFinite(coords.longitude)
  );
}

/**
 * A short, human label for a point — "Rue de Paris, Sousse, Tunisia".
 *
 * NEVER throws and never resolves to an empty string: a point the geocoder
 * cannot name is still a point the customer picked, so it falls back to its
 * own coordinates. A blank label would read as a failed pick.
 */
export async function describeCoordinates(coords: LocationCoords): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync(coords);
    const place = results[0];
    const parts = place ? [place.name, place.city, place.country].filter(Boolean) : [];
    return parts.length > 0 ? parts.join(', ') : formatCoordinates(coords);
  } catch {
    return formatCoordinates(coords);
  }
}

/**
 * The picked point as an address the customer record can hold.
 *
 * `label: 'custom'` + `customLabel` is what `toCustomerAddress` turns into the
 * entry's `name`, so this lands on {@link CUSTOM_ADDRESS_NAME} and replaces the
 * previous re-pin rather than accumulating.
 *
 * No floor, door or building is set: those belong to an address the customer
 * typed, and inventing blanks for them would overwrite details a saved address
 * already carries.
 */
export function toPickedAddress(coords: LocationCoords, addressText: string): AddressData {
  return {
    coords,
    addressText: addressText.trim() || formatCoordinates(coords),
    addressType: 'other',
    label: 'custom',
    customLabel: CUSTOM_ADDRESS_NAME,
  };
}
