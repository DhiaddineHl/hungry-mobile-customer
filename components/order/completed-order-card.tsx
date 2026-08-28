import { PressableScale } from '@/components/ui/pressable-scale';
import { RESTAURANT_IMAGE_PLACEHOLDER } from '@/constants/images';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useRestaurantImageSource } from '@/hooks/use-restaurant-image';
import { useRestaurant } from '@/hooks/use-restaurants';
import {
  formatOrderDate,
  orderItemCount,
  type CustomerOrder,
} from '@/services/api/order-list-view-model';
import { Image } from 'expo-image';
import { RotateCcw } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { OrderStatusChip } from './order-status-chip';

/**
 * One finished order.
 *
 * The artwork is the restaurant's own, fetched by id — an `Order` carries no
 * image of its own, and the restaurant is already cached by the home and
 * restaurant screens, so this is usually free.
 *
 * "Order again" is navigation, not a re-submission: it opens the restaurant's
 * menu. Nothing here re-creates an order — a create enqueues a real delivery,
 * and the customer must go through the cart and checkout for that.
 */

interface CompletedOrderCardProps {
  order: CustomerOrder;
  onPress: () => void;
  onOrderAgain: () => void;
}

export function CompletedOrderCard({
  order,
  onPress,
  onOrderAgain,
}: CompletedOrderCardProps) {
  const { data: restaurant } = useRestaurant(order.restaurantId);
  const toImageSource = useRestaurantImageSource();

  const source = restaurant?.bannerImage
    ? toImageSource(restaurant.bannerImage)
    : restaurant?.logoUrl
      ? toImageSource(restaurant.logoUrl)
      : { uri: RESTAURANT_IMAGE_PLACEHOLDER };

  const itemCount = orderItemCount(order);

  return (
    <PressableScale
      style={styles.card}
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={`${order.restaurantName}, ${formatOrderDate(order.createdAt)}`}
      accessibilityHint="Opens the order details"
    >
      <Image source={source} style={styles.banner} contentFit="cover" />

      <View style={styles.titleRow}>
        <Text style={styles.restaurant} numberOfLines={1}>
          {restaurant?.name ?? order.restaurantName}
        </Text>
        <Text style={styles.date}>{formatOrderDate(order.createdAt)}</Text>
      </View>

      <Text style={styles.meta}>
        {order.hasLineDetail
          ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'} • ${order.reference}`
          : order.reference}
      </Text>

      <View style={styles.footer}>
        <OrderStatusChip status={order.status} compact />

        <PressableScale
          style={styles.orderAgainButton}
          onPress={onOrderAgain}
          scaleTo={0.95}
          haptic
          accessibilityLabel={`Order again from ${order.restaurantName}`}
          accessibilityHint="Opens the restaurant’s menu"
        >
          <RotateCcw size={16} color={Palette.textInverse} />
          <Text style={styles.orderAgainText}>Order again</Text>
        </PressableScale>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.xl,
    padding: Spacing.md,
    gap: Spacing.sm,
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
  banner: {
    width: '100%',
    height: 140,
    borderRadius: Radius.lg,
    backgroundColor: Palette.surfaceMuted,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  restaurant: {
    flex: 1,
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
  },
  date: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  meta: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  orderAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Palette.ink,
  },
  orderAgainText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
});
