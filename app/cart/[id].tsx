import { CartItem, CheckoutButton, OrderSummary, SyncBadge } from '@/components/cart';
import { DeliveryFeeModal, ServiceFeeModal } from '@/components/checkout';
import {
  CHARGED_DELIVERY_FEE,
  DELIVERY_FEE,
  DELIVERY_FEE_WAIVED,
  SERVICE_FEE,
} from '@/constants/fees';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useStoredImageSource } from '@/hooks/use-restaurant-image';
import { formatDT, useCartStore } from '@/store/cart-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/*
  "Based On Your Choice" was a hardcoded list of three dishes. There is no
  recommendations source anywhere in the backend, so rather than dressing mock
  products up as suggestions the section is gone until one exists.
*/

export default function RestaurantCartScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const allItems = useCartStore((s) => s.items);
  // Read-only here: the sync engine is mounted on the cart tab, so this screen
  // reports the last known state rather than driving a write of its own.
  const syncStatus = useCartStore((s) => s.remote[id]?.status ?? 'idle');
  const increment = useCartStore((s) => s.increment);
  const decrement = useCartStore((s) => s.decrement);
  const removeItem = useCartStore((s) => s.removeItem);

  // Which fee explanation is open, if any. The two designs
  // (`design/Cart Service Fee Info.png`, `design/Cart Delivery Fee Info.png`)
  // are drawn over THIS screen, and only one can be open at a time — hence one
  // piece of state rather than a boolean each.
  const [feeSheet, setFeeSheet] = useState<'service' | 'delivery' | null>(null);

  // Stored artwork is a relative path or a bundled module id; it becomes a
  // renderable source only here, against the current API base.
  const toImageSource = useStoredImageSource();

  const items = allItems.filter((i) => i.restaurantId === id);
  const restaurantName = items[0]?.restaurantName ?? 'Cart';

  // Lines rebuilt from the server carry no addons and no note — `CartItem` is
  // `{cart, product, quantity}`, so those were never stored in the first place.
  // Say so plainly rather than letting an empty description read as "plain".
  const hasHydratedLines = items.some((line) => line.hydrated);

  const subtotal = items.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  // Fees only apply to a cart that has something in it. Both numbers are
  // client-side placeholders — see `constants/fees.ts`.
  const total =
    items.length > 0 ? subtotal + SERVICE_FEE + CHARGED_DELIVERY_FEE : 0;

  const handleBackPress = () => router.back();

  const handleAddItems = () => {
    router.push(`/restaurant/${id}`);
  };

  const handleCheckout = () => {
    router.push({ pathname: '/order-details/[id]', params: { id } });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBackPress}>
          <ArrowLeft size={24} color="#1A2B3D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{restaurantName} Cart</Text>
        <View style={styles.headerSpacer} />
      </View>

      {items.length > 0 ? (
        <View style={styles.syncRow}>
          <SyncBadge status={syncStatus} />
        </View>
      ) : null}

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.itemsSection}>
          {hasHydratedLines ? (
            <Text style={styles.hydratedNote}>
              This cart was restored from your account. Extras and notes you
              added on another device weren&apos;t saved, so they aren&apos;t
              applied here.
            </Text>
          ) : null}

          {items.length === 0 ? (
            <Text style={styles.emptyText}>This cart is empty.</Text>
          ) : (
            items.map((line) => {
              const description =
                line.addons.map((a) => a.name).join(', ') ||
                line.note ||
                '';
              return (
                <CartItem
                  key={line.lineId}
                  id={line.lineId}
                  name={line.name}
                  description={description}
                  price={formatDT(line.unitPrice * line.quantity)}
                  quantity={line.quantity}
                  image={toImageSource(line.image)}
                  onIncrement={() => increment(line.lineId)}
                  onDecrement={() => decrement(line.lineId)}
                  onDelete={() => removeItem(line.lineId)}
                />
              );
            })
          )}

          <TouchableOpacity style={styles.addItemsButton} onPress={handleAddItems}>
            <Plus size={18} color="#1A2B3D" />
            <Text style={styles.addItemsText}>Add Items</Text>
          </TouchableOpacity>
        </View>

        {items.length > 0 && (
          <>
            <OrderSummary
              subtotal={formatDT(subtotal)}
              serviceFee={formatDT(SERVICE_FEE)}
              deliveryFee={
                DELIVERY_FEE_WAIVED ? 'Free' : formatDT(DELIVERY_FEE)
              }
              originalDeliveryFee={
                DELIVERY_FEE_WAIVED ? formatDT(DELIVERY_FEE) : undefined
              }
              isFreeDelivery={DELIVERY_FEE_WAIVED}
              total={formatDT(total)}
              onServiceFeeInfo={() => setFeeSheet('service')}
              onDeliveryFeeInfo={() => setFeeSheet('delivery')}
            />
          </>
        )}
      </ScrollView>

      {items.length > 0 && (
        <CheckoutButton total={formatDT(total)} onPress={handleCheckout} />
      )}

      <ServiceFeeModal
        visible={feeSheet === 'service'}
        onClose={() => setFeeSheet(null)}
      />
      <DeliveryFeeModal
        visible={feeSheet === 'delivery'}
        onClose={() => setFeeSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  itemsSection: {
    padding: 20,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    textAlign: 'center',
    paddingVertical: 24,
  },
  syncRow: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  hydratedNote: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
    backgroundColor: Palette.surfaceMuted,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    lineHeight: 18,
  },
  addItemsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  addItemsText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
});
