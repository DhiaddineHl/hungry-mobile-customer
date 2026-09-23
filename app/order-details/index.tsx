import { OrderSummary } from '@/components/cart';
import { DeliveryFeeModal, PaymentMethodModal, ServiceFeeModal } from '@/components/checkout';
import { DeliveryLocationCard, OrderInfoRow, OrderRestaurantRow } from '@/components/order';
import { PressableScale } from '@/components/ui/pressable-scale';
import { paymentMethodLabel } from '@/constants/payment-methods';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useActiveCart, useIsCartUpdating, useUpdateCheckoutOptions } from '@/hooks/use-cart';
import { useCartArtwork } from '@/hooks/use-cart-artwork';
import { useCheckout } from '@/hooks/use-checkout';
import { formatAddressName, useDeliveryAddress } from '@/hooks/use-delivery-address';
import { useReverseGeocode } from '@/hooks/use-reverse-geocode';
import { blockerMessage, discountPromotions, groupCartByRestaurant } from '@/services/api/cart-view-model';
import { blockersOf } from '@/services/api/checkout-service';
import { formatDT } from '@/services/api/money';
import {
  coordinatesDiffer,
  toOrderDeliveryAddress,
} from '@/services/location/delivery-point';
import { usePaymentMethodStore } from '@/store/payment-method-store';
import type { LocationCoords } from '@/types/location';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ArrowLeft, DollarSign, Phone } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Checkout for the WHOLE cart. No route param: there is one cart, and the
 * orders do not exist until the customer taps Continue.
 *
 * The cart is the server's, and so is every figure here: the summary shows
 * the fees, discounts and totals the backend calculated, and "Continue to
 * Checkout" is a single `POST /checkout` with NO parameters — the server turns
 * the cart into one order per restaurant, atomically. What the customer decides
 * on this screen (the delivery point, the payment method) is written to the
 * cart as it changes, so the server prices the delivery from the address the
 * customer actually sees and the checkout reads it back from the cart.
 *
 * There is no partial failure to handle: either every restaurant's order is
 * created or none is. A failed attempt leaves the cart as it was and offers a
 * MANUAL retry — nothing here retries on its own, because a create that
 * reached the database dispatches a driver and a duplicate order is a
 * duplicate delivery.
 *
 * Two things an earlier mock showed are deliberately GONE rather than
 * re-sourced:
 *
 *   - the estimated time and arrival time. No ETA, prep-time or estimate field
 *     exists anywhere in the backend, so following RESTO-01's `UNBACKED_FIELDS`
 *     convention the rows render nothing instead of an invented number;
 *   - the totals row's `Delivery Fee` label, which named the row above it while
 *     showing the total. It reads `Total`.
 */

/** What the customer can do about a blocker: only the address ones have a fix on this screen. */
const BLOCKER_ACTIONS: Record<string, string> = {
  NO_DELIVERY_ADDRESS: 'Add address',
  NO_ADDRESS_COORDINATES: 'Set on map',
};

/**
 * The slice of the navigation object `goToPlacedOrder` needs: one stack reset,
 * with a nested state for the tab navigator underneath.
 */
