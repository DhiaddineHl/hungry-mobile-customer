import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import type { DeliveryStatus } from '@/schemas/delivery';
import { Bike, ChevronRight, Star } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Who's delivering this order, and what they're doing right now
 * (`GET /orders/{id}/delivery`).
 *
 * Identity + status only. The live position is on the tracking map
 * (`app/orders/[id]/track.tsx`); with `trackable` set the card shows a
 * "Track" affordance, and the order screen makes it open that map.
 */

const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  CREATED: 'Looking for a driver…',
  QUEUED: 'Looking for a driver…',
  BATCH_ASSIGNED: 'Driver assigned — waiting for them to accept',
  ACCEPTED: 'Heading to the restaurant',
  REJECTED: 'Finding another driver…',
  PICKED_UP: 'On the way to you',
  DELIVERED: 'Delivered',
  FINISHED: 'Delivered',
  RETURNED: 'The order is being returned — contact support',
  FAILED: 'There’s an issue with this delivery — contact support',
};

interface DriverInfoCardProps {
  status: DeliveryStatus | null;
  driverName: string | null;
  driverRating: number | null;
  /** The driver can be followed live — shows the "Track" affordance. */
  trackable?: boolean;
}

export function DriverInfoCard({
  status,
  driverName,
  driverRating,
  trackable = false,
}: DriverInfoCardProps) {
  const statusLabel = status ? DELIVERY_STATUS_LABELS[status] : 'Looking for a driver…';

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Bike size={20} color={Palette.primaryDark} />
      </View>
      <View style={styles.textGroup}>
        <Text style={styles.name} numberOfLines={1}>
          {driverName ?? 'Finding your driver'}
        </Text>
        <Text style={styles.status} numberOfLines={2}>
          {statusLabel}
        </Text>
      </View>
      {driverName && driverRating != null ? (
        <View style={styles.ratingRow}>
          <Star size={14} color={Palette.warning} fill={Palette.warning} />
          <Text style={styles.ratingText}>{driverRating.toFixed(1)}</Text>
        </View>
      ) : null}
      {trackable ? (
        <View style={styles.trackRow}>
          <Text style={styles.trackText}>Track</Text>
          <ChevronRight size={16} color={Palette.primaryDark} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
  },
  status: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.textSecondary,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: Spacing.sm,
  },
  trackText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.primaryDark,
  },
});
