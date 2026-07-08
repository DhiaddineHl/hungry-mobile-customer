import { CartHeader, RestaurantCartCard, TrackOrdersSection } from '@/components/cart';
import { Fonts, FontSize, Palette, Spacing } from '@/constants/theme';
import { formatDT, groupByRestaurant, useCartStore } from '@/store/cart-store';
import { useRouter } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const items = useCartStore((s) => s.items);
  const clearRestaurant = useCartStore((s) => s.clearRestaurant);
  const groups = groupByRestaurant(items);

  const handleOrdersPress = () => {
    console.log('Orders pressed');
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

        {groups.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <ShoppingCart size={36} color={Palette.primary} />
            </View>
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySubtitle}>
              Browse the menu and add dishes to get started.
            </Text>
          </View>
        ) : (
          <View style={styles.cartsSection}>
            {groups.map((group) => (
              <RestaurantCartCard
                key={group.restaurantId}
                restaurantName={group.restaurantName}
                restaurantLogo={group.restaurantLogo}
                rating="92%"
                reviewCount="1000+"
                items={group.items.map((line) => ({
                  id: line.lineId,
                  name: line.name,
                  quantity: line.quantity,
                  image: line.image,
                }))}
                totalItems={group.totalQuantity}
                totalPrice={formatDT(group.totalPrice)}
                onViewCart={() => router.push(`/cart/${group.restaurantId}`)}
                onDelete={() => clearRestaurant(group.restaurantId)}
                onAddMore={() => router.push(`/restaurant/${group.restaurantId}`)}
              />
            ))}
          </View>
        )}

        <TrackOrdersSection />
      </ScrollView>
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
});
