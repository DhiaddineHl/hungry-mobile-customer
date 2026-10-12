import { View } from 'react-native';
import { Image } from 'expo-image';
import { Card, PillButton, Text, Touchable } from '@/components/ds';
import { useRestaurantImageSource } from '@/hooks/use-restaurant-image';
import { useRestaurant } from '@/hooks/use-restaurants';
import {
  formatOrderDate,
  orderItemCount,
  orderStatusLabel,
  type CustomerOrder,
} from '@/services/api/order-list-view-model';
import { createStyles } from '@/theme';
import { OrderOutcomePill } from './order-status-chip';

/**
 * CompletedOrderCard (O2): the restaurant photo, name and date, items and
 * reference, the outcome pill and "Order again" — which opens the menu, never
 * re-submits (a create enqueues a real delivery).
 */
export function CompletedOrderCard({
  order,
  onPress,
  onOrderAgain,
}: {
  order: CustomerOrder;
  onPress: () => void;
  onOrderAgain: () => void;
}) {
  const styles = useStyles();
  const { data: restaurant } = useRestaurant(order.restaurantId);
  const imageSource = useRestaurantImageSource();
  const count = orderItemCount(order);

  return (
    <Touchable
      onPress={onPress}
      scaleTo={0.99}
      accessibilityLabel={`${order.restaurantName}, ${orderStatusLabel(order)}`}
      accessibilityHint="Opens the order details"
    >
      <Card style={styles.card}>
        <View style={styles.image}>
          <Image
            source={imageSource(restaurant?.bannerImage ?? restaurant?.logoUrl)}
            style={styles.fill}
            contentFit="cover"
          />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="rowTitle" numberOfLines={1} style={styles.flex}>
              {restaurant?.name ?? order.restaurantName}
            </Text>
            <Text variant="caption" color="inkMuted">
              {formatOrderDate(order.createdAt)}
            </Text>
          </View>
          <Text variant="meta" color="inkMuted" tabular>
            {order.hasLineDetail ? `${count} ${count === 1 ? 'item' : 'items'} · ${order.reference}` : order.reference}
          </Text>
          <View style={styles.actions}>
            <OrderOutcomePill order={order} />
            {order.restaurantId ? (
              <PillButton
                label="Order again"
                icon="reorder"
                onPress={onOrderAgain}
                accessibilityLabel={`Order again from ${order.restaurantName}`}
              />
            ) : null}
          </View>
        </View>
      </Card>
    </Touchable>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  card: { padding: t.space[12], gap: t.space[12] },
  image: { height: 140, borderRadius: t.radius.field, overflow: 'hidden', backgroundColor: t.colors.skeleton },
  body: { paddingHorizontal: t.space[4], gap: t.space[2] },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[12] },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: t.space[10] },
}));
