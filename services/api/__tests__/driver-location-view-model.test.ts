import type { DriverLocation } from '@/schemas/delivery';
import { driverLocationSchema } from '@/schemas/delivery';
import {
  STALE_AFTER_MS,
  coordinatesOf,
  formatLastSeen,
  isTrackable,
  locationFreshness,
  mergeDriverLocation,
} from '@/services/api/driver-location-view-model';

const NOW = Date.parse('2026-09-26T12:00:00Z');

function fix(overrides: Partial<DriverLocation> = {}): DriverLocation {
  return {
    orderId: 'order-1',
    deliveryId: 'delivery-1',
    driverId: 'driver-1',
    latitude: 35.83,
    longitude: 10.63,
    capturedAt: '2026-09-26T11:59:50Z',
    deliveryStatus: 'PICKED_UP',
    ...overrides,
  };
}

describe('isTrackable', () => {
  it('tracks from the accept until the drop-off', () => {
    expect(isTrackable('ACCEPTED')).toBe(true);
    expect(isTrackable('PICKED_UP')).toBe(true);
  });

  it('has nothing to track before a driver accepts or once it is over', () => {
    for (const status of ['BATCH_ASSIGNED', 'DELIVERED', 'FINISHED', 'FAILED', 'RETURNED'] as const) {
      expect(isTrackable(status)).toBe(false);
    }
    expect(isTrackable(null)).toBe(false);
    expect(isTrackable(undefined)).toBe(false);
  });
});

describe('mergeDriverLocation', () => {
  it('keeps the newer of two fixes, whatever order they arrive in', () => {
    const older = fix({ capturedAt: '2026-09-26T11:59:00Z', latitude: 1 });
    const newer = fix({ capturedAt: '2026-09-26T11:59:30Z', latitude: 2 });

    expect(mergeDriverLocation(older, newer)).toBe(newer);
    expect(mergeDriverLocation(newer, older)).toBe(newer);
  });

  it('takes the first fix as is', () => {
    const first = fix();
    expect(mergeDriverLocation(null, first)).toBe(first);
  });

  it('lets the frame that ends the delivery win, and nothing after it', () => {
    const end = fix({ latitude: null, longitude: null, deliveryStatus: 'DELIVERED' });

    expect(mergeDriverLocation(fix(), end)).toBe(end);
    expect(mergeDriverLocation(end, fix({ capturedAt: '2026-09-26T12:00:00Z' }))).toBe(end);
  });
});

describe('locationFreshness', () => {
  it('is live while recent, stale after a minute of silence', () => {
    expect(locationFreshness(fix({ capturedAt: '2026-09-26T11:59:50Z' }), NOW)).toBe('live');
    const old = new Date(NOW - STALE_AFTER_MS - 1_000).toISOString();
    expect(locationFreshness(fix({ capturedAt: old }), NOW)).toBe('stale');
  });

  it('has nothing to show without coordinates', () => {
    expect(locationFreshness(null, NOW)).toBe('none');
    expect(locationFreshness(fix({ latitude: null, longitude: null }), NOW)).toBe('none');
  });
});

describe('coordinatesOf', () => {
  it('reads the position, or none on the final frame', () => {
    expect(coordinatesOf(fix())).toEqual({ latitude: 35.83, longitude: 10.63 });
    expect(coordinatesOf(fix({ latitude: null }))).toBeNull();
  });
});

describe('formatLastSeen', () => {
  it('speaks in minutes', () => {
    expect(formatLastSeen(fix({ capturedAt: '2026-09-26T11:59:40Z' }), NOW)).toBe('just now');
    expect(formatLastSeen(fix({ capturedAt: '2026-09-26T11:57:00Z' }), NOW)).toBe('3 min ago');
  });
});

describe('driverLocationSchema', () => {
  it('parses the backend frame, including the last one without coordinates', () => {
    const frame = driverLocationSchema.parse({
      orderId: 'order-1',
      deliveryId: 'delivery-1',
      driverId: null,
      latitude: null,
      longitude: null,
      capturedAt: '2026-09-26T12:00:00Z',
      deliveryStatus: 'DELIVERED',
    });
    expect(frame.deliveryStatus).toBe('DELIVERED');
    expect(coordinatesOf(frame)).toBeNull();
  });

  it('degrades an unknown status to null rather than dropping the position', () => {
    const frame = driverLocationSchema.parse({ ...fix(), deliveryStatus: 'TELEPORTED' });
    expect(frame.deliveryStatus).toBeNull();
    expect(coordinatesOf(frame)).not.toBeNull();
  });
});