type ResettableNavigation = {
  reset: (state: {
    index: number;
    routes: { name: string; state?: { index: number; routes: { name: string }[] } }[];
  }) => void;
};

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  // The root stack, for the post-checkout reset in `goToPlacedOrder`; `router`
  // has no equivalent of a reset. Typed structurally for the one method used:
  // the default generic keys route names off `ReactNavigation.RootParamList`,
  // which this app never augments, so `keyof` it is `never` and every name is
  // rejected.
  const navigation = useNavigation<ResettableNavigation>();
  // `pickedLatitude`/`pickedLongitude`/`pickedAddress` are set when the
  // full-screen picker sent a point back here — see `handleOpenMap`.
  const { pickedLatitude, pickedLongitude, pickedAddress } = useLocalSearchParams<{
    pickedLatitude?: string;
    pickedLongitude?: string;
    pickedAddress?: string;
  }>();

  const [feeSheet, setFeeSheet] = useState<'service' | 'delivery' | null>(null);
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);
  /**
   * The last checkout attempt's failure, if any. Nothing was placed when it
   * failed — the checkout is atomic — so the cart is exactly as it was.
   */
  const [failure, setFailure] = useState<Error | null>(null);
  /**
   * A delivery point the customer confirmed for THIS cart — dragged or picked,
   * then "Deliver here". It is written to the cart (see the sync effect below)
   * so the server prices the delivery from it and places the orders there, and
   * it is never added to the customer's saved addresses. Restored from the cart
   * when the screen opens, so a point picked earlier is not forgotten.
   */
  const [customPoint, setCustomPoint] = useState<{
    coords: LocationCoords;
    text: string;
  } | null>(null);
  /** Where the customer dragged the inline map's pin, if they did. */
  const [draggedPoint, setDraggedPoint] = useState<LocationCoords | null>(null);
  /**
   * A point returned by the picker that has since been cancelled. The params
   * cannot be un-set from here, so dismissal is remembered by the point's own
   * identity — a later trip to the picker brings a different one, which is not
   * dismissed.
   */
  const [dismissedPickKey, setDismissedPickKey] = useState<string | null>(null);

  // The cart, as the server last calculated it. One group per restaurant — and
  // one order per group, in this order.
  const { data: cart } = useActiveCart();
  const groups = useMemo(() => groupCartByRestaurant(cart), [cart]);
  const artwork = useCartArtwork(cart);
  const isUpdating = useIsCartUpdating();
  const { mutate: syncCheckoutOptions } = useUpdateCheckoutOptions();

  const { customer, selected: selectedAddress } = useDeliveryAddress();
  const pickedName = useReverseGeocode();
  const paymentMethod = usePaymentMethodStore((s) => s.method);
  const setPaymentMethod = usePaymentMethodStore((s) => s.setMethod);

  const checkout = useCheckout();

  // The saved address this order would go to by default. `useDeliveryAddress`
  // resolves the selected entry, falling back to the customer's default
  // (top-level `address`) — which is what the backend snapshots onto the order
  // when no `deliveryAddress` is sent.
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
   * Where the order goes as things stand: the confirmed custom point if there
   * is one, the saved address otherwise. Everything below — the map, the
   * pending comparison, the blockers, the payload — reads THIS, so a confirmed
   * custom point behaves exactly like a saved address would, minus the saving.
   */
  const basePoint = customPoint?.coords ?? savedPoint;
  const deliveryAddress = customPoint
    ? toOrderDeliveryAddress(customPoint.coords, customPoint.text)
    : null;

  // ---- Keeping the cart's checkout options in step with what the customer sees ----
  //
  // The delivery point and the payment method are part of the CART, not of the
  // checkout call (which takes no parameters). Delivery fees depend on the
  // address, so a change is written the moment it is made and the recalculated
  // cart comes back with the new fees; the customer never sees a price for an
  // address other than the one on the map.

  /**
   * Restores a point picked earlier in this cart, once, before anything is
   * written back. Done while rendering (guarded, so it runs a single time)
   * rather than in an effect: the restored point and the "restored" flag land
   * in the same render, so the write-back effect below never sees one without
   * the other and cannot clear the server's point before it is restored.
   */
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && cart) {
    setHydrated(true);
    const point = cart.deliveryAddress?.coordinates;
    if (typeof point?.latitude === 'number' && typeof point?.longitude === 'number') {
      setCustomPoint({
        coords: { latitude: point.latitude, longitude: point.longitude },
        text: cart.deliveryAddress?.formattedAddress ?? '',
      });
    }
  }

  /** The point (rounded) and payment method as the cart holds them, and as the customer has them. */
  const pointKey = (lat?: number | null, lng?: number | null) =>
    typeof lat === 'number' && typeof lng === 'number' ? `${lat.toFixed(5)},${lng.toFixed(5)}` : '';
  const desiredKey = `${pointKey(customPoint?.coords.latitude, customPoint?.coords.longitude)}|${paymentMethod}`;
  const serverKey = cart
    ? `${pointKey(cart.deliveryAddress?.coordinates?.latitude, cart.deliveryAddress?.coordinates?.longitude)}|${cart.paymentMethod ?? ''}`
    : null;
  /** False from the moment the customer changes something until the server's cart reflects it. */
  const optionsInSync = hydrated && serverKey === desiredKey;

  // The last thing sent, so a failed write is not retried in a loop by the effect re-running.
  const lastSentKey = useRef<string | null>(null);
  useEffect(() => {
    if (!cart || !hydrated || isUpdating) return;
    if (serverKey === desiredKey) {
      lastSentKey.current = null;
      return;
    }
    if (lastSentKey.current === desiredKey) return;
    lastSentKey.current = desiredKey;
    syncCheckoutOptions({
      deliveryAddress,
      paymentMethod,
      // Not edited on this screen; carried through because the write replaces all four.
      comment: cart.comment ?? null,
      couponCode: cart.couponCode ?? null,
    });
    // `deliveryAddress` is derived from `customPoint`, which `desiredKey` already covers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, hydrated, isUpdating, desiredKey, serverKey, paymentMethod, syncCheckoutOptions]);

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
   * the current delivery point.
   *
   * Comparing against the base point — rather than tracking "is something
   * pending" separately — is what makes confirming self-clearing: once
   * confirmed, the point IS the base and there is nothing left to confirm.
   */
  const pendingPoint = picked && coordinatesDiffer(picked, basePoint) ? picked : null;

  // What the map looks at: the pending point while there is one, the current
  // delivery point otherwise. Cancelling therefore animates the card back.
  const shownPoint = pendingPoint ?? basePoint;

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
   * A settle that lands back on the current delivery point drops the pending
   * point instead of offering to confirm it — panning away and back is a
   * change of mind, not a new address. Landing back on the SAVED address while
   * a custom point is confirmed reverts to the saved address outright: that is
   * the customer putting the pin back where it started.
   */
  const handlePointChange = (coords: LocationCoords) => {
    // The map reports EVERY settle, including the ones it makes arriving where
    // this screen sent it — after a point comes back from the picker, or after
    // a cancel animates the camera home. Landing on the point already shown is
    // not the customer moving anything, and treating it as a drag would throw
    // away the label the picker resolved and pay for a second lookup.
    if (!coordinatesDiffer(coords, shownPoint)) return;

    setDismissedPickKey(pickKey);

    if (!coordinatesDiffer(coords, savedPoint)) {
      setCustomPoint(null);
      setDraggedPoint(null);
      pickedName.reset();
      return;
    }

    if (!coordinatesDiffer(coords, basePoint)) {
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
    pickedName.reset();
  };

  const handleOpenMap = () => {
    // `returnToCheckout` is what tells the picker to hand its point back here
    // rather than starting the add-an-address flow.
    router.push({
      pathname: '/map-select',
      params: { returnToCheckout: '1' },
    });
  };

  /**
   * Makes the picked point THIS order's delivery address.
   *
   * Nothing is written anywhere: the point is held on this screen and sent
   * with the order as its own `deliveryAddress`. The customer's saved
   * addresses are untouched — a one-off delivery point is not a new "Home",
   * and this is exactly why the order carries an address of its own.
   */
  const handleConfirmPoint = () => {
    if (!pendingPoint) return;

    // Confirming a point that sits on the saved address is a return to it, not
    // a custom point that happens to coincide with it.
    setCustomPoint(
      coordinatesDiffer(pendingPoint, savedPoint)
        ? { coords: pendingPoint, text: pendingText ?? '' }
        : null
    );
    setDraggedPoint(null);
    setDismissedPickKey(pickKey);
    pickedName.reset();
  };

  /**
   * Each restaurant as the order rows see it: the name and logo the cart already
   * carries, so the rows never flash a placeholder while a picture loads.
   */
  const restaurants = groups.map((group) => ({
    id: group.restaurantId,
    name: group.restaurantName,
    logo: artwork.logoOf(group.restaurantId),
    itemCount: group.totalQuantity,
  }));
  const orderCount = groups.length;

  /**
   * Why the order cannot be placed yet. The server decides (an empty cart, no
   * delivery address, an address without coordinates, a restaurant that cannot
   * be delivered from) and says so on the cart; this screen only adds the two
   * things it alone knows — the account or the cart is still loading.
   */
  const blocker: string | undefined = !customer?.id
    ? 'LOADING_ACCOUNT'
    : cart
      ? cart.blockers[0]
      : 'LOADING_CART';
  const blockerText =
    blocker === 'LOADING_ACCOUNT'
      ? 'Loading your account…'
      : blocker === 'LOADING_CART'
        ? 'Loading your cart…'
        : blocker
          ? blockerMessage(blocker)
          : null;
  const blockerAction = blocker ? BLOCKER_ACTIONS[blocker] : undefined;

  const isSubmitting = checkout.isPending;
  // An unconfirmed point blocks the order on purpose: the map is showing one
  // place and the order would go to another, and which one the customer meant
  // is exactly what has not been answered yet. So does a change the server has
  // not answered: the summary above would still be pricing the old address.
  const canSubmit =
    !blocker && !isSubmitting && !pendingPoint && !isUpdating && optionsInSync;

  const handleBlockerAction = () => {
    // An address problem routes to the flow that fixes it rather than showing
    // an error the customer can do nothing about — and the two problems have
    // different fixes. An address that exists but has no coordinates needs a
    // point on the map, not another form.
    if (blocker === 'NO_ADDRESS_COORDINATES') {
      handleOpenMap();
      return;
    }
    router.push('/address-info');
  };

  /**
   * Where the customer lands once the order exists: My Orders, sitting on the
   * Home tab.
   *
   * Placing the order empties the cart, which turns every screen behind this
   * one into a dead end — Back from My Orders used to reach the cart page for
   * a cart that no longer had anything in it. So the whole checkout branch is
   * discarded rather than navigated away from, and Home takes its place
   * underneath: it is where someone who just ordered would go next.
   *
   * One `reset` rather than a dismissAll/replace/push sequence, because those
   * are resolved against expo-router's store state, which does not update
   * between dispatches in the same tick — the second call would compute its
   * target from the stack as it was before the first one landed. The route
   * names come straight from the Stack/Tabs declarations in the layouts.
   *
   * `navigation.reset`, not a dispatched CommonActions.reset: as of SDK 56
   * expo-router vendors React Navigation and the bundler rejects importing
   * `@react-navigation/*` directly. The whole navigation API is on this object.
   */
  const goToPlacedOrder = () => {
    navigation.reset({
      index: 1,
      routes: [
        { name: '(tabs)', state: { index: 0, routes: [{ name: 'index' }] } },
        { name: 'orders/index' },
      ],
    });
  };

  const handleContinueCheckout = () => {
    if (!canSubmit) return;

    setFailure(null);
    // No parameters: the server places the orders from the cart it holds.
    checkout.mutate(undefined, {
      // The orders are seeded into the cache by the mutation itself, and the
      // customer lands on My Orders, where they are the top cards.
      onSuccess: goToPlacedOrder,
      onError: (error) => setFailure(error),
    });
  };

  /**
   * What to say about a failed attempt. Nothing was placed — the checkout is
   * atomic — so the cart is exactly as it was and Try Again is safe. A refusal
   * that names a blocker says what to fix instead.
   */
  const failureMessage = (() => {
    if (!failure) return null;
    const blockers = blockersOf(failure);
    if (blockers.length > 0) return blockerMessage(blockers[0]);
    return orderCount > 1
      ? "We couldn't place your orders. Nothing was ordered and your cart is untouched — tap Try Again."
      : "We couldn't place your order. Nothing was ordered and your cart is untouched — tap Try Again.";
  })();

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
        {address || customPoint ? (
          <DeliveryLocationCard
            addressLabel={
              customPoint
                ? 'Custom location'
                : selectedAddress
                  ? formatAddressName(selectedAddress.name)
                  : 'Delivery'
            }
            addressText={
              customPoint
                ? deliveryAddress!.formattedAddress
                : (address?.formattedAddress ?? 'Address on file')
            }
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
                    isSaving: false,
                  }
                : null
            }
            onConfirmPending={handleConfirmPoint}
            onCancelPending={handleCancelPoint}
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

        <Text style={styles.summarySectionTitle}>
          {orderCount > 1 ? `Order Summary · ${orderCount} orders` : 'Order Summary'}
        </Text>

        {orderCount > 1 ? (
          <Text style={styles.splitNote}>
            Each restaurant prepares and delivers separately, so this checkout
            places {orderCount} orders — each with its own delivery fee; the
            service fee is shared between them.
          </Text>
        ) : null}

        {restaurants.map((restaurant) =>
          restaurant.logo ? (
            <OrderRestaurantRow
              key={restaurant.id}
              name={restaurant.name}
              itemCount={restaurant.itemCount}
              logo={restaurant.logo}
              onPress={() => router.push('/cart/review')}
            />
          ) : null
        )}

        {cart ? (
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
            updating={isUpdating || !optionsInSync}
            onServiceFeeInfo={() => setFeeSheet('service')}
            onDeliveryFeeInfo={() => setFeeSheet('delivery')}
          />
        ) : (
          <View style={styles.summaryLoading}>
            <ActivityIndicator color={Palette.primary} />
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/*
          A failed create is stated plainly and retried only by hand. The
          server's own message says nothing a customer can act on, and an
          automatic retry could put a second driver on the road.
        */}
        {failureMessage ? (
          <Text style={styles.errorText}>{failureMessage}</Text>
        ) : null}

        {/*
          The pin has been moved but not confirmed, so the map and the order
          disagree about where this is going. Say which tap resolves it rather
          than leaving a disabled button unexplained.
        */}
        {pendingPoint ? (
          <Text style={styles.blockerText}>
            Confirm the new delivery point above — tap Deliver here, or Cancel to
            keep the current one.
          </Text>
        ) : null}

        {/*
          Said once, where the decision is made: a custom point is for this
          order only. Otherwise a customer who expected it under their saved
          addresses next time would think the app lost it.
        */}
        {customPoint && !pendingPoint ? (
          <Text style={styles.blockerText}>
            This order will be delivered to the custom location above. It
            won&apos;t be added to your saved addresses.
          </Text>
        ) : null}

        {blockerText ? (
          <View style={styles.blockerRow}>
            <Text style={styles.blockerText}>{blockerText}</Text>
            {blockerAction ? (
              <TouchableOpacity onPress={handleBlockerAction} hitSlop={8}>
                <Text style={styles.blockerAction}>{blockerAction}</Text>
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
              {failure ? 'Try Again' : 'Continue to Checkout'}
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
  splitNote: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
    lineHeight: 18,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  summaryLoading: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
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
