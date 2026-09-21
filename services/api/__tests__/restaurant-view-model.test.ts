import type { RestaurantOutput, WorkingDay } from '@/schemas/restaurant';
import { apiClient } from '@/services/api/client';
import {
  isRestaurantOpen,
  toRestaurantDetail,
  toRestaurantSummary,
  UNBACKED_FIELDS,
} from '@/services/api/restaurant-view-model';

const BASE_URL = 'http://192.168.1.10:8082';
const ORIGINAL_BASE_URL = apiClient.defaults.baseURL;

beforeAll(() => {
  apiClient.defaults.baseURL = BASE_URL;
});

afterAll(() => {
  apiClient.defaults.baseURL = ORIGINAL_BASE_URL;
});

/** A minimal, schema-shaped restaurant; spread over with the bits a test cares about. */
function restaurant(overrides: Partial<RestaurantOutput> = {}): RestaurantOutput {
  return {
    id: '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f',
    code: null,
    name: 'Tacoth',
    establishmentDate: null,
    foundedYear: null,
    cuisines: [],
    dishes: [],
    seatingCapacity: null,
    indoorCapacity: null,
    hasIndoorSeating: null,
    outdoorCapacity: null,
    hasOutdoorSeating: null,
    accessibility: null,
    policy: null,
    address: null,
    contact: null,
    logoUrl: null,
    coverImageUrl: null,
    days: [],
    enabled: null,
    ...overrides,
  };
}

function shift(
  dayOfWeek: number,
  open: string | null,
  close: string | null,
  isBusinessDay = true
): WorkingDay {
  return { dayOfWeek, isBusinessDay, open, close };
}

/** Local time, so it matches getDay()/getHours() inside isRestaurantOpen. */
function at(year: number, month: number, day: number, hh: number, mm: number): Date {
  return new Date(year, month - 1, day, hh, mm, 0, 0);
}

// 2026-08-24 is a Monday, so 2026-08-24..30 walks Monday (ISO 1) → Sunday (ISO 7).
const MONDAY = (hh: number, mm: number) => at(2026, 8, 24, hh, mm);
const TUESDAY = (hh: number, mm: number) => at(2026, 8, 25, hh, mm);
const SUNDAY = (hh: number, mm: number) => at(2026, 8, 30, hh, mm);

describe('isRestaurantOpen — the calendar', () => {
  it('sanity-checks the fixtures: Monday is ISO 1 and Sunday is ISO 7', () => {
    expect(MONDAY(12, 0).getDay()).toBe(1);
    expect(SUNDAY(12, 0).getDay()).toBe(0);
  });

  it('returns null when there are no days at all — unknown, not closed', () => {
    expect(isRestaurantOpen(restaurant({ days: [] }), MONDAY(12, 0))).toBeNull();
  });

  it('is closed on a day the restaurant does not trade', () => {
    const r = restaurant({ days: [shift(2, '11:00', '23:00')] });
    expect(isRestaurantOpen(r, MONDAY(12, 0))).toBe(false);
  });

  it('is closed when the matching day is flagged isBusinessDay: false', () => {
    const r = restaurant({ days: [shift(1, '11:00', '23:00', false)] });
    expect(isRestaurantOpen(r, MONDAY(12, 0))).toBe(false);
  });

  it('converts Sunday correctly — getDay() 0 must map to dayOfWeek 7', () => {
    const openSunday = restaurant({ days: [shift(7, '11:00', '23:00')] });
    expect(isRestaurantOpen(openSunday, SUNDAY(12, 0))).toBe(true);

    // The off-by-one this test exists to catch: reading Sunday as dayOfWeek 0
    // or 1 would make a Monday-only restaurant look open on Sunday.
    const openMondayOnly = restaurant({ days: [shift(1, '11:00', '23:00')] });
    expect(isRestaurantOpen(openMondayOnly, SUNDAY(12, 0))).toBe(false);
  });
});

describe('isRestaurantOpen — shift boundaries', () => {
  const r = restaurant({ days: [shift(1, '11:00', '23:00')] });

  it('is closed before opening', () => {
    expect(isRestaurantOpen(r, MONDAY(10, 59))).toBe(false);
  });

  it('is open exactly at the opening minute', () => {
    expect(isRestaurantOpen(r, MONDAY(11, 0))).toBe(true);
  });

  it('is open inside the shift', () => {
    expect(isRestaurantOpen(r, MONDAY(15, 30))).toBe(true);
  });

  it('is closed exactly at the closing minute — the interval is half-open', () => {
    expect(isRestaurantOpen(r, MONDAY(23, 0))).toBe(false);
  });

  it('is closed after the shift', () => {
    expect(isRestaurantOpen(r, MONDAY(23, 30))).toBe(false);
  });
});

describe('isRestaurantOpen — multiple shifts on one day', () => {
  const r = restaurant({
    days: [shift(2, '00:00', '06:00'), shift(2, '11:00', '23:00')],
  });

  it('matches the second shift when the first does not', () => {
    expect(isRestaurantOpen(r, TUESDAY(12, 0))).toBe(true);
  });

  it('matches the first shift when the second does not', () => {
    expect(isRestaurantOpen(r, TUESDAY(2, 0))).toBe(true);
  });

  it('is closed in the gap between the two shifts', () => {
    expect(isRestaurantOpen(r, TUESDAY(8, 0))).toBe(false);
  });
});

