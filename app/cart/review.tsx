import { CartItem, CheckoutButton, OrderSummary } from '@/components/cart';
import { DeliveryFeeModal, ServiceFeeModal } from '@/components/checkout';
import { QueryError } from '@/components/ui/query-state';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import {
  useActiveCart,
  useIsCartUpdating,
  useRemoveCartItem,
  useSetItemQuantity,
} from '@/hooks/use-cart';
import { useCartArtwork } from '@/hooks/use-cart-artwork';
import { discountPromotions, groupCartByRestaurant } from '@/services/api/cart-view-model';
import { formatDT } from '@/services/api/money';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
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
 *
 * Every figure on this screen is the server's. Tapping `+` sends the new
 * quantity and the server answers with the recalculated cart (promotions,
 * delivery, service and additional fees, totals); the line moves at once, the
 * summary says "Updating…" until that answer lands.
 */
export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: cart, isPending, error, refetch } = useActiveCart();
  const setQuantity = useSetItemQuantity();
  const removeItem = useRemoveCartItem();
  const isUpdating = useIsCartUpdating();
  const artwork = useCartArtwork(cart);

  // Which fee explanation is open, if any. The two designs
  // (`design/Cart Service Fee Info.png`, `design/Cart Delivery Fee Info.png`)
  // are drawn over THIS screen, and only one can be open at a time — hence one
  // piece of state rather than a boolean each.
  const [feeSheet, setFeeSheet] = useState<'service' | 'delivery' | null>(null);

  const groups = groupCartByRestaurant(cart);
  const orderCount = cart?.orders.length ?? groups.length;
  const hasItems = !!cart && cart.items.length > 0;

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

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.itemsSection}>
          {isPending ? (
            <View style={styles.centered}>
              <ActivityIndicator color={Palette.primary} />
            </View>
          ) : error && !cart ? (
            <QueryError error={error} onRetry={() => void refetch()} />
          ) : !hasItems ? (
            <Text style={styles.emptyText}>Your cart is empty.</Text>
          ) : (
            <>
              {orderCount > 1 ? (
                <Text style={styles.note}>
                  Your cart has dishes from {orderCount} restaurants. They will
                  be placed as {orderCount} separate orders, each with its own
                  delivery fee; the service fee is shared between them.
                </Text>
              ) : null}

              {groups.map((group) => (
                <View key={group.restaurantId} style={styles.group}>
                  <View style={styles.groupHeader}>
                    <Image
                      source={artwork.logoOf(group.restaurantId)}
                      style={styles.groupLogo}
                      contentFit="cover"
                    />
                    <View style={styles.groupTitleBlock}>
                      <Text style={styles.groupTitle} numberOfLines={1}>
                        {group.restaurantName}
                      </Text>
                      <Text style={styles.groupMeta}>
                        {group.totalQuantity} {group.totalQuantity === 1 ? 'item' : 'items'} ·{' '}
                        {formatDT(
                          group.order?.subtotal ??
                            group.items.reduce((sum, line) => sum + line.lineTotal, 0)
                        )}
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
                      line.options.map((option) => option.name).filter(Boolean).join(', ') ||
                      line.note ||
                      '';
                    return (
                      <CartItem
                        key={line.id}
                        id={line.id}
                        name={line.productName ?? ''}
                        description={line.giftItem ? 'A gift from a promotion' : description}
                        price={line.giftItem ? 'Free' : formatDT(line.lineTotal)}
                        quantity={line.quantity}
                        image={artwork.imageOf(line.productId)}
                        // A gift is the server's to give and to take back: the customer cannot edit it.
                        onIncrement={
                          line.giftItem
                            ? undefined
                            : () => setQuantity.mutate({ itemId: line.id, quantity: line.quantity + 1 })
                        }
                        onDecrement={
                          line.giftItem
                            ? undefined
                            : () =>
                                line.quantity > 1
                                  ? setQuantity.mutate({ itemId: line.id, quantity: line.quantity - 1 })
                                  : removeItem.mutate(line.id)
                        }
                        onDelete={line.giftItem ? undefined : () => removeItem.mutate(line.id)}
                      />
                    );
                  })}
                </View>
              ))}
            </>
          )}
        </View>

        {cart && hasItems ? (
          <OrderSummary
            subtotal={formatDT(cart.subtotal)}
            discounts={discountPromotions(cart).map((promotion) => ({
              label: promotion.message ?? promotion.promotionRuleCode ?? 'Discount',
              amount: formatDT(promotion.amount ?? 0),
            }))}
            deliveryFees={cart.deliveryFees.map((fee) => ({
              label:
                cart.deliveryFees.length > 1
                  ? `Delivery · ${fee.restaurantName ?? 'Restaurant'}`
                  : 'Delivery Fee',
              amount: formatDT(fee.amount),
            }))}
            serviceFee={cart.serviceFee ? formatDT(cart.serviceFee.amount) : null}
            serviceFeeNote={
              cart.serviceFee && cart.serviceFee.orderCount > 1
                ? `Shared equally across ${cart.serviceFee.orderCount} orders`
                : undefined
            }
            additionalFees={cart.additionalFees.map((fee) => ({
              label: fee.label ?? fee.code,
              amount: formatDT(fee.amount),
            }))}
            total={formatDT(cart.total)}
            updating={isUpdating}
            onServiceFeeInfo={() => setFeeSheet('service')}
            onDeliveryFeeInfo={() => setFeeSheet('delivery')}
          />
        ) : null}
      </ScrollView>

      {cart && hasItems ? (
        <CheckoutButton
          total={isUpdating ? 'Updating…' : formatDT(cart.total)}
          onPress={handleCheckout}
        />
      ) : null}

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
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl,
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
