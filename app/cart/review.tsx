import { CartItem, CheckoutButton, OrderSummary, SyncBadge } from '@/components/cart';
import { DeliveryFeeModal, ServiceFeeModal } from '@/components/checkout';
import { DELIVERY_FEE, DELIVERY_FEE_WAIVED, SERVICE_FEE } from '@/constants/fees';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useStoredImageSource } from '@/hooks/use-restaurant-image';
import { checkoutTotals } from '@/services/api/order-view-model';
import { formatDT, groupByRestaurant, useCartStore } from '@/store/cart-store';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/*
  "Based On Your Choice" was a hardcoded list of three dishes. There is no
  recommendations source anywhere in the backend, so rather than dressing mock
  products up as suggestions the section is gone until one exists.
*/

/**
 * The whole cart, line by line, grouped under the restaurant each line is
 * from.
 *
 * One cart, however many restaurants: the grouping is there because checkout
 * places one order PER restaurant, and the customer should see that split —
 * and the fees it implies — before tapping Continue, not after.
 */
export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const items = useCartStore((s) => s.items);
  // Read-only here: the sync engine is mounted on the cart tab, so this screen
  // reports the last known state rather than driving a write of its own.
  const syncStatus = useCartStore((s) => s.remote.status);
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

  const groups = groupByRestaurant(items);
  const orderCount = groups.length;

  // Lines rebuilt from the server carry no addons and no note — `CartItem` is
  // `{cart, product, quantity}`, so those were never stored in the first place.
  // Say so plainly rather than letting an empty description read as "plain".
  const hasHydratedLines = items.some((line) => line.hydrated);

  // Fees apply PER ORDER, and there is one order per restaurant — see
  // `checkoutTotals`. Both fee amounts are client-side placeholders
  // (`constants/fees.ts`).
  const totals = checkoutTotals(groups);

  const handleBackPress = () => router.back();

  const handleCheckout = () => {
    router.push('/order-details');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBackPress}>
          <ArrowLeft size={24} color="#1A2B3D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Cart</Text>
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
            <Text style={styles.note}>
              This cart was restored from your account. Extras and notes you
              added on another device weren&apos;t saved, so they aren&apos;t
              applied here.
            </Text>
          ) : null}

          {orderCount > 1 ? (
            <Text style={styles.note}>
              Your cart has dishes from {orderCount} restaurants. They will be
              placed as {orderCount} separate orders, each with its own service
              and delivery fee.
            </Text>
          ) : null}

          {items.length === 0 ? (
            <Text style={styles.emptyText}>Your cart is empty.</Text>
          ) : (
            groups.map((group) => (
              <View key={group.restaurantId} style={styles.group}>
                <View style={styles.groupHeader}>
                  <Image
                    source={toImageSource(group.restaurantLogo)}
                    style={styles.groupLogo}
                    contentFit="cover"
                  />
                  <View style={styles.groupTitleBlock}>
                    <Text style={styles.groupTitle} numberOfLines={1}>
                      {group.restaurantName}
                    </Text>
                    <Text style={styles.groupMeta}>
                      {group.totalQuantity} {group.totalQuantity === 1 ? 'item' : 'items'} ·{' '}
                      {formatDT(group.totalPrice)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.addItemsButton}
                    onPress={() => router.push(`/restaurant/${group.restaurantId}`)}
                    accessibilityLabel={`Add items from ${group.restaurantName}`}
                  >
                    <Plus size={16} color="#1A2B3D" />
                    <Text style={styles.addItemsText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {group.items.map((line) => {
                  const description =
                    line.addons.map((a) => a.name).join(', ') || line.note || '';
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
                })}
              </View>
            ))
          )}
        </View>

        {items.length > 0 && (
          <OrderSummary
            subtotal={formatDT(totals.subtotal)}
            serviceFee={
              orderCount > 1
                ? `${orderCount} × ${formatDT(SERVICE_FEE)}`
                : formatDT(SERVICE_FEE)
            }
            deliveryFee={
              DELIVERY_FEE_WAIVED
                ? 'Free'
                : orderCount > 1
                  ? `${orderCount} × ${formatDT(DELIVERY_FEE)}`
                  : formatDT(DELIVERY_FEE)
            }
            originalDeliveryFee={
              DELIVERY_FEE_WAIVED
                ? orderCount > 1
                  ? `${orderCount} × ${formatDT(DELIVERY_FEE)}`
                  : formatDT(DELIVERY_FEE)
                : undefined
            }
            isFreeDelivery={DELIVERY_FEE_WAIVED}
            total={formatDT(totals.total)}
            onServiceFeeInfo={() => setFeeSheet('service')}
            onDeliveryFeeInfo={() => setFeeSheet('delivery')}
          />
        )}
      </ScrollView>

      {items.length > 0 && (
        <CheckoutButton total={formatDT(totals.total)} onPress={handleCheckout} />
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
    gap: 16,
  },
  group: {
    gap: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  groupTitleBlock: {
    flex: 1,
    gap: 2,
  },
  groupTitle: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  groupMeta: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
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
  note: {
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
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  addItemsText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
});
