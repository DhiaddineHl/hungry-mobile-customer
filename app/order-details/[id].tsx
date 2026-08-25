import { DeliveryFeeModal, PaymentMethodModal, ServiceFeeModal } from '@/components/checkout';
import { DeliveryLocationCard, OrderInfoRow, OrderRestaurantRow } from '@/components/order';
import { PressableScale } from '@/components/ui/pressable-scale';
import {
  CHARGED_DELIVERY_FEE,
  DELIVERY_FEE,
  DELIVERY_FEE_WAIVED,
  SERVICE_FEE,
} from '@/constants/fees';
import { paymentMethodLabel } from '@/constants/payment-methods';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { formatAddressName, useDeliveryAddress } from '@/hooks/use-delivery-address';
import { useCreateOrder } from '@/hooks/use-orders';
import { useStoredImageSource } from '@/hooks/use-restaurant-image';
import { useRestaurant } from '@/hooks/use-restaurants';
import {
  checkoutBlockers,
  toOrderInput,
  type CheckoutBlocker,
} from '@/services/api/order-view-model';
import { formatDT, useCartStore } from '@/store/cart-store';
import { usePaymentMethodStore } from '@/store/payment-method-store';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, DollarSign, Info, Phone } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Checkout for ONE restaurant's cart. The route param `id` is a **restaurant
 * id**, not an order id — the order does not exist until the customer taps
 * Continue.
 *
 * Everything on this screen now has a real source (plan §4.3,
 * `docs/plans/checkout-order-creation-plan.md`): the restaurant from
 * `useRestaurant`, the lines and subtotal from the cart store, the address and
 * phone from the customer record, the payment method from its store, and the
 * fees from `constants/fees.ts`.
 *
 * Two things the previous mock showed are deliberately GONE rather than
 * re-sourced:
 *
 *   - the estimated time and arrival time. No ETA, prep-time or estimate field
 *     exists anywhere in the backend, so following RESTO-01's `UNBACKED_FIELDS`
 *     convention the rows render nothing instead of an invented number;
 *   - the totals row's `Delivery Fee` label, which named the row above it while
 *     showing the total. It reads `Total`.
 *
 * A failed create leaves the cart completely intact and offers a MANUAL retry.
 * Nothing here retries on its own: a create that reached the database enqueues
 * a driver, so a duplicate order is a duplicate delivery (plan §3.6).
 */

/**
 * What to tell the customer, and where to send them, for each preflight
 * blocker. Wording is the app's own — the server's failure body says only
 * "A populator has failed (N errors occurred)" and is never relayed.
 */
const BLOCKER_COPY: Record<CheckoutBlocker, { message: string; action?: string }> = {
  'no-customer': { message: 'Loading your account…' },
  'no-address': {
    message: 'Add a delivery address to continue.',
    action: 'Add address',
  },
  'no-address-coords': {
    message: 'Pick your address on the map so a driver can find it.',
    action: 'Set on map',
  },
  'no-restaurant': { message: 'Loading the restaurant…' },
  'no-restaurant-coords': {
    message: 'This restaurant has no map location yet, so it cannot be delivered from.',
  },
  'empty-cart': { message: 'Your cart is empty.' },
};

