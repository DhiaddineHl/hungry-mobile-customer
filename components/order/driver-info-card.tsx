import { View } from 'react-native';
import { IconWell, InfoTag, Text } from '@/components/ds';
import type { DeliveryStatus } from '@/schemas/delivery';
import { createStyles, Icon } from '@/theme';

/**
 * Who's delivering this order, and what they're doing right now
 * (`GET /orders/{id}/delivery`). Identity + status only; the live position is
 * on the tracking map, which `trackable` advertises with a "Track" link.
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

export function DriverInfoCard({
  status,
  driverName,
  driverRating,
  trackable = false,
}: {
  status: DeliveryStatus | null;
  driverName: string | null;
  driverRating: number | null;
  trackable?: boolean;
}) {
  const styles = useStyles();
  const statusLabel = status ? DELIVERY_STATUS_LABELS[status] : 'Looking for a driver…';
  const problem = status === 'FAILED' || status === 'RETURNED';
  return (
    <View style={styles.row}>
      <IconWell icon="delivery" tone={problem ? 'danger' : 'warm'} size={40} round iconColor={problem ? 'danger' : 'primary'} />
      <View style={styles.flex}>
        <Text variant="itemTitle" numberOfLines={1}>
          {driverName ?? 'Finding your driver'}
        </Text>
        <Text variant="meta" color={problem ? 'danger' : 'inkMuted'} numberOfLines={2}>
          {statusLabel}
        </Text>
      </View>
      {driverName && driverRating != null ? <InfoTag label={driverRating.toFixed(1)} icon="star" /> : null}
      {trackable ? (
        <View style={styles.track}>
          <Text variant="label">Track</Text>
          <Icon name="chevronRight" size="row" />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space[12] },
  track: { flexDirection: 'row', alignItems: 'center', gap: 2 },
}));