describe('isRestaurantOpen — shifts crossing midnight', () => {
  // 22:00 → 06:00: close <= open, so the interval wraps past midnight.
  const r = restaurant({ days: [shift(1, '22:00', '06:00')] });

  it('is open late in the evening, after the opening time', () => {
    expect(isRestaurantOpen(r, MONDAY(23, 30))).toBe(true);
  });

  it('is open in the small hours, before the wrapped closing time', () => {
    expect(isRestaurantOpen(r, MONDAY(2, 0))).toBe(true);
  });

  it('is closed in the middle of the day, outside the wrapped interval', () => {
    expect(isRestaurantOpen(r, MONDAY(12, 0))).toBe(false);
  });

  it('is closed exactly at the wrapped closing minute', () => {
    expect(isRestaurantOpen(r, MONDAY(6, 0))).toBe(false);
  });

  it('is open exactly at the wrapped opening minute', () => {
    expect(isRestaurantOpen(r, MONDAY(22, 0))).toBe(true);
  });
});

describe('isRestaurantOpen — precedence and malformed data', () => {
  it('lets enabled: false beat an otherwise open shift', () => {
    const r = restaurant({ enabled: false, days: [shift(1, '00:00', '23:59')] });
    expect(isRestaurantOpen(r, MONDAY(12, 0))).toBe(false);
  });

  it('skips shifts with missing times instead of throwing', () => {
    const r = restaurant({ days: [shift(1, null, null), shift(1, '11:00', '23:00')] });
    expect(isRestaurantOpen(r, MONDAY(12, 0))).toBe(true);
    expect(isRestaurantOpen(r, MONDAY(8, 0))).toBe(false);
  });

  it('skips shifts whose times are not "HH:mm"', () => {
    const r = restaurant({ days: [shift(1, '11 AM', 'later')] });
    expect(isRestaurantOpen(r, MONDAY(12, 0))).toBe(false);
  });
});

describe('toRestaurantSummary', () => {
  it('joins cuisines with " - " in a stable, sorted order', () => {
    const unsorted = toRestaurantSummary(
      restaurant({ cuisines: ['Pizza', 'Burgers', 'Sandwiches'] }),
      MONDAY(12, 0)
    );
    const otherOrder = toRestaurantSummary(
      restaurant({ cuisines: ['Sandwiches', 'Pizza', 'Burgers'] }),
      MONDAY(12, 0)
    );
    expect(unsorted.categories).toBe('Burgers - Pizza - Sandwiches');
    expect(otherOrder.categories).toBe(unsorted.categories);
  });

  it('gives an empty string for categories when there are no cuisines', () => {
    expect(toRestaurantSummary(restaurant(), MONDAY(12, 0)).categories).toBe('');
  });

  it('resolves coverImageUrl onto bannerImage', () => {
    const summary = toRestaurantSummary(
      restaurant({ coverImageUrl: '/files/restaurants/abc/cover-banner.jpg' }),
      MONDAY(12, 0)
    );
    expect(summary.bannerImage).toBe(`${BASE_URL}/files/restaurants/abc/cover-banner.jpg`);
  });

  it('leaves bannerImage undefined when there is no coverImageUrl', () => {
    expect(toRestaurantSummary(restaurant(), MONDAY(12, 0)).bannerImage).toBeUndefined();
  });

  it('resolves logoUrl, and leaves it undefined when the backend has none', () => {
    expect(
      toRestaurantSummary(restaurant({ logoUrl: '/files/restaurants/abc/logo.png' }), MONDAY(12, 0))
        .logoUrl
    ).toBe(`${BASE_URL}/files/restaurants/abc/logo.png`);
    expect(toRestaurantSummary(restaurant(), MONDAY(12, 0)).logoUrl).toBeUndefined();
  });

  it('maps coordinates only when both latitude and longitude are numbers', () => {
    const withCoords = toRestaurantSummary(
      restaurant({ address: { coordinates: { latitude: 35.8245, longitude: 10.6346 } } }),
      MONDAY(12, 0)
    );
    expect(withCoords.coordinates).toEqual({ latitude: 35.8245, longitude: 10.6346 });

    const partial = toRestaurantSummary(
      restaurant({ address: { coordinates: { latitude: 35.8245, longitude: null } } }),
      MONDAY(12, 0)
    );
    expect(partial.coordinates).toBeUndefined();
  });

  it('leaves every unbacked field absent rather than an empty string', () => {
    const summary = toRestaurantSummary(restaurant(), MONDAY(12, 0));
    for (const field of UNBACKED_FIELDS) {
      expect(summary).not.toHaveProperty(field);
    }
  });

  it('no longer counts bannerImage among the unbacked fields', () => {
    expect(UNBACKED_FIELDS).not.toContain('bannerImage');
  });
});

describe('toRestaurantDetail', () => {
  it('carries contact, hours and policy through, defaulting phones to []', () => {
    const detail = toRestaurantDetail(
      restaurant({
        contact: { phones: ['+21671724000'], email: 'hi@tacoth.tn' },
        days: [shift(1, '11:00', '23:00')],
        accessibility: { wheelchairAccessible: true },
        policy: { petFriendly: false, familyFriendly: true },
        address: { formattedAddress: 'Avenue 14 Janvier, Sousse' },
      }),
      MONDAY(12, 0)
    );
    expect(detail.phones).toEqual(['+21671724000']);
    expect(detail.email).toBe('hi@tacoth.tn');
    expect(detail.days).toHaveLength(1);
    expect(detail.accessibility?.wheelchairAccessible).toBe(true);
    expect(detail.policy?.familyFriendly).toBe(true);
    expect(detail.address?.formattedAddress).toBe('Avenue 14 Janvier, Sousse');
    expect(detail.isOpen).toBe(true);

    expect(toRestaurantDetail(restaurant(), MONDAY(12, 0)).phones).toEqual([]);
  });
});