/** The blockers whose fix is the address flow rather than an error message. */
const ADDRESS_BLOCKERS: CheckoutBlocker[] = ['no-address', 'no-address-coords'];

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id: restaurantId } = useLocalSearchParams<{ id: string }>();

  const [feeSheet, setFeeSheet] = useState<'service' | 'delivery' | null>(null);
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  const allItems = useCartStore((s) => s.items);
  const items = useMemo(
    () => allItems.filter((line) => line.restaurantId === restaurantId),
    [allItems, restaurantId]
  );

  const { customer, selected: selectedAddress } = useDeliveryAddress();
  const { data: restaurant } = useRestaurant(restaurantId);
  const paymentMethod = usePaymentMethodStore((s) => s.method);
  const setPaymentMethod = usePaymentMethodStore((s) => s.setMethod);
  const toImageSource = useStoredImageSource();

  const createOrder = useCreateOrder();

  // The address actually delivered to. `useDeliveryAddress` resolves the
  // selected entry, falling back to the customer's default (top-level
  // `address`) — which is the field the backend's populators dereference.
  const address = selectedAddress?.details ?? customer?.address ?? null;
  const phone = customer?.contact?.phones?.[0];

  const restaurantName =
    restaurant?.name ?? items[0]?.restaurantName ?? 'Restaurant';
  const restaurantLogo =
    (restaurant?.logoUrl ? { uri: restaurant.logoUrl } : undefined) ??
    toImageSource(items[0]?.restaurantLogo);

  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = items.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0
  );
  // Both fees are client-side placeholders — see `constants/fees.ts`. No price,
  // fee or total field exists anywhere on `Order` (plan §3.3), so none of this
  // is sent and none of it is charged.
  const total =
    items.length > 0 ? subtotal + SERVICE_FEE + CHARGED_DELIVERY_FEE : 0;

  const blockers = checkoutBlockers({
    customerId: customer?.id,
    address,
    restaurantId,
    restaurantCoordinates: restaurant?.coordinates ?? null,
    lines: items,
  });
  const blocker = blockers[0];
  const blockerCopy = blocker ? BLOCKER_COPY[blocker] : null;
  const needsAddress = !!blocker && ADDRESS_BLOCKERS.includes(blocker);

  const isSubmitting = createOrder.isPending;
  const canSubmit = blockers.length === 0 && !isSubmitting;

  const handleBlockerAction = () => {
    // An address problem routes to the flow that fixes it rather than showing
    // an error the customer can do nothing about.
    router.push('/address-info');
  };

  const handleContinueCheckout = () => {
    if (!canSubmit || !customer?.id) return;

    setFailed(false);

    createOrder.mutate(
      {
        input: toOrderInput({
          customerId: customer.id,
          restaurantId,
          restaurantName,
          lines: items,
          paymentMethod,
        }),
        restaurantId,
      },
      {
        // The cart is cleared inside the mutation's own `onSuccess`, never
        // here: it must happen whether or not this screen is still mounted.
        onSuccess: () => router.replace('/(tabs)/cart'),
        onError: () => setFailed(true),
      }
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color={Palette.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
      >
        {address ? (
          <DeliveryLocationCard
            addressLabel={
              selectedAddress ? formatAddressName(selectedAddress.name) : 'Delivery'
            }
            addressText={address.formattedAddress ?? 'Address on file'}
            latitude={address.coordinates?.latitude ?? undefined}
            longitude={address.coordinates?.longitude ?? undefined}
            onPress={handleBlockerAction}
          />
        ) : null}

        <View style={styles.sectionDivider} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order Info</Text>

          {/* Rendered only when the customer actually has a phone on file — an
              order row showing a blank number is worse than no row. */}
          {phone ? (
            <>
              <OrderInfoRow
                icon={<Phone size={18} color={Palette.ink} />}
                label={phone}
                chevron={false}
              />
              <View style={styles.rowDivider} />
            </>
          ) : null}

          <OrderInfoRow
            icon={<DollarSign size={18} color={Palette.ink} />}
            label={`Payment Method - ${paymentMethodLabel(paymentMethod)}`}
            onPress={() => setPaymentSheetVisible(true)}
          />

          {/*
            The estimated-time and arrival rows that used to sit here are gone.
            Nothing in the backend carries an ETA, a prep time or a delivery
            estimate, and an invented "~45 min" is a promise the app cannot
            keep. RESTO-01's `UNBACKED_FIELDS` convention: render nothing.
          */}
        </View>

        <View style={styles.sectionDivider} />

        <Text style={styles.summarySectionTitle}>Order Summary</Text>

        {restaurantLogo ? (
          <OrderRestaurantRow
            name={restaurantName}
            itemCount={itemCount}
            logo={restaurantLogo}
            onPress={() => router.push(`/cart/${restaurantId}`)}
          />
        ) : null}

        <View style={styles.pricingCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Subtotal</Text>
            <Text style={styles.priceValue}>{formatDT(subtotal)}</Text>
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceLabelRow}>
              <Text style={styles.priceLabel}>Service Fee</Text>
              <TouchableOpacity
                onPress={() => setFeeSheet('service')}
                accessibilityLabel="What is the service fee?"
                hitSlop={8}
              >
                <Info size={14} color={Palette.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.priceValue}>{formatDT(SERVICE_FEE)}</Text>
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceLabelRow}>
              <Text style={styles.priceLabel}>Delivery Fee</Text>
              <TouchableOpacity
                onPress={() => setFeeSheet('delivery')}
                accessibilityLabel="What is the delivery fee?"
                hitSlop={8}
              >
                <Info size={14} color={Palette.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.deliveryFeeRight}>
              {DELIVERY_FEE_WAIVED ? (
                <>
                  <View style={styles.freeBadge}>
                    <Text style={styles.freeText}>Free</Text>
                  </View>
                  <Text style={styles.strikePrice}>{formatDT(DELIVERY_FEE)}</Text>
                </>
              ) : (
                <Text style={styles.priceValue}>{formatDT(DELIVERY_FEE)}</Text>
              )}
            </View>
          </View>

          <View style={styles.totalDivider} />

          <View style={styles.priceRow}>
            {/* Reads `Total`. The old label said `Delivery Fee` while showing
                the total, which named the row above it. */}
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatDT(total)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/*
          A failed create is stated plainly and retried only by hand. The
          server's own message says nothing a customer can act on, and an
          automatic retry could put a second driver on the road.
        */}
        {failed ? (
          <Text style={styles.errorText}>
            We couldn&apos;t place your order. Your cart is untouched — tap
            Continue to try again.
          </Text>
        ) : null}

        {blockerCopy ? (
          <View style={styles.blockerRow}>
            <Text style={styles.blockerText}>{blockerCopy.message}</Text>
            {needsAddress && blockerCopy.action ? (
              <TouchableOpacity onPress={handleBlockerAction} hitSlop={8}>
                <Text style={styles.blockerAction}>{blockerCopy.action}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <PressableScale
          style={[styles.checkoutButton, !canSubmit && styles.checkoutButtonDisabled]}
          onPress={handleContinueCheckout}
          disabled={!canSubmit}
          scaleTo={0.98}
          accessibilityLabel="Continue to Checkout"
        >
          {isSubmitting ? (
            <ActivityIndicator color={Palette.textInverse} />
          ) : (
            <Text style={styles.checkoutButtonText}>
              {failed ? 'Try Again' : 'Continue to Checkout'}
            </Text>
          )}
        </PressableScale>
      </View>

      <ServiceFeeModal
        visible={feeSheet === 'service'}
        onClose={() => setFeeSheet(null)}
      />
      <DeliveryFeeModal
        visible={feeSheet === 'delivery'}
        onClose={() => setFeeSheet(null)}
      />
      <PaymentMethodModal
        visible={paymentSheetVisible}
        selected={paymentMethod}
        onSelect={(method) => {
          setPaymentMethod(method);
          setPaymentSheetVisible(false);
        }}
        onClose={() => setPaymentSheetVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Palette.borderSubtle,
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.semiBold,
    color: Palette.ink,
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 0,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: Palette.surfaceAlt,
    marginVertical: Spacing.sm,
  },
  sectionCard: {
    marginHorizontal: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Palette.borderSubtle,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Palette.ink,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Palette.borderSubtle,
    marginHorizontal: Spacing.xl,
  },
  summarySectionTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Palette.ink,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  pricingCard: {
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceLabel: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.ink,
  },
  priceValue: {
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Palette.ink,
  },
  deliveryFeeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  freeBadge: {
    backgroundColor: Palette.successSoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  freeText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.success,
  },
  strikePrice: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textDecorationLine: 'line-through',
  },
  totalDivider: {
    height: 1,
    backgroundColor: Palette.border,
  },
  totalLabel: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.ink,
  },
  totalValue: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Palette.ink,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Palette.borderSubtle,
    backgroundColor: Palette.background,
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.danger,
    lineHeight: 18,
  },
  blockerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  blockerText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
    lineHeight: 18,
  },
  blockerAction: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.primary,
  },
  checkoutButton: {
    backgroundColor: Palette.ink,
    borderRadius: Radius.xxl + 4,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: Palette.disabled,
  },
  checkoutButtonText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
});
