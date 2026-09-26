import type { DeliveryStatus, DriverLocation } from '@/schemas/delivery';

/**
 * The live-tracking side of an order: which positions to keep, how fresh one
 * is, and when there is anything to track at all.
 *
 * Pure module, like `order-list-view-model.ts`: no React, no network. The
 * positions come from `hooks/use-driver-location.ts` — the snapshot endpoint
 * first, then the STOMP frames of `/topic/orders/{orderId}/driver-location`.
 */

/**
 * The delivery statuses a driver's position is shared in: from the accept
 * (heading to the restaurant) until the drop-off. The backend streams exactly
 * these (`LiveTrackingConfig.TRACKED_STATUSES`).
 */
export const TRACKED_DELIVERY_STATUSES: readonly DeliveryStatus[] = ['ACCEPTED', 'PICKED_UP'];

export function isTrackable(status: DeliveryStatus | null | undefined): boolean {
  return !!status && TRACKED_DELIVERY_STATUSES.includes(status);
}

/**
 * A position older than this is shown as "last seen", not as live. The driver
 * app reports every few seconds and re-sends every 30 s while standing still,
 * so a minute of silence means the reports stopped (app backgrounded — there
 * is no background location yet — or no network), not that the driver is idle.
 */
export const STALE_AFTER_MS = 60_000;

export type LocationFreshness = 'live' | 'stale' | 'none';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** The position in a location, when it carries one (the last frame does not). */
export function coordinatesOf(location: DriverLocation | null | undefined): Coordinates | null {
  if (location?.latitude == null || location.longitude == null) return null;
  return { latitude: location.latitude, longitude: location.longitude };
}

function capturedAtMs(location: DriverLocation): number {
  const ms = new Date(location.capturedAt).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * The location to keep when a frame arrives.
 *
 * Frames can arrive out of order across a reconnect, or behind a snapshot read
 * that raced them — an older one never replaces a newer one. The frame that
 * ends the delivery (no coordinates) always wins: after it there is nothing
 * left to show as live.
 */
export function mergeDriverLocation(
  current: DriverLocation | null | undefined,
  incoming: DriverLocation
): DriverLocation {
  if (!current) return incoming;
  if (!coordinatesOf(incoming)) return incoming;
  if (!coordinatesOf(current)) return current;
  return capturedAtMs(incoming) >= capturedAtMs(current) ? incoming : current;
}

/** How much to trust a location, at `now` (device clock, ms since epoch). */
export function locationFreshness(
  location: DriverLocation | null | undefined,
  now: number
): LocationFreshness {
  if (!location || !coordinatesOf(location)) return 'none';
  return now - capturedAtMs(location) > STALE_AFTER_MS ? 'stale' : 'live';
}

/** "just now", "2 min ago", "1 h ago" — for "Last seen …". */
export function formatLastSeen(location: DriverLocation, now: number): string {
  const seconds = Math.max(0, Math.round((now - capturedAtMs(location)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.round(minutes / 60)} h ago`;
}
