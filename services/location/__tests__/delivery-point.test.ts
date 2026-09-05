import {
  CUSTOM_ADDRESS_NAME,
  coordinatesDiffer,
  describeCoordinates,
  distanceBetween,
  formatCoordinates,
  toPickedAddress,
} from '@/services/location/delivery-point';
import { toCustomerAddress } from '@/services/api/customer-service';
import * as Location from 'expo-location';

jest.mock('expo-location', () => ({ reverseGeocodeAsync: jest.fn() }));

const mockedReverseGeocode = Location.reverseGeocodeAsync as jest.MockedFunction<
  typeof Location.reverseGeocodeAsync
>;

const SOUSSE = { latitude: 35.8256, longitude: 10.6369 };

/** Metres north of a point, as degrees of latitude. */
function metresNorth(from: { latitude: number; longitude: number }, metres: number) {
  return { ...from, latitude: from.latitude + metres / 111_320 };
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('formatCoordinates', () => {
  it('renders four decimals — roughly ten metres, which is what a pin is worth', () => {
    expect(formatCoordinates(SOUSSE)).toBe('35.8256, 10.6369');
  });

  it('keeps the sign of southern and western points', () => {
    expect(formatCoordinates({ latitude: -33.8688, longitude: -70.6693 })).toBe(
      '-33.8688, -70.6693'
    );
  });
});

describe('distanceBetween', () => {
  it('is zero for the same point', () => {
    expect(distanceBetween(SOUSSE, SOUSSE)).toBe(0);
  });

  it('measures a north-south offset in metres', () => {
    expect(distanceBetween(SOUSSE, metresNorth(SOUSSE, 100))).toBeCloseTo(100, 0);
  });

  it('scales longitude by the latitude — a degree of longitude is shorter away from the equator', () => {
    const eastOfSousse = { ...SOUSSE, longitude: SOUSSE.longitude + 0.001 };
    const eastOfEquator = { latitude: 0, longitude: 0.001 };

    const atSousse = distanceBetween(SOUSSE, eastOfSousse);
    const atEquator = distanceBetween({ latitude: 0, longitude: 0 }, eastOfEquator);

    // cos(35.8°) ≈ 0.81, so the same degree covers noticeably less ground.
    expect(atSousse).toBeLessThan(atEquator);
    expect(atSousse / atEquator).toBeCloseTo(Math.cos((35.8256 * Math.PI) / 180), 2);
  });
});

describe('coordinatesDiffer', () => {
  it('reads the same point as unchanged', () => {
    expect(coordinatesDiffer(SOUSSE, SOUSSE)).toBe(false);
  });

  it('absorbs the few metres a map camera lands off its target', () => {
    // Without this the card would offer to "save" a point nobody moved, on
    // every single settle.
    expect(coordinatesDiffer(SOUSSE, metresNorth(SOUSSE, 5))).toBe(false);
  });

  it('reports a real move', () => {
    expect(coordinatesDiffer(SOUSSE, metresNorth(SOUSSE, 250))).toBe(true);
  });

  it('honours a caller-supplied tolerance', () => {
    expect(coordinatesDiffer(SOUSSE, metresNorth(SOUSSE, 50), 100)).toBe(false);
    expect(coordinatesDiffer(SOUSSE, metresNorth(SOUSSE, 50), 10)).toBe(true);
  });

  it('treats two absent points as the same absence', () => {
    expect(coordinatesDiffer(null, null)).toBe(false);
    expect(coordinatesDiffer(undefined, null)).toBe(false);
  });

  it('treats gaining or losing a point as a change', () => {
    expect(coordinatesDiffer(SOUSSE, null)).toBe(true);
    expect(coordinatesDiffer(null, SOUSSE)).toBe(true);
  });

  it('treats a non-finite coordinate as absent rather than comparing it', () => {
    // NaN comparisons answer "not greater than", which would report a broken
    // point as the same point and keep it.
    expect(coordinatesDiffer({ latitude: NaN, longitude: 10 }, SOUSSE)).toBe(true);
  });
});

describe('describeCoordinates', () => {
  it('names the point from the geocoder', async () => {
    mockedReverseGeocode.mockResolvedValue([
      { name: 'Rue de Paris', city: 'Sousse', country: 'Tunisia' },
    ] as Awaited<ReturnType<typeof Location.reverseGeocodeAsync>>);

    await expect(describeCoordinates(SOUSSE)).resolves.toBe('Rue de Paris, Sousse, Tunisia');
  });

  it('drops the parts the geocoder does not know', async () => {
    mockedReverseGeocode.mockResolvedValue([
      { name: null, city: 'Sousse', country: 'Tunisia' },
    ] as Awaited<ReturnType<typeof Location.reverseGeocodeAsync>>);

    await expect(describeCoordinates(SOUSSE)).resolves.toBe('Sousse, Tunisia');
  });

  it('falls back to the coordinates when nothing is named — never to an empty label', async () => {
    mockedReverseGeocode.mockResolvedValue([]);

    await expect(describeCoordinates(SOUSSE)).resolves.toBe('35.8256, 10.6369');
  });

  it('falls back to the coordinates when the geocoder fails', async () => {
    // A point the customer picked is still a point; a lookup failure must not
    // read as a failed pick.
    mockedReverseGeocode.mockRejectedValue(new Error('no network'));

    await expect(describeCoordinates(SOUSSE)).resolves.toBe('35.8256, 10.6369');
  });
});

describe('toPickedAddress', () => {
  it('files the point under the dedicated custom entry, never over a saved one', () => {
    const entry = toCustomerAddress(toPickedAddress(SOUSSE, 'Rue de Paris, Sousse'));

    expect(entry.name).toBe(CUSTOM_ADDRESS_NAME);
    expect(entry.details.coordinates).toEqual(SOUSSE);
    expect(entry.details.formattedAddress).toBe('Rue de Paris, Sousse');
  });

  it('labels a nameless point with its own coordinates', () => {
    expect(toPickedAddress(SOUSSE, '   ').addressText).toBe('35.8256, 10.6369');
  });

  it('invents no floor, door or building for a point tapped on a map', () => {
    const entry = toCustomerAddress(toPickedAddress(SOUSSE, 'Somewhere'));

    expect(entry.details.floor).toBeUndefined();
    expect(entry.details.streetNumber).toBeUndefined();
    expect(entry.details.buildingName).toBeUndefined();
  });
});
