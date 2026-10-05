import { DeliveryFeeModal, PaymentMethodModal, ServiceFeeModal } from '@/components/checkout';
import { DeliveryLocationCard, OrderInfoRow, OrderRestaurantRow } from '@/components/order';
import { PressableScale } from '@/components/ui/pressable-scale';
import { paymentMethodLabel } from '@/constants/payment-methods';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { formatAddressName, useDeliveryAddress } from '@/hooks/use-delivery-address';
import { useCheckoutQuote, usePlaceCheckout } from '@/hooks/use-orders';
import { useStoredImageSource } from '@/hooks/use-restaurant-image';
import { restaurantQueryOptions } from '@/hooks/use-restaurants';
import { useReverseGeocode } from '@/hooks/use-reverse-geocode';
import type { CartCheckoutOptionsInput } from '@/schemas/cart';
import { CheckoutNotReadyError } from '@/services/api/cart-service';
import { toCheckoutBlocker, type CheckoutBlocker } from '@/services/api/cart-view-model';
import {
  coordinatesDiffer,
  toOrderDeliveryAddress,
} from '@/services/location/delivery-point';
import { formatDT, groupByRestaurant, useCartStore } from '@/store/cart-store';
import { usePaymentMethodStore } from '@/store/payment-method-store';
import type { LocationCoords } from '@/types/location';
import { useQueries } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ArrowLeft, DollarSign, Info, Phone } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Checkout for the WHOLE cart. No route param: there is one cart, and the
 * orders do not exist until the customer taps Continue.
 *
 * ONE cart, ONE order PER RESTAURANT. The backend `Order` has a single
 * `restaurant`, so `POST /checkout` turns a cart drawn from three restaurants
 * into three orders — in one transaction, all or none. All of them go to the
 * same delivery point and carry the same payment method; each has its own
 * delivery fee, and the service fee is split across them.
 *
 * Every price on this screen is the BACKEND's (`useCheckoutQuote`): the delivery
 * address and payment method are written onto the server cart, which answers
 * re-priced from the fee rules — a per-km delivery fee moves with the address.
 * What is shown is what `POST /checkout` charges. The restaurants come from
 * `restaurantQueryOptions`, the address and phone from the customer record,
 * the payment method from its store.
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
 * A failed checkout leaves the cart completely intact and offers a MANUAL
 * retry. Nothing here retries on its own: a checkout that reached the database
 * enqueues drivers, so a duplicate order is a duplicate delivery (plan §3.6).
 */

