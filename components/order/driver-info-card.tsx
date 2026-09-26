import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import type { DeliveryStatus } from '@/schemas/delivery';
import { Bike, Star } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Who's delivering this order, and what they're doing right now — new for
 * the driver-tracking phase (`GET /orders/{id}/delivery`).
 *
 * No map here: the backend has nowhere to read a busy driver's LIVE position
 * from once they're assigned — `DriverRegistry` (the Redis GEO store the
 * assignment engine matches against) drops a driver the moment they're
 * assigned (`markUnavailable`), by design, since it only ever needs to answer
 * "who's available right now." Showing a stale or fabricated position would
 * be worse than not showing one; a live-during-delivery position feed is a
 * real backend gap, not something to paper over on this side. This card is
 * therefore identity + status only — the same information `OrderProgress`
 * already gives for the restaurant side of the order.
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
}

export function DriverInfoCard({ status, driverName, driverRating }: DriverInfoCardProps) {
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
});
