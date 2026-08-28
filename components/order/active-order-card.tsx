import { PressableScale } from '@/components/ui/pressable-scale';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import {
  formatOrderDate,
  orderProgressStep,
  orderStatusLabel,
  type CustomerOrder,
} from '@/services/api/order-list-view-model';
import { StyleSheet, Text, View } from 'react-native';
import { OrderProgress } from './order-progress';
import { OrderStatusChip } from './order-status-chip';

/**
 * One in-progress order: where it stands, and what is in it.
 *
 * Read-only by design. The status is moved by the restaurant, the delivery
 * agent and the back-office — the customer app consults and tracks it, so this
 * card carries no action that could change an order's state. Tapping it opens
 * the full details, and that is all.
 *
 * No prices either: `Order` and `OrderItem` have no money columns anywhere
 * (plan §3.3), so a total here would be invented.
 */

interface ActiveOrderCardProps {
  order: CustomerOrder;
  onPress: () => void;
}

export function ActiveOrderCard({ order, onPress }: ActiveOrderCardProps) {
  return (
    <PressableScale
      style={styles.card}
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={`${order.restaurantName}, ${orderStatusLabel(order.status)}`}
      accessibilityHint="Opens the order details"
    >
      <View style={styles.header}>
        <Text style={styles.restaurant} numberOfLines={1}>
          {order.restaurantName}
        </Text>
        <OrderStatusChip status={order.status} compact />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.reference}>Order {order.reference}</Text>
        <Text style={styles.date}>{formatOrderDate(order.createdAt)}</Text>
      </View>

      <View style={styles.divider} />

      <OrderProgress
        step={orderProgressStep(order)}
        statusLabel={orderStatusLabel(order.status)}
      />

      <View style={styles.itemsBlock}>
        <Text style={styles.itemsLabel}>ORDER DETAILS</Text>

        {order.hasLineDetail ? (
          order.lines.map((line) => (
            <View key={line.id} style={styles.itemRow}>
              <View style={styles.quantityChip}>
                <Text style={styles.quantityText}>{line.quantity}x</Text>
              </View>
              <Text style={styles.itemName} numberOfLines={1}>
                {line.name}
              </Text>
            </View>
          ))
        ) : (
          /*
            Not "an order with no items": the backend never sets the
            `order_item.order_id` back-reference, so a real order re-reads with
            an empty list (plan §2.2). Say what is true — the detail is missing.
          */
          <Text style={styles.noDetail}>
            The server didn’t return the items for this order.
          </Text>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: Palette.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Palette.borderSubtle,
    shadowColor: Palette.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  restaurant: {
    flex: 1,
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: -Spacing.sm,
  },
  reference: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  date: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: Palette.borderSubtle,
  },
  itemsBlock: {
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  itemsLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    letterSpacing: 1,
    color: Palette.textMuted,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  quantityChip: {
    minWidth: 32,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.md,
    backgroundColor: Palette.surfaceMuted,
    alignItems: 'center',
  },
  quantityText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.textSecondary,
  },
  itemName: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Palette.textPrimary,
  },
  noDetail: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    lineHeight: 20,
  },
});
