import { driverLocationSchema, type DeliveryStatus, type DriverLocation } from '@/schemas/delivery';
import { getDriverLocation } from '@/services/api/delivery-service';
import {
  coordinatesOf,
  locationFreshness,
  mergeDriverLocation,
  type Coordinates,
  type LocationFreshness,
} from '@/services/api/driver-location-view-model';
import { deliveryKeys, orderKeys } from '@/services/api/query-keys';
import { subscribeToTopic } from '@/services/realtime/stomp-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * Where the driver of an order is, live — for the tracking map.
 *
 * STOMP is primary: every frame on `/topic/orders/{orderId}/driver-location`
 * is written straight into the cache (`setQueryData`, never a refetch — a
 * frame every few seconds must not become a request every few seconds). The
 * snapshot endpoint gives the map its first position, and its slow poll is
 * the backstop for a socket that dropped, the same split `useOrderDelivery`
 * makes.
 *
 * Only runs while `enabled` — the map is open. Nothing here runs for a closed
 * order screen.
 */

/** The backstop poll. Frames arrive every few seconds while the socket is up. */
const LOCATION_POLL_MS = 15_000;

/** How often "Last seen …" and live/stale are re-evaluated. */
const CLOCK_TICK_MS = 5_000;

export interface DriverLocationResult {
  /** The newest location known, including the one that ended the delivery. */
  location: DriverLocation | null;
  /** Where to draw the driver, or null when there is no position to show. */
  coordinates: Coordinates | null;
  freshness: LocationFreshness;
  /** The device clock at the last tick — what `freshness` was judged against. */
  now: number;
  isLoading: boolean;
}

export function useDriverLocation(
  orderId: string | null | undefined,
  enabled: boolean
): DriverLocationResult {
  const queryClient = useQueryClient();
  const active = enabled && !!orderId;

  const query = useQuery({
    queryKey: deliveryKeys.location(orderId ?? ''),
    queryFn: () => getDriverLocation(orderId!),
    enabled: active,
    refetchInterval: active ? LOCATION_POLL_MS : false,
    retry: false,
  });

  useEffect(() => {
    if (!active || !orderId) return;
    return subscribeToTopic(`/topic/orders/${orderId}/driver-location`, (payload) => {
      const parsed = driverLocationSchema.safeParse(payload);
      if (!parsed.success) return;
      const frame = parsed.data;

      let previousStatus: DeliveryStatus | null | undefined;
      queryClient.setQueryData<DriverLocation | null>(deliveryKeys.location(orderId), (current) => {
        previousStatus = current?.deliveryStatus;
        return mergeDriverLocation(current, frame);
      });

      // Pickup, drop-off, return: the frame is the first to know. Re-read the
      // delivery and the order so the rest of the screen follows at once.
      if (frame.deliveryStatus && frame.deliveryStatus !== previousStatus) {
        queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(orderId) });
        queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      }
    });
  }, [active, orderId, queryClient]);

  const now = useClock(active);
  const location = query.data ?? null;

  return {
    location,
    coordinates: coordinatesOf(location),
    freshness: locationFreshness(location, now),
    now,
    isLoading: query.isLoading,
  };
}

/** The device clock, re-read every `CLOCK_TICK_MS` while `running`. */
function useClock(running: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}
