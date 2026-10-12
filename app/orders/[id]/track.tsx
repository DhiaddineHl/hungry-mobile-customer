import { DriverTrackingMap } from '@/components/order/driver-tracking-map';
import { MapPlaceholder } from '@/components/location/map-placeholder';
import { IconButton, IconWell, InfoTag, LocateButton, MapSheet, Text, UnreadDot } from '@/components/ds';
import { useCustomerOrder } from '@/hooks/use-customer-orders';
import { useDriverLocation } from '@/hooks/use-driver-location';
import { useOrderDelivery } from '@/hooks/use-order-delivery';
import { DELIVERED_STATUSES } from '@/schemas/delivery';
import { formatLastSeen, isTrackable } from '@/services/api/driver-location-view-model';
import { orderStatusLabel, withDeliveryStatus } from '@/services/api/order-list-view-model';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, View } from 'react-native';
import { createStyles } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The live driver map — opened by tapping the driver card on an order.
 *
 * Tracking runs from the driver's accept (on the way to the restaurant) to the
 * drop-off (`isTrackable`). Positions come from `useDriverLocation`: a
 * snapshot, then the STOMP stream. An old position is shown dimmed as "Last
 * seen …" rather than as live — until the deliverer app reports in the
 * background, the stream pauses whenever the driver leaves the app.
 *
 * When the drop-off is confirmed the screen says so and closes itself; the
 * order screen underneath has already moved to "Delivered".
 */

const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Long enough to read "Delivered", short enough not to feel stuck. */
const CLOSE_AFTER_DELIVERED_MS = 2_500;

export default function TrackDriverScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { order: baseOrder } = useCustomerOrder(id);
  const { delivery, status: deliveryStatus } = useOrderDelivery(id);
  const order = useMemo(
    () => (baseOrder ? withDeliveryStatus(baseOrder, deliveryStatus) : null),
    [baseOrder, deliveryStatus]
  );

  // The stream's final frame can say "delivered" before the delivery re-read.
  const { location, coordinates, freshness, now } = useDriverLocation(id, true);
  const effectiveStatus = location?.deliveryStatus ?? deliveryStatus ?? null;
  const delivered = !!effectiveStatus && DELIVERED_STATUSES.includes(effectiveStatus);
  const trackable = isTrackable(effectiveStatus);

  const [following, setFollowing] = useState(true);
  const [recenterSignal, setRecenterSignal] = useState(0);

  useEffect(() => {
    if (!delivered) return;
    const timer = setTimeout(() => {
      if (router.canGoBack()) router.back();
    }, CLOSE_AFTER_DELIVERED_MS);
    return () => clearTimeout(timer);
  }, [delivered, router]);

  const mapUnsupported = Platform.OS === 'web' || (Platform.OS === 'android' && IS_EXPO_GO);

  const statusLine = delivered
    ? 'Delivered — enjoy your meal!'
    : !trackable
      ? effectiveStatus === 'FAILED' || effectiveStatus === 'RETURNED'
        ? 'This delivery couldn’t be completed.'
        : 'Tracking starts once a driver accepts your order.'
      : order
        ? orderStatusLabel(order)
        : 'Your driver is on the way';

  const freshnessLine =
    !trackable || delivered
      ? null
      : freshness === 'live'
        ? 'Live'
        : freshness === 'stale' && location
          ? `Last seen ${formatLastSeen(location, now)}`
          : 'Waiting for the driver’s location…';

  return (
    <View style={styles.container}>
      {mapUnsupported ? (
        <MapPlaceholder />
      ) : (
        <DriverTrackingMap
          driver={trackable ? coordinates : null}
          pickup={order?.pickup}
          dropoff={order?.dropoff}
          leg={effectiveStatus === 'PICKED_UP' ? 'dropoff' : 'pickup'}
          driverStale={freshness === 'stale'}
          following={following}
          recenterSignal={recenterSignal}
          onUserMove={() => setFollowing(false)}
        />
      )}

      <View style={[styles.topRow, { top: insets.top + 8 }]}>
        <IconButton icon="close" variant="add" onPress={() => router.back()} accessibilityLabel="Close the map" />
        {!following && !mapUnsupported ? (
          <LocateButton
            onPress={() => {
              setFollowing(true);
              setRecenterSignal((n) => n + 1);
            }}
          />
        ) : null}
      </View>

      <View style={styles.bottom}>
        <MapSheet bottomInset={insets.bottom}>
          <View style={styles.driverRow}>
            <IconWell
              icon={delivered ? 'delivered' : 'delivery'}
              tone={delivered ? 'success' : 'warm'}
              size={48}
              round
              iconSize={22}
              iconColor={delivered ? 'success' : 'primary'}
            />
            <View style={styles.flex}>
              <Text variant="rowTitle" numberOfLines={1}>
                {delivery?.driverName ?? 'Your driver'}
              </Text>
              <Text variant="meta" color="inkMuted" numberOfLines={2}>
                {statusLine}
              </Text>
            </View>
            {delivery?.driverRating != null ? <InfoTag label={delivery.driverRating.toFixed(1)} icon="star" /> : null}
          </View>

          {freshnessLine ? (
            <View style={styles.freshness} accessibilityLiveRegion="polite">
              {freshness === 'live' ? <UnreadDot /> : <View style={styles.idleDot} />}
              <Text variant="caption" color={freshness === 'live' ? 'ink' : 'inkMuted'}>
                {freshnessLine}
              </Text>
            </View>
          ) : null}

          {order?.dropoffAddress ? (
            <Text variant="meta" color="inkMuted" numberOfLines={2}>
              {`Delivering to ${order.dropoffAddress}`}
            </Text>
          ) : null}
        </MapSheet>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  container: { flex: 1, backgroundColor: t.colors.surfaceSunken },
  flex: { flex: 1 },
  topRow: {
    position: 'absolute',
    left: t.chromePadding,
    right: t.chromePadding,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[14] },
  freshness: { flexDirection: 'row', alignItems: 'center', gap: t.space[8] },
  idleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.outline },
}));
