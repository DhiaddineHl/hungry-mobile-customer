import { pageSchema } from '@/schemas/page';
import { restaurantOutputSchema } from '@/schemas/restaurant';
import { z } from 'zod';

const FULL_PAYLOAD = {
  id: '8f3c1c2e-2f1a-4a1b-9d0e-1c2b3a4d5e6f',
  code: 'TACOTH',
  name: 'Tacoth',
  establishmentDate: '2019-04-01',
  foundedYear: 2019,
  cuisines: ['French Tacos', 'Fast Food'],
  dishes: ['Tacos', 'Bowls'],
  seatingCapacity: 60,
  indoorCapacity: 40,
  hasIndoorSeating: true,
  outdoorCapacity: 20,
  hasOutdoorSeating: true,
  accessibility: { wheelchairAccessible: true },
  policy: { petFriendly: false, familyFriendly: true },
  address: {
    streetNumber: '12',
    streetName: '14 Janvier',
    streetType: 'AVENUE',
    streetDirection: null,
    buildingName: null,
    floor: null,
    state: 'Sousse',
    municipality: 'Sousse',
    postalCode: '4000',
    country: 'Tunisia',
    coordinates: { latitude: 35.8245, longitude: 10.6346, altitude: null },
    plusCode: 'RJW9+VMG',
    geohash: 'sn0h',
    formattedAddress: 'RJW9+VMG, Avenue 14 Janvier, Sousse, Tunisia',
  },
  contact: { phones: ['+21671724000'], email: 'contact@tacoth.tn' },
  logoUrl: '/files/restaurants/8f3c1c2e/logo.png',
  coverImageUrl: '/files/restaurants/8f3c1c2e/cover-banner.jpg',
  days: [
    { dayOfWeek: 1, isBusinessDay: true, open: '11:00', close: '23:00' },
    { dayOfWeek: 7, isBusinessDay: false, open: null, close: null },
  ],
  enabled: true,
};

describe('restaurantOutputSchema', () => {
  it('parses a full payload', () => {
    const parsed = restaurantOutputSchema.parse(FULL_PAYLOAD);
    expect(parsed.name).toBe('Tacoth');
    expect(parsed.cuisines).toEqual(['French Tacos', 'Fast Food']);
    expect(parsed.address?.coordinates?.latitude).toBe(35.8245);
    expect(parsed.contact?.phones).toEqual(['+21671724000']);
    expect(parsed.days).toHaveLength(2);
  });

  it('parses a payload carrying nothing but an id, defaulting collections to []', () => {
    const parsed = restaurantOutputSchema.parse({ id: 'abc' });
    expect(parsed.id).toBe('abc');
    expect(parsed.cuisines).toEqual([]);
    expect(parsed.dishes).toEqual([]);
    expect(parsed.days).toEqual([]);
  });

  it('turns null collections into empty arrays', () => {
    const parsed = restaurantOutputSchema.parse({
      id: 'abc',
      cuisines: null,
      dishes: null,
      days: null,
      contact: { phones: null, email: null },
    });
    expect(parsed.cuisines).toEqual([]);
    expect(parsed.dishes).toEqual([]);
    expect(parsed.days).toEqual([]);
    expect(parsed.contact?.phones).toEqual([]);
  });

  it('rejects a payload with no id, naming id in the issue path', () => {
    const result = restaurantOutputSchema.safeParse({ name: 'Tacoth' });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.some((issue) => issue.path.join('.') === 'id')).toBe(true);
  });
});

describe('pageSchema', () => {
  it('models only the five fields the client uses and ignores the rest of the envelope', () => {
    const parsed = pageSchema(restaurantOutputSchema).parse({
      content: [FULL_PAYLOAD],
      number: 0,
      totalPages: 1,
      totalElements: 1,
      last: true,
      size: 10,
      first: true,
      numberOfElements: 1,
      empty: false,
      sort: { sorted: false },
      pageable: { pageNumber: 0 },
    });
    expect(parsed.content).toHaveLength(1);
    expect(parsed.totalElements).toBe(1);
    expect(parsed).not.toHaveProperty('pageable');
  });

  it('propagates an item parse failure instead of silently dropping the item', () => {
    const result = pageSchema(restaurantOutputSchema).safeParse({
      content: [{ name: 'no id here' }],
      number: 0,
      totalPages: 1,
      totalElements: 1,
      last: true,
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0].path.join('.')).toBe('content.0.id');
  });

  it('accepts any item schema', () => {
    const parsed = pageSchema(z.string()).parse({ content: ['a', 'b'], last: true });
    expect(parsed.content).toEqual(['a', 'b']);
  });
});
