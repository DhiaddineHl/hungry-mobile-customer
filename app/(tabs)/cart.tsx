import {
  CartHeader,
  CheckoutButton,
  RestaurantCartCard,
  SyncBadge,
} from '@/components/cart';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useCartSync, useHydrateCart } from '@/hooks/use-cart-sync';
import { useCustomerOrders } from '@/hooks/use-customer-orders';
import { useStoredImageSource } from '@/hooks/use-restaurant-image';
import {
  cartSubtotal,
  formatDT,
  groupByRestaurant,
  useCartStore,
} from '@/store/cart-store';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { PackageSearch, ShoppingCart, UtensilsCrossed } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The customer's ONE cart, shown one restaurant at a time.
 *
 * Grouping is presentation and a preview of checkout — every restaurant here
 * becomes its own order — not a separate cart per restaurant. There is one
 * sync badge, one total and one "View Cart" for the lot.
 */
export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const items = useCartStore((s) => s.items);
  const syncStatus = useCartStore((s) => s.remote.status);
  const clearRestaurant = useCartStore((s) => s.clearRestaurant);
  const groups = groupByRestaurant(items);

  // The cart tab is where the backend projection is kept in step: hydration
  // restores the server cart onto an empty device, and the sync engine pushes
  // every later change back up. Both no-op when signed out.
  useHydrateCart();
  const { retry } = useCartSync();

  // Stored artwork is a relative path or a bundled module id; it becomes a
  // renderable source only here, against the current API base.
  const toImageSource = useStoredImageSource();

  // Whether "track your orders" is worth offering on an empty cart: only when
  // something is actually in progress. Same cache entry as My Orders.
  const { active: activeOrders } = useCustomerOrders();
  const hasActiveOrder = activeOrders.length > 0;

  const handleOrdersPress = () => {
    router.push('/orders');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <CartHeader onOrdersPress={handleOrdersPress} />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.divider} />

        {groups.length > 0 ? (
          <View style={styles.cartsSection}>
            <View style={styles.syncRow}>
              <SyncBadge status={syncStatus} onRetry={retry} />
            </View>

            {groups.length > 1 ? (
              <Text style={styles.splitNote}>
                Dishes from {groups.length} restaurants — at checkout they are
                placed as {groups.length} separate orders.
              </Text>
            ) : null}

            {groups.map((group) => (
              /*
                `rating` and `reviewCount` are deliberately not passed: no
                backend field supplies either (UNBACKED_FIELDS), and the
                "92% (1000+)" they used to show was invented.
              */
              <RestaurantCartCard
                key={group.restaurantId}
                restaurantName={group.restaurantName}
                restaurantLogo={toImageSource(group.restaurantLogo)}
                items={group.items.map((line) => ({
                  id: line.lineId,
                  name: line.name,
                  quantity: line.quantity,
                  image: toImageSource(line.image),
                }))}
                totalItems={group.totalQuantity}
                totalPrice={formatDT(group.totalPrice)}
                onDelete={() => clearRestaurant(group.restaurantId)}
                onAddMore={() => router.push(`/restaurant/${group.restaurantId}`)}
              />
            ))}
          </View>
        ) : (
          /*
            The empty state says so and offers the two things a customer with
            nothing in the cart might want next: the menu, or — only while one
            is running — the order they already placed. Placing an order is
            what usually empties the cart, so the second is the likelier tap.
          */
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <ShoppingCart size={36} color={Palette.primary} />
            </View>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>
              {hasActiveOrder
                ? 'Your order is on its way. Follow it, or start a new one.'
                : 'Browse restaurants and add dishes to get started.'}
            </Text>

            <View style={styles.emptyActions}>
              <PressableScale
                style={[styles.emptyButton, styles.emptyButtonPrimary]}
                onPress={() => router.navigate('/')}
                scaleTo={0.97}
                haptic
                accessibilityLabel="Browse restaurants"
              >
                <UtensilsCrossed size={18} color={Palette.textInverse} />
                <Text style={styles.emptyButtonPrimaryText}>Browse restaurants</Text>
              </PressableScale>

              {hasActiveOrder ? (
                <PressableScale
                  style={[styles.emptyButton, styles.emptyButtonSecondary]}
                  onPress={handleOrdersPress}
                  scaleTo={0.97}
                  haptic
                  accessibilityLabel="Track your orders"
                >
                  <PackageSearch size={18} color={Palette.ink} />
                  <Text style={styles.emptyButtonSecondaryText}>Track your orders</Text>
                </PressableScale>
              ) : null}
            </View>
          </View>
        )}
      </ScrollView>

      {items.length > 0 ? (
        <CheckoutButton
          label="View Cart"
          total={formatDT(cartSubtotal(items))}
          onPress={() => router.push('/cart/review')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cartsSection: {
    marginBottom: 16,
    gap: 16,
  },
  // The card brings its own marginHorizontal; the badge and note match it.
  syncRow: {
    paddingHorizontal: Spacing.xl,
  },
  splitNote: {
    paddingHorizontal: Spacing.xl,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
    lineHeight: 18,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActions: {
    alignSelf: 'stretch',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.xxl + 4,
  },
  emptyButtonPrimary: {
    backgroundColor: Palette.ink,
  },
  emptyButtonPrimaryText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
  emptyButtonSecondary: {
    backgroundColor: Palette.surface,
    borderWidth: 1.5,
    borderColor: Palette.ink,
  },
  emptyButtonSecondaryText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.ink,
  },
});
