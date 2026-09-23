import {
  CartHeader,
  CheckoutButton,
  RestaurantCartCard,
} from '@/components/cart';
import { PressableScale } from '@/components/ui/pressable-scale';
import { QueryError } from '@/components/ui/query-state';
import { useActiveCart, useClearRestaurantItems, useIsCartUpdating } from '@/hooks/use-cart';
import { useCartArtwork } from '@/hooks/use-cart-artwork';
import { useCustomerOrders } from '@/hooks/use-customer-orders';
import { groupCartByRestaurant } from '@/services/api/cart-view-model';
import { formatDT } from '@/services/api/money';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { PackageSearch, ShoppingCart, UtensilsCrossed } from 'lucide-react-native';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The customer's ONE cart, shown one restaurant at a time.
 *
 * The cart is the server's: this screen reads the latest recalculated state
 * every time it opens, and shows what came back — nothing is priced here.
 * Grouping is presentation and a preview of checkout — every restaurant here
 * becomes its own order — not a separate cart per restaurant. There is one
 * total and one "View Cart" for the lot.
 */
export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data: cart, isPending, error, refetch } = useActiveCart();
  const clearRestaurant = useClearRestaurantItems();
  const isUpdating = useIsCartUpdating();
  const artwork = useCartArtwork(cart);
  const groups = groupCartByRestaurant(cart);

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

        {isPending ? (
          <View style={styles.centered}>
            <ActivityIndicator color={Palette.primary} />
          </View>
        ) : error && !cart ? (
          <QueryError error={error} onRetry={() => void refetch()} />
        ) : groups.length > 0 ? (
          <View style={styles.cartsSection}>
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
                restaurantLogo={artwork.logoOf(group.restaurantId)}
                items={group.items.map((line) => ({
                  id: line.id,
                  name: line.productName ?? '',
                  quantity: line.quantity,
                  image: artwork.imageOf(line.productId),
                }))}
                totalItems={group.totalQuantity}
                totalPrice={formatDT(
                  group.order?.subtotal ??
                    group.items.reduce((sum, line) => sum + line.lineTotal, 0)
                )}
                onDelete={() => clearRestaurant.mutate(group.restaurantId)}
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

      {cart && cart.items.length > 0 ? (
        <CheckoutButton
          label="View Cart"
          total={isUpdating ? 'Updating…' : formatDT(cart.total)}
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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
  },
  cartsSection: {
    marginBottom: 16,
    gap: 16,
  },
  // The card brings its own marginHorizontal; the note matches it.
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
