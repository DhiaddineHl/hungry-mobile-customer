import { useReverseGeocode } from '@/hooks/use-reverse-geocode';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';

/**
 * The guard this hook exists for: a customer dragging a map fires one lookup
 * per settle, and the platform geocoder answers out of order. A slow answer
 * about a point they have already left must never label the point they are
 * looking at now.
 */

jest.mock('expo-location', () => ({ reverseGeocodeAsync: jest.fn() }));

const mockedReverseGeocode = Location.reverseGeocodeAsync as jest.MockedFunction<
  typeof Location.reverseGeocodeAsync
>;

const FIRST = { latitude: 35.8256, longitude: 10.6369 };
const SECOND = { latitude: 36.8065, longitude: 10.1815 };

/** A lookup whose answer is released by the returned function. */
function deferredPlace(name: string) {
  let release: () => void = () => {};
  const promise = new Promise<Awaited<ReturnType<typeof Location.reverseGeocodeAsync>>>(
    (resolve) => {
      release = () =>
        resolve([{ name, city: null, country: null }] as Awaited<
          ReturnType<typeof Location.reverseGeocodeAsync>
        >);
    }
  );
  return { promise, release: () => release() };
}

/**
 * `renderHook` is ASYNC in RNTL 14, and the first commit lands one microtask
 * later still — without the flush, `result.current` is null.
 */
async function renderReverseGeocode() {
  const { result } = await renderHook(() => useReverseGeocode());
  await act(async () => {});
  return result;
}

afterEach(() => {
  jest.resetAllMocks();
});

it('resolves a point to its name', async () => {
  mockedReverseGeocode.mockResolvedValue([
    { name: 'Rue de Paris', city: 'Sousse', country: 'Tunisia' },
  ] as Awaited<ReturnType<typeof Location.reverseGeocodeAsync>>);

  const result = await renderReverseGeocode();

  await act(async () => {
    await result.current.describe(FIRST);
  });

  expect(result.current.text).toBe('Rue de Paris, Sousse, Tunisia');
  expect(result.current.isResolving).toBe(false);
});

it('ignores a slow answer about a point the customer has already left', async () => {
  const slow = deferredPlace('Old point');
  const fast = deferredPlace('New point');
  mockedReverseGeocode
    .mockReturnValueOnce(slow.promise)
    .mockReturnValueOnce(fast.promise);

  const result = await renderReverseGeocode();

  await act(async () => {
    void result.current.describe(FIRST);
    void result.current.describe(SECOND);
  });

  // The newest point answers first, then the stale one arrives.
  await act(async () => {
    fast.release();
    await Promise.resolve();
    slow.release();
    await Promise.resolve();
  });

  await waitFor(() => expect(result.current.text).toBe('New point'));
  expect(result.current.text).not.toBe('Old point');
});

it('abandons a lookup in flight when the pick is reset', async () => {
  const pending = deferredPlace('Cancelled point');
  mockedReverseGeocode.mockReturnValueOnce(pending.promise);

  const result = await renderReverseGeocode();

  await act(async () => {
    void result.current.describe(FIRST);
  });

  await act(async () => {
    result.current.reset();
  });

  await act(async () => {
    pending.release();
    await Promise.resolve();
  });

  expect(result.current.text).toBeNull();
  expect(result.current.isResolving).toBe(false);
});
