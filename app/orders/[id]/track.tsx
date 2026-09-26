import { DriverTrackingMap } from '@/components/order/driver-tracking-map';
import { MapPlaceholder } from '@/components/location/map-placeholder';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Fonts, FontSize, Palette, Radius, Shadows, Spacing } from '@/constants/theme';
import { useCustomerOrder } from '@/hooks/use-customer-orders';
import { useDriverLocation } from '@/hooks/use-driver-location';
import { useOrderDelivery } from '@/hooks/use-order-delivery';
import { DELIVERED_STATUSES } from '@/schemas/delivery';
import { formatLastSeen, isTrackable } from '@/services/api/driver-location-view-model';
import { orderStatusLabel, withDeliveryStatus } from '@/services/api/order-list-view-model';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Bike, LocateFixed, PackageCheck, Star, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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

      <PressableScale
        style={[styles.roundButton, styles.closeButton, { top: insets.top + Spacing.sm }]}
        onPress={() => router.back()}
        scaleTo={0.92}
        accessibilityLabel="Close the map"
      >
        <X size={22} color={Palette.ink} />
      </PressableScale>

      {!following && !mapUnsupported ? (
        <PressableScale
          style={[styles.roundButton, styles.recenterButton, { top: insets.top + Spacing.sm }]}
          onPress={() => {
            setFollowing(true);
            setRecenterSignal((n) => n + 1);
          }}
          scaleTo={0.92}
          accessibilityLabel="Recenter on the driver"
        >
          <LocateFixed size={22} color={Palette.ink} />
        </PressableScale>
      ) : null}

      <View style={[styles.panel, Shadows.lg, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.driverRow}>
          <View style={[styles.avatar, delivered && styles.avatarDone]}>
            {delivered ? (
              <PackageCheck size={22} color={Palette.success} />
            ) : (
              <Bike size={22} color={Palette.primaryDark} />
            )}
          </View>
          <View style={styles.driverText}>
            <Text style={styles.driverName} numberOfLines={1}>
              {delivery?.driverName ?? 'Your driver'}
            </Text>
            <Text style={styles.status} numberOfLines={2}>
              {statusLine}
            </Text>
          </View>
          {delivery?.driverRating != null ? (
            <View style={styles.rating}>
              <Star size={14} color={Palette.warning} fill={Palette.warning} />
              <Text style={styles.ratingText}>{delivery.driverRating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>

        {freshnessLine ? (
          <View style={styles.freshnessRow}>
            <View style={[styles.dot, freshness === 'live' ? styles.dotLive : styles.dotIdle]} />
            <Text style={styles.freshnessText}>{freshnessLine}</Text>
          </View>
        ) : null}

        {order?.dropoffAddress ? (
          <Text style={styles.address} numberOfLines={2}>
            Delivering to {order.dropoffAddress}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  roundButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  closeButton: {
    left: Spacing.lg,
  },
  recenterButton: {
    right: Spacing.lg,
  },
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDone: {
    backgroundColor: Palette.successSoft,
  },
  driverText: {
    flex: 1,
    gap: 2,
  },
  driverName: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
  },
  status: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.textSecondary,
  },
  freshnessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
  },
  dotLive: {
    backgroundColor: Palette.success,
  },
  dotIdle: {
    backgroundColor: Palette.textPlaceholder,
  },
  freshnessText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    color: Palette.textMuted,
  },
  address: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    lineHeight: 18,
  },
});
