import type {
  RestaurantAccessibility,
  RestaurantAddress,
  RestaurantOutput,
  RestaurantPolicy,
  WorkingDay,
} from '@/schemas/restaurant';
import { resolveImageUrl } from './image-url';

/**
 * Adapts `RestaurantOutputData` to what the screens actually render.
 *
 * Pure module: no React, no TanStack Query, no imports from `hooks/` or
 * `components/`, so the opening-hours logic below can be unit-tested without a
 * renderer.
 */

export interface RestaurantSummary {
  id: string;
  name: string;
  /** Cuisines joined with " - "; "" when the restaurant lists none. */
  categories: string;
  /** Resolved absolute URL, or undefined when the backend has no logo. */
  logoUrl?: string;
  /**
   * The RAW relative `logoUrl` exactly as the backend sent it. Kept alongside
   * the resolved one because the favorites store persists this value and
   * resolves at render time — a stored absolute URL would bake in whatever
   * `EXPO_PUBLIC_API_URL` was set to when the favorite was saved.
   */
  logoPath?: string;
  /** Resolved from `coverImageUrl`, or undefined when there is no cover. */
  bannerImage?: string;
  /** `null` means unknown — the restaurant published no opening hours. */
  isOpen: boolean | null;
  coordinates?: { latitude: number; longitude: number };
  // Unbacked by the API today — see UNBACKED_FIELDS below.
  rating?: string;
  deliveryTime?: string;
  deliveryFee?: string;
  isFreeDelivery?: boolean;
  discount?: string;
  isNew?: boolean;
  isSponsored?: boolean;
}

export interface RestaurantDetail extends RestaurantSummary {
  address?: RestaurantAddress | null;
  phones: string[];
  email?: string | null;
  days: WorkingDay[];
  accessibility?: RestaurantAccessibility | null;
  policy?: RestaurantPolicy | null;
  // Unbacked by the API today — see UNBACKED_FIELDS below.
  reviewCount?: string;
  minOrder?: string;
  isTopRated?: boolean;
}

/**
 * Fields the UI wants that NO backend field currently supplies. When a ratings or
 * orders service ships, populate them here — every consumer is already optional-safe.
 */
export const UNBACKED_FIELDS = [
  'rating', 'reviewCount', 'deliveryTime', 'deliveryFee', 'isFreeDelivery',
  'minOrder', 'discount', 'isNew', 'isSponsored', 'isTopRated',
] as const;

/** "HH:mm" → minutes since midnight, or null when unparseable. */
function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * JS `Date.getDay()` is 0 = Sunday … 6 = Saturday; the backend's `dayOfWeek` is
 * ISO, 1 = Monday … 7 = Sunday. Sunday is the only day where the two disagree
 * about more than a constant offset, which is why it gets its own test.
 */
function isoDayOfWeek(now: Date): number {
  const jsDay = now.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Whether the restaurant is serving at `now`.
 *
 * Returns `null` for "unknown" rather than guessing: a restaurant with no
 * published hours is not the same as a closed one, and showing "Closed" for
 * missing data would be a lie about the venue.
 */
export function isRestaurantOpen(
  restaurant: Pick<RestaurantOutput, 'days' | 'enabled'>,
  now: Date
): boolean | null {
  // A disabled restaurant is closed no matter what its hours claim.
  if (restaurant.enabled === false) return false;

  const days = restaurant.days ?? [];
  if (days.length === 0) return null;

  const today = isoDayOfWeek(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todaysShifts = days.filter(
    (day) => day.dayOfWeek === today && day.isBusinessDay !== false
  );

  for (const shift of todaysShifts) {
    const open = toMinutes(shift.open);
    const close = toMinutes(shift.close);
    if (open === null || close === null) continue;

    if (close > open) {
      // Same-day shift: open on [open, close).
      if (nowMinutes >= open && nowMinutes < close) return true;
    } else {
      // close <= open crosses midnight, e.g. 22:00 → 02:00. The backend lists
      // such a shift on the day it *starts*, so no lookback is needed.
      if (nowMinutes >= open || nowMinutes < close) return true;
    }
  }

  return false;
}

/**
 * Cuisines are serialized from a Java `Set`, so their order is not stable
 * between fetches. Sorting keeps card text from flickering when the same
 * restaurant is re-fetched.
 */
function toCategories(cuisines: string[]): string {
  return [...cuisines].sort((a, b) => a.localeCompare(b)).join(' - ');
}

function toCoordinates(
  address: RestaurantAddress | null | undefined
): { latitude: number; longitude: number } | undefined {
  const latitude = address?.coordinates?.latitude;
  const longitude = address?.coordinates?.longitude;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  return { latitude, longitude };
}

/**
 * Maps a validated DTO to the card/list shape.
 *
 * `logoUrl` and `bannerImage` come back resolved so no component ever sees a
 * relative path, and stay `undefined` when the backend has no artwork — the
 * placeholder is the component's decision, not the view model's, because
 * substituting one here would hide which restaurants actually have images.
 */
export function toRestaurantSummary(
  restaurant: RestaurantOutput,
  now: Date = new Date()
): RestaurantSummary {
  return {
    id: restaurant.id,
    name: restaurant.name ?? '',
    categories: toCategories(restaurant.cuisines),
    logoUrl: resolveImageUrl(restaurant.logoUrl),
    logoPath: restaurant.logoUrl ?? undefined,
    bannerImage: resolveImageUrl(restaurant.coverImageUrl),
    isOpen: isRestaurantOpen(restaurant, now),
    coordinates: toCoordinates(restaurant.address),
  };
}

/** Everything the summary carries, plus the contact/hours block the detail screens show. */
export function toRestaurantDetail(
  restaurant: RestaurantOutput,
  now: Date = new Date()
): RestaurantDetail {
  return {
    ...toRestaurantSummary(restaurant, now),
    address: restaurant.address,
    phones: restaurant.contact?.phones ?? [],
    email: restaurant.contact?.email,
    days: restaurant.days,
    accessibility: restaurant.accessibility,
    policy: restaurant.policy,
  };
}

const DAY_NAMES = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

/** One row of the timings sheet, in the shape `TimingsModal` already renders. */
export interface TimingRow {
  day: string;
  hours: string;
  isToday: boolean;
  isClosed: boolean;
}

/** "23:00" → "11:00 PM", matching the sheet's existing 12-hour display. */
function formatTime(time: string): string {
  const minutes = toMinutes(time);
  if (minutes === null) return time;
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/**
 * Builds the full week for the timings sheet.
 *
 * Always seven rows, Monday first, so a restaurant that publishes hours for
 * only some days still shows the others as closed rather than omitting them —
 * a missing row reads as an oversight, an explicit "Closed" reads as a fact.
 * A day with two shifts joins them with " && ", matching the existing display.
 */
export function toTimingRows(days: WorkingDay[], now: Date): TimingRow[] {
  const today = isoDayOfWeek(now);

  return DAY_NAMES.map((name, index) => {
    const dayOfWeek = index + 1;
    const isToday = dayOfWeek === today;

    const shifts = days
      .filter(
        (day) =>
          day.dayOfWeek === dayOfWeek &&
          day.isBusinessDay !== false &&
          day.open &&
          day.close
      )
      .map((day) => `${formatTime(day.open!)} - ${formatTime(day.close!)}`);

    return {
      day: isToday ? `${name} (Today)` : name,
      hours: shifts.length > 0 ? shifts.join(' && ') : 'Closed',
      isToday,
      isClosed: shifts.length === 0,
    };
  });
}
