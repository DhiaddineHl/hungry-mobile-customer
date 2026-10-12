import { LocationCoords } from '@/types/location';

/**
 * Thin client for the Google Places web API, used by the map screen for
 * search autocomplete. Uses the same key as the native map (verified to have
 * Places + Geocoding enabled). Autocomplete + the follow-up details call are
 * grouped under one session token so Google bills them as a single session.
 */
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const BASE_URL = 'https://maps.googleapis.com/maps/api/place';

export interface PlaceSuggestion {
  placeId: string;
  /** Place name, e.g. "Avenue Habib Bourguiba". */
  primaryText: string;
  /** Context, e.g. "Sousse, Tunisia". */
  secondaryText: string;
  /** Full display string. */
  description: string;
}

/** One token per typing session; pass it to autocomplete and the details call. */
export function newPlacesSessionToken(): string {
  return `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

interface AutocompleteResponse {
  status: string;
  error_message?: string;
  predictions: {
    place_id: string;
    description: string;
    structured_formatting?: { main_text?: string; secondary_text?: string };
  }[];
}

export async function autocompletePlaces(
  input: string,
  options: { sessionToken: string; near?: LocationCoords }
): Promise<PlaceSuggestion[]> {
  if (!API_KEY) throw new Error('Google Maps API key is not configured.');
  const params = new URLSearchParams({
    input,
    key: API_KEY,
    sessiontoken: options.sessionToken,
  });
  // Bias (not restrict) results towards the current map area.
  if (options.near) {
    params.set(
      'locationbias',
      `circle:50000@${options.near.latitude},${options.near.longitude}`
    );
  }
  const response = await fetch(`${BASE_URL}/autocomplete/json?${params}`);
  const data: AutocompleteResponse = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(data.error_message ?? `Places autocomplete failed (${data.status})`);
  }
  return (data.predictions ?? []).map((p) => ({
    placeId: p.place_id,
    description: p.description,
    primaryText: p.structured_formatting?.main_text ?? p.description,
    secondaryText: p.structured_formatting?.secondary_text ?? '',
  }));
}

interface DetailsResponse {
  status: string;
  error_message?: string;
  result?: { geometry?: { location?: { lat: number; lng: number } } };
}

export async function getPlaceLocation(
  placeId: string,
  sessionToken?: string
): Promise<LocationCoords> {
  if (!API_KEY) throw new Error('Google Maps API key is not configured.');
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'geometry/location',
    key: API_KEY,
  });
  if (sessionToken) params.set('sessiontoken', sessionToken);
  const response = await fetch(`${BASE_URL}/details/json?${params}`);
  const data: DetailsResponse = await response.json();
  const location = data.result?.geometry?.location;
  if (data.status !== 'OK' || !location) {
    throw new Error(data.error_message ?? `Place details failed (${data.status})`);
  }
  return { latitude: location.lat, longitude: location.lng };
}
