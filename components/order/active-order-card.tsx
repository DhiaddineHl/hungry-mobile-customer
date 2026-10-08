import { View } from 'react-native';
import { Card, RestaurantGroupHeader, Text, Touchable } from '@/components/ds';
import { useRestaurantImageSource } from '@/hooks/use-restaurant-image';
import { useRestaurant } from '@/hooks/use-restaurants';
import {
  formatOrderDate,
  orderProgressStep,
  orderStatusLabel,
  type CustomerOrder,
} from '@/services/api/order-list-view-model';
import { createStyles } from '@/theme';
import { OrderProgress } from './order-progress';
import { OrderStatusChip } from './order-status-chip';

/**
 * OrderCard (O1): restaurant header with `#01A6-0D27 · 29 Sept 2026` and the
 * status badge, the five-step progress, and what is in the order.
 *
 * Read-only by design: the status is moved by the restaurant, the delivery
 * agent and the back-office. Tapping opens the full details, and that is all.
 */
export function ActiveOrderCard({ order, onPress }: { order: CustomerOrder; onPress: () => void }) {
  const styles = useStyles();
  const { data: restaurant } = useRestaurant(order.restaurantId);
  const imageSource = useRestaurantImageSource();

  return (
    <Touchable
      onPress={onPress}
      scaleTo={0.99}
      accessibilityLabel={`${order.restaurantName}, ${orderStatusLabel(order)}`}
      accessibilityHint="Opens the order details"
    >
      <Card padded style={styles.card}>
        <RestaurantGroupHeader
          logo={restaurant?.logoUrl ? imageSource(restaurant.logoUrl) : undefined}
          name={restaurant?.name ?? order.restaurantName}
          meta={`${order.reference} · ${formatOrderDate(order.createdAt)}`}
          trailing={<OrderStatusChip order={order} />}
        />
        <OrderProgress step={orderProgressStep(order)} statusLabel={orderStatusLabel(order)} />
        <View style={styles.items}>
          {order.hasLineDetail ? (
            order.lines.map((line) => (
              <Text key={line.id} variant="meta" numberOfLines={1}>
                <Text variant="meta" style={styles.qty}>{`${line.quantity}× `}</Text>
                {line.name}
              </Text>
            ))
          ) : (
            // Not "an order with no items": the backend never sets the
            // `order_item.order_id` back-reference, so a real order re-reads
            // with an empty list. Say what is true.
            <Text variant="meta" color="inkMuted">
              The items for this order aren't available. The restaurant has them.
            </Text>
          )}
        </View>
      </Card>
    </Touchable>
  );
}

const useStyles = createStyles((t) => ({
  card: { gap: t.space[14] },
  items: {
    backgroundColor: t.colors.surfaceMuted,
    borderRadius: t.radius.control,
    paddingVertical: t.space[10],
    paddingHorizontal: t.space[12],
    gap: t.space[4],
  },
  qty: { fontFamily: t.typography.itemTitle.fontFamily },
}));
