import { DeliveryFeeModal, PaymentMethodModal, ServiceFeeModal } from '@/components/checkout';
import { DeliveryLocationCard, OrderInfoRow, OrderRestaurantRow } from '@/components/order';
import { PressableScale } from '@/components/ui/pressable-scale';
import { DELIVERY_FEE, DELIVERY_FEE_WAIVED, SERVICE_FEE } from '@/constants/fees';
import { paymentMethodLabel } from '@/constants/payment-methods';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useSaveAddresses } from '@/hooks/use-customer';
import { formatAddressName, useDeliveryAddress } from '@/hooks/use-delivery-address';
import { useCreateOrder } from '@/hooks/use-orders';
import { useStoredImageSource } from '@/hooks/use-restaurant-image';
import { useRestaurant } from '@/hooks/use-restaurants';
import { useReverseGeocode } from '@/hooks/use-reverse-geocode';
import {
  checkoutBlockers,
  orderTotals,
  toOrderInput,
  type CheckoutBlocker,
} from '@/services/api/order-view-model';
import {
  CUSTOM_ADDRESS_NAME,
  coordinatesDiffer,
  toPickedAddress,
} from '@/services/location/delivery-point';
import { formatDT, useCartStore } from '@/store/cart-store';
import { usePaymentMethodStore } from '@/store/payment-method-store';
import type { LocationCoords } from '@/types/location';
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
  // `pickedLatitude`/`pickedLongitude`/`pickedAddress` are set when the
  // full-screen picker sent a point back here — see `handleOpenMap`.
  const {
    id: restaurantId,
    pickedLatitude,
    pickedLongitude,
    pickedAddress,
  } = useLocalSearchParams<{
    id: string;
    pickedLatitude?: string;
    pickedLongitude?: string;
    pickedAddress?: string;
  }>();

  const [feeSheet, setFeeSheet] = useState<'service' | 'delivery' | null>(null);
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Where the customer dragged the inline map's pin, if they did. */
  const [draggedPoint, setDraggedPoint] = useState<LocationCoords | null>(null);
  /**
   * A point returned by the picker that has since been cancelled. The params
   * cannot be un-set from here, so dismissal is remembered by the point's own
   * identity — a later trip to the picker brings a different one, which is not
   * dismissed.
   */
  const [dismissedPickKey, setDismissedPickKey] = useState<string | null>(null);
  const [pointError, setPointError] = useState(false);

  const allItems = useCartStore((s) => s.items);
  const items = useMemo(
    () => allItems.filter((line) => line.restaurantId === restaurantId),
    [allItems, restaurantId]
  );

  const { customer, selected: selectedAddress, select } = useDeliveryAddress();
  const { data: restaurant } = useRestaurant(restaurantId);
  const saveAddresses = useSaveAddresses();
  const pickedName = useReverseGeocode();
  const paymentMethod = usePaymentMethodStore((s) => s.method);
  const setPaymentMethod = usePaymentMethodStore((s) => s.setMethod);
  const toImageSource = useStoredImageSource();

  const createOrder = useCreateOrder();

  // The address actually delivered to. `useDeliveryAddress` resolves the
  // selected entry, falling back to the customer's default (top-level
  // `address`) — which is the field the backend's populators dereference.
  const address = selectedAddress?.details ?? customer?.address ?? null;
  const phone = customer?.contact?.phones?.[0];

  const savedPoint: LocationCoords | null =
    typeof address?.coordinates?.latitude === 'number' &&
    typeof address?.coordinates?.longitude === 'number'
      ? {
          latitude: address.coordinates.latitude,
          longitude: address.coordinates.longitude,
        }
      : null;

  /**
   * A point handed back by the full-screen picker, as route params.
   *
   * DERIVED, not copied into state by an effect: the params are already the
   * source of truth, and mirroring them would mean a render showing the old
   * point before the effect corrected it.
   */
  const paramPoint = useMemo((): LocationCoords | null => {
    if (!pickedLatitude || !pickedLongitude) return null;
    const latitude = Number(pickedLatitude);
    const longitude = Number(pickedLongitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  }, [pickedLatitude, pickedLongitude]);

  const pickKey = paramPoint ? `${paramPoint.latitude},${paramPoint.longitude}` : null;

  // A drag beats a point carried in from the picker: it is the more recent
  // thing the customer did on this screen.
  const picked = draggedPoint ?? (pickKey !== dismissedPickKey ? paramPoint : null);

  /**
   * The point awaiting confirmation, or `null` when the pin is effectively on
   * the saved address.
   *
   * Comparing against the saved point — rather than tracking "is something
   * pending" separately — is what makes confirming self-clearing: once the
   * save lands, the customer record carries this point and there is nothing
   * left to confirm.
   */
  const pendingPoint = picked && coordinatesDiffer(picked, savedPoint) ? picked : null;

  // What the map looks at: the pending point while there is one, the saved
  // address otherwise. Cancelling therefore animates the card back.
  const shownPoint = pendingPoint ?? savedPoint;

  /**
   * The pending point's label. A dragged point is named by the geocoder here;
   * one returned by the picker arrives already named, and asking again would
   * spend a round-trip to be told the same thing.
   */
  const pendingText = draggedPoint ? pickedName.text : (pickedAddress ?? null);
  const isNamingPoint = draggedPoint ? pickedName.isResolving : false;

  /**
   * The map settled somewhere after a drag.
   *
   * A settle that lands back on the saved address drops the pending point
   * instead of offering to save it — panning away and back is a change of
   * mind, not a new address.
   */
  const handlePointChange = (coords: LocationCoords) => {
    // The map reports EVERY settle, including the ones it makes arriving where
    // this screen sent it — after a point comes back from the picker, or after
    // a cancel animates the camera home. Landing on the point already shown is
    // not the customer moving anything, and treating it as a drag would throw
    // away the label the picker resolved and pay for a second lookup.
    if (!coordinatesDiffer(coords, shownPoint)) return;

    setPointError(false);
    setDismissedPickKey(pickKey);

    if (!coordinatesDiffer(coords, savedPoint)) {
      setDraggedPoint(null);
      pickedName.reset();
      return;
    }

    setDraggedPoint(coords);
    void pickedName.describe(coords);
  };

  const handleCancelPoint = () => {
    setDraggedPoint(null);
    setDismissedPickKey(pickKey);
    setPointError(false);
    pickedName.reset();
  };

  const handleOpenMap = () => {
    // `checkoutRestaurantId` is what tells the picker to hand its point back
    // here rather than starting the add-an-address flow.
    router.push({
      pathname: '/map-select',
      params: { checkoutRestaurantId: restaurantId },
    });
  };

  /**
   * Writes the picked point to the customer record.
   *
   * It has to be saved to take effect at all: `OrderInput` carries no address,
   * so the backend delivers to the customer's top-level `address` (see
   * `services/location/delivery-point.ts`). It lands on its own `custom` entry
   * and becomes the selected address — never over the customer's saved Home.
   */
  const handleConfirmPoint = async () => {
    const keycloakUserId = customer?.keycloakUserId;
    if (!pendingPoint || !keycloakUserId || saveAddresses.isPending) return;

    setPointError(false);
    try {
      await saveAddresses.mutateAsync({
        keycloakUserId,
        addresses: [toPickedAddress(pendingPoint, pendingText ?? '')],
        defaultIndex: 0,
      });
      select(CUSTOM_ADDRESS_NAME);
      setDraggedPoint(null);
      setDismissedPickKey(pickKey);
      pickedName.reset();
    } catch {
      // The point stays pending and the row stays open: the customer can tap
      // again. Nothing about their saved addresses changed.
      setPointError(true);
    }
  };

  const restaurantName =
    restaurant?.name ?? items[0]?.restaurantName ?? 'Restaurant';
  const restaurantLogo =
    (restaurant?.logoUrl ? { uri: restaurant.logoUrl } : undefined) ??
    toImageSource(items[0]?.restaurantLogo);

  const itemCount = items.reduce((sum, line) => sum + line.quantity, 0);
  // Both fees are client-side placeholders — see `constants/fees.ts`. No price,
  // fee or total field exists anywhere on `Order` (plan §3.3), so none of this
  // is sent and none of it is charged.
  //
  // The arithmetic lives in `orderTotals` because these exact numbers are
  // captured as the order's receipt when it is placed, and shown back on the
  // order screen — computing them twice would let the two drift.
  const totals = orderTotals(items);

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
  // An unconfirmed point blocks the order on purpose: the map is showing one
  // place and the order would go to another, and which one the customer meant
  // is exactly what has not been answered yet.
  const canSubmit = blockers.length === 0 && !isSubmitting && !pendingPoint;

  const handleBlockerAction = () => {
    // An address problem routes to the flow that fixes it rather than showing
    // an error the customer can do nothing about — and the two problems have
    // different fixes. An address that exists but has no coordinates needs a
    // point on the map, not another form.
    if (blocker === 'no-address-coords') {
      handleOpenMap();
      return;
    }
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
        // The customer lands on My Orders, where the order they just placed is
        // now the top card — the emptied cart would show them nothing.
        onSuccess: () => router.replace('/orders'),
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
          <>
            <DeliveryLocationCard
              addressLabel={
                selectedAddress ? formatAddressName(selectedAddress.name) : 'Delivery'
              }
              addressText={address.formattedAddress ?? 'Address on file'}
              latitude={shownPoint?.latitude}
              longitude={shownPoint?.longitude}
              onPress={handleBlockerAction}
              onOpenMap={handleOpenMap}
              onPointChange={handlePointChange}
              pending={
                pendingPoint
                  ? {
                      text: pendingText,
                      isResolving: isNamingPoint,
                      isSaving: saveAddresses.isPending,
                    }
                  : null
              }
              onConfirmPending={handleConfirmPoint}
              onCancelPending={handleCancelPoint}
            />
            {pointError ? (
              <Text style={styles.pointError}>
                We couldn&apos;t save that delivery point. Your saved addresses
                are unchanged — tap Deliver here to try again.
              </Text>
            ) : null}
          </>
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
            <Text style={styles.priceValue}>{formatDT(totals.subtotal)}</Text>
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
            <Text style={styles.totalValue}>{formatDT(totals.total)}</Text>
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

        {/*
          The pin has been moved but not confirmed, so the map and the order
          disagree about where this is going. Say which tap resolves it rather
          than leaving a disabled button unexplained.
        */}
        {pendingPoint ? (
          <Text style={styles.blockerText}>
            Confirm the new delivery point above — tap Deliver here, or Cancel to
            keep your saved address.
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
  pointError: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
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