/**
 * What to tell the customer, and where to send them, for each blocker — the
 * app's own preflight and the backend cart's `blockers` alike.
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
  'no-restaurant-coords': {
    message: 'This restaurant has no map location yet, so it cannot be delivered from.',
  },
  'empty-cart': { message: 'Your cart is empty.' },
  unknown: { message: "This cart can't be checked out yet." },
};

/** The blockers whose fix is the address flow rather than an error message. */
const ADDRESS_BLOCKERS: CheckoutBlocker[] = ['no-address', 'no-address-coords'];

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
   * The last checkout attempt's failure, if any. Nothing was placed then — the
   * backend creates every order or none — so the cart is exactly as it was.
   */
  const [failure, setFailure] = useState<Error | null>(null);
  /**
   * A delivery point the customer confirmed for THIS order — dragged or picked,
   * then "Deliver here". Screen state only: it is sent with the order as its
   * own `deliveryAddress` and is never written to the customer's saved
   * addresses. Leaving the screen forgets it, which is right for a one-off.
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

  const items = useCartStore((s) => s.items);
  // One group per restaurant — and one order per group, in this order.
  const groups = useMemo(() => groupByRestaurant(items), [items]);

  const { customer, selected: selectedAddress } = useDeliveryAddress();
  // Every restaurant in the cart, for its coordinates (a preflight blocker)
  // and its logo. One query each; the number is small and they run together.
  const restaurantQueries = useQueries({
    queries: groups.map((group) => restaurantQueryOptions(group.restaurantId)),
  });
  const pickedName = useReverseGeocode();
  const paymentMethod = usePaymentMethodStore((s) => s.method);
  const setPaymentMethod = usePaymentMethodStore((s) => s.setMethod);
  const toImageSource = useStoredImageSource();

  const placeCheckout = usePlaceCheckout(customer?.id);

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
   * pending comparison, the blockers, the checkout options — reads THIS, so a confirmed
   * custom point behaves exactly like a saved address would, minus the saving.
   */
  const basePoint = customPoint?.coords ?? savedPoint;
  const deliveryAddress = customPoint
    ? toOrderDeliveryAddress(customPoint.coords, customPoint.text)
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
   * Each restaurant as the order rows and the payload see it: the fetched
   * detail when it has arrived, the cart's own copy of the name and logo
   * meanwhile, so the rows never flash a placeholder.
   */
  const restaurants = groups.map((group, index) => {
    const query = restaurantQueries[index];
    const detail = query?.data ?? null;
    return {
      id: group.restaurantId,
      /** Still being fetched — not yet known to lack coordinates. */
      isLoading: !!query?.isPending,
      name: detail?.name ?? group.restaurantName ?? 'Restaurant',
      logo:
        (detail?.logoUrl ? { uri: detail.logoUrl } : undefined) ??
        toImageSource(group.restaurantLogo),
      coordinates: detail?.coordinates ?? null,
      itemCount: group.totalQuantity,
      lines: group.items,
    };
  });
  const orderCount = groups.length;

  /**
   * What the server cart is checked out with: this screen's delivery point
   * (a confirmed custom point, else the selected saved address — `null` means
   * the customer's default) and payment method. Writing them re-prices the
   * cart, so the price block below always matches the address on the map.
   */
  const checkoutOptions: CartCheckoutOptionsInput = {
    deliveryAddress: deliveryAddress ?? selectedAddress?.details ?? null,
    paymentMethod,
    comment: null,
    couponCode: null,
  };
  const quoteQuery = useCheckoutQuote(customer?.id, checkoutOptions);
  // A placeholder is the previous address's price, kept on screen while the
  // new one is computed — never something to check out on.
  const quote = quoteQuery.data ?? null;
  const isRepricing = quoteQuery.isPlaceholderData || quoteQuery.isFetching;

  /**
   * The app's own preflight — instant, and it routes each problem to its fix —
   * followed by whatever else the backend cart reports.
   */
  const blockers: CheckoutBlocker[] = [];
  if (!customer?.id) blockers.push('no-customer');
  const target = deliveryAddress ?? address;
  if (!target) {
    blockers.push('no-address');
  } else if (
    typeof target.coordinates?.latitude !== 'number' ||
    typeof target.coordinates?.longitude !== 'number'
  ) {
    blockers.push('no-address-coords');
  }
  if (orderCount === 0) blockers.push('empty-cart');
  if (quote && !quoteQuery.isPlaceholderData) {
    for (const name of quote.blockers) {
      const mapped = toCheckoutBlocker(name);
      if (!blockers.includes(mapped)) blockers.push(mapped);
    }
  }

  const blocker = blockers[0];
  const blockedRestaurant =
    blocker === 'no-restaurant-coords' && orderCount > 1
      ? restaurants.find((restaurant) => !restaurant.isLoading && !restaurant.coordinates)
      : null;
  const blockerCopy = blocker
    ? {
        ...BLOCKER_COPY[blocker],
        message: blockedRestaurant
          ? `${blockedRestaurant.name} has no map location yet, so it cannot be delivered from.`
          : BLOCKER_COPY[blocker].message,
      }
    : null;
  const needsAddress = !!blocker && ADDRESS_BLOCKERS.includes(blocker);

  const isSubmitting = placeCheckout.isPending;
  // An unconfirmed point blocks the order on purpose: the map is showing one
  // place and the order would go to another, and which one the customer meant
  // is exactly what has not been answered yet. And no price, no order: the
  // customer checks out on the total they were shown.
  const canSubmit =
    blockers.length === 0 && !isSubmitting && !pendingPoint && !!quote && !isRepricing;

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
    placeCheckout.mutate(checkoutOptions, {
      // The cart is emptied inside the mutation itself, never here: it must
      // happen whether or not this screen is still mounted. The customer lands
      // on My Orders, where the orders they just placed are the top cards.
      onSuccess: goToPlacedOrder,
      onError: (error) => {
        setFailure(error);
        // The cart may have changed server-side (a restaurant lost its
        // location, a price moved): price it again before the next attempt.
        void quoteQuery.refetch();
      },
    });
  };

  /** What to say about a failed attempt. Nothing was placed; the cart is untouched. */
  const failureMessage = (() => {
    if (!failure) return null;
    if (failure instanceof CheckoutNotReadyError) {
      const first = failure.blockers.map(toCheckoutBlocker)[0] ?? 'unknown';
      return BLOCKER_COPY[first].message;
    }
    return orderCount > 1
      ? "We couldn't place your orders. Your cart is untouched — tap Try Again."
      : "We couldn't place your order. Your cart is untouched — tap Try Again.";
  })();

  const quoteMessage = quote
    ? isRepricing
      ? 'Updating prices…'
      : !quote.deliveryPriced
        ? 'The delivery fee is calculated once your delivery point is set.'
        : null
    : quoteQuery.isError
      ? "We couldn't load the prices for this cart."
      : 'Calculating prices…';

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
            places {orderCount} orders — each with its own delivery fee.
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

        <View style={styles.pricingCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Subtotal</Text>
            <Text style={styles.priceValue}>{quote ? formatDT(quote.subtotal) : '—'}</Text>
          </View>

          {quote && quote.discountTotal > 0 ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Discount</Text>
              <Text style={styles.priceValue}>−{formatDT(quote.discountTotal)}</Text>
            </View>
          ) : null}

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
            <Text style={styles.priceValue}>{quote ? formatDT(quote.serviceFee) : '—'}</Text>
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
              {quote && quote.deliveryPriced && quote.deliveryFee === 0 ? (
                <View style={styles.freeBadge}>
                  <Text style={styles.freeText}>Free</Text>
                </View>
              ) : (
                <Text style={styles.priceValue}>
                  {quote && quote.deliveryPriced ? formatDT(quote.deliveryFee) : '—'}
                </Text>
              )}
            </View>
          </View>

          {/* Situational fees (night, bad weather…) — labelled by their fee rule. */}
          {quote?.additionalFees.map((fee) => (
            <View key={fee.code ?? fee.label} style={styles.priceRow}>
              <Text style={styles.priceLabel}>{fee.label}</Text>
              <Text style={styles.priceValue}>{formatDT(fee.amount)}</Text>
            </View>
          ))}

          <View style={styles.totalDivider} />

          <View style={styles.priceRow}>
            {/* Reads `Total`. The old label said `Delivery Fee` while showing
                the total, which named the row above it. */}
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{quote ? formatDT(quote.total) : '—'}</Text>
          </View>

          {quoteMessage ? (
            <View style={styles.blockerRow}>
              <Text style={styles.blockerText}>{quoteMessage}</Text>
              {quoteQuery.isError && !quote ? (
                <TouchableOpacity onPress={() => void quoteQuery.refetch()} hitSlop={8}>
                  <Text style={styles.blockerAction}>Retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {/*
          A failed checkout is stated plainly and retried only by hand: an
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
