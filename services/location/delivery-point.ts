import type { CartDeliveryAddressInput } from '@/schemas/cart';
import type { LocationCoords } from '@/types/location';
import * as Location from 'expo-location';

/**
 * Picking a delivery point on a map, and turning it into something an order
 * can carry.
 *
 * Pure except for {@link describeCoordinates}, which asks the platform's
 * geocoder — everything else is arithmetic and mapping, so the rules below are
 * unit-tested rather than only observable by dragging a map.
 *
 * ## Why a re-pinned point is NOT saved
 *
 * A point picked at checkout is where THIS order goes, not a new address the
 * customer wants to keep. It is written to the cart as its
 * `deliveryAddress` (see {@link toOrderDeliveryAddress}) and the backend files it
 * on the cart and the orders made from it alone — the customer's saved addresses
 * are never touched, so nudging the pin for one delivery cannot move "Home" or
 * grow the saved list.
 */

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
 * The picked point as the one-off delivery address of the cart (and so of its orders).
 *
 * Coordinates and a readable line, nothing more: no floor, door or building —
 * those belong to an address the customer typed and saved, and a point tapped
 * on a map has none. A blank label falls back to the coordinates so the order
 * never carries an empty dropoff line.
 */
export function toOrderDeliveryAddress(
  coords: LocationCoords,
  addressText: string
): CartDeliveryAddressInput {
  return {
    formattedAddress: addressText.trim() || formatCoordinates(coords),
    coordinates: { latitude: coords.latitude, longitude: coords.longitude },
  };
}
