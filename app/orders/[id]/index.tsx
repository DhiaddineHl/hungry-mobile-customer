import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Card,
  InfoNote,
  InfoRow,
  PrimaryButton,
  RestaurantGroupHeader,
  Screen,
  Separated,
  Skeleton,
  StateView,
  SummaryLine,
  Text,
  TopBar,
  Touchable,
} from '@/components/ds';
import { DriverInfoCard } from '@/components/order/driver-info-card';
import { OrderLineRow } from '@/components/order/order-line-row';
import { OrderProgress } from '@/components/order/order-progress';
import { OrderStatusChip } from '@/components/order/order-status-chip';
import { useCustomerOrder } from '@/hooks/use-customer-orders';
import { useOrderDelivery } from '@/hooks/use-order-delivery';
import { useMenuUnitPrices } from '@/hooks/use-products';
import { useRestaurantImageSource } from '@/hooks/use-restaurant-image';
import { useRestaurant } from '@/hooks/use-restaurants';
import { isTrackable } from '@/services/api/driver-location-view-model';
import {
  formatOrderDateTime,
  orderBucket,
  orderProgressStep,
  orderStatusLabel,
  withDeliveryStatus,
} from '@/services/api/order-list-view-model';
import { priceOrder } from '@/services/api/order-price-view-model';
import { formatDT } from '@/store/cart-store';
import { useOrderPriceSnapshot } from '@/store/order-price-store';
import { createStyles, useTheme } from '@/theme';

/**
 * One order, read from `GET /orders/{id}` and polled while in progress.
 *
 * Read-only, like the list: the only action is "Order again", which opens the
 * restaurant's menu — it does not re-submit anything, because a create
 * enqueues a real delivery.
 *
 * Prices come from the order itself — line prices and the fees it was placed
 * with. An older order falls back to the receipt this device kept, then to
 * today's menu prices, labelled as such (`order-price-view-model.ts`).
 */
export default function CustomerOrderDetailsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { order: baseOrder, isLoading, isRefetching, isMissing, error, refetch } = useCustomerOrder(id);
  const { data: restaurant } = useRestaurant(baseOrder?.restaurantId);
  const imageSource = useRestaurantImageSource();
  const { delivery, status: deliveryStatus } = useOrderDelivery(baseOrder?.id);

  // The order closes (`FINISHED`) at pickup — after that it is the delivery's
  // to say, so the two are read together (`orderStage`).
  const order = useMemo(
    () => (baseOrder ? withDeliveryStatus(baseOrder, deliveryStatus) : null),
    [baseOrder, deliveryStatus],
  );

  // The legacy receipt, for an order this device placed before checkout moved
  // to the backend. Orders placed since carry their own price block.
  const snapshot = useOrderPriceSnapshot(order?.id);

  // Only when neither the backend nor a receipt prices the lines.
  const needsMenuPrices =
    !order?.charges?.itemized && !snapshot && (order?.lines ?? []).some((line) => line.unitPrice == null);
  const productIds = useMemo(
    () =>
      needsMenuPrices
        ? (order?.lines ?? []).map((line) => line.productId).filter((productId): productId is string => !!productId)
        : [],
    [order?.lines, needsMenuPrices],
  );
  const menuUnitPrices = useMenuUnitPrices(productIds);

  const pricing = useMemo(
    () => priceOrder({ lines: order?.lines ?? [], charges: order?.charges, snapshot, menuUnitPrices }),
    [order?.lines, order?.charges, snapshot, menuUnitPrices],
  );

  if (isLoading) {
    return (
      <Screen>
        <TopBar title="Order" onBack={() => router.back()} />
        <View style={styles.content}>
          <Skeleton height={72} radius={20} />
          <Skeleton height={110} radius={20} />
          <Skeleton height={180} radius={20} />
        </View>
      </Screen>
    );
  }

  if (error || !order || isMissing) {
    return (
      <Screen>
        <TopBar title="Order" onBack={() => router.back()} />
        {error ? (
          <StateView
            icon="offline"
            title="Couldn't load this order"
            body="Check your connection, then try again."
            actions={[{ label: 'Try again', onPress: () => refetch() }]}
          />
        ) : (
          <StateView icon="noResults" title="Order not found" body="This order is no longer available." />
        )}
      </Screen>
    );
  }

  const isActive = orderBucket(order) === 'active';
  const trackable = isTrackable(delivery?.status);

  return (
    <Screen>
      <TopBar title={`Order ${order.reference}`} onBack={() => router.back()} />
      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.ink} />}
      >
        <Card padded>
          <RestaurantGroupHeader
            logo={restaurant?.logoUrl ? imageSource(restaurant.logoUrl) : undefined}
            name={restaurant?.name ?? order.restaurantName}
            meta={formatOrderDateTime(order.createdAt)}
            trailing={<OrderStatusChip order={order} />}
            onPress={order.restaurantId ? () => router.push(`/restaurant/${order.restaurantId}`) : undefined}
          />
        </Card>

        {isActive ? (
          <Card padded style={styles.gap}>
            <OrderProgress step={orderProgressStep(order)} statusLabel={orderStatusLabel(order)} />
            <Text variant="caption" color="inkMuted">
              Updates as the restaurant and your driver move the order along. Pull down to refresh.
            </Text>
          </Card>
        ) : null}

        {isActive && order.status !== 'CREATED' ? (
          trackable ? (
            // From the accept to the drop-off the driver can be followed live.
            <Touchable
              onPress={() => router.push(`/orders/${order.id}/track`)}
              scaleTo={0.99}
              accessibilityLabel="Track your driver on the map"
              accessibilityHint="Opens a live map of your driver"
            >
              <Card padded>
                <DriverInfoCard
                  status={delivery?.status ?? null}
                  driverName={delivery?.driverName ?? null}
                  driverRating={delivery?.driverRating ?? null}
                  trackable
                />
              </Card>
            </Touchable>
          ) : (
            <Card padded>
              <DriverInfoCard
                status={delivery?.status ?? null}
                driverName={delivery?.driverName ?? null}
                driverRating={delivery?.driverRating ?? null}
              />
            </Card>
          )
        ) : null}

        <Card padded style={styles.gap}>
          <Text variant="sectionTitle" accessibilityRole="header">
            Items
          </Text>
          {order.hasLineDetail ? (
            <Separated>
              {order.lines.map((line) => {
                const price = pricing.byLine.get(line.id);
                return (
                  <OrderLineRow
                    key={line.id}
                    line={line}
                    total={price?.total != null ? formatDT(price.total) : undefined}
                    unit={price?.unit != null ? formatDT(price.unit) : undefined}
                  />
                );
              })}
            </Separated>
          ) : (
            // An empty list is NOT an empty order: the backend never sets the
            // `order_item.order_id` back-reference on a re-read.
            <Text variant="meta" color="inkMuted">
              {"The items for this order aren't available. The restaurant has them."}
            </Text>
          )}

          {pricing.totals ? (
            <View style={styles.totals}>
              <View style={styles.rule} />
              <SummaryLine label="Subtotal" value={formatDT(pricing.totals.subtotal)} />
              {pricing.totals.discount > 0 ? (
                <SummaryLine label="Discount" value={`−${formatDT(pricing.totals.discount)}`} valueColor="success" />
              ) : null}
              <SummaryLine label="Service" value={formatDT(pricing.totals.serviceFee)} />
              <SummaryLine
                label="Delivery"
                value={pricing.totals.deliveryFee === 0 ? 'Free' : formatDT(pricing.totals.deliveryFee)}
                valueColor={pricing.totals.deliveryFee === 0 ? 'success' : undefined}
              />
              {pricing.totals.additionalFees > 0 ? (
                <SummaryLine label="Additional fees" value={formatDT(pricing.totals.additionalFees)} />
              ) : null}
              <View style={styles.rule} />
              <SummaryLine label="Total" value={formatDT(pricing.totals.total)} total />
            </View>
          ) : null}

          {/* Today's prices for an older order with no receipt — not what was
              charged, so it says so. */}
          {pricing.source === 'menu' ? (
            <>
              {pricing.itemsTotal != null ? (
                <View style={styles.totals}>
                  <View style={styles.rule} />
                  <SummaryLine label="Items total" value={formatDT(pricing.itemsTotal)} total />
                </View>
              ) : null}
              <InfoNote>{"Today's menu prices, not a receipt — this order was placed before prices were recorded with orders."}</InfoNote>
            </>
          ) : null}
        </Card>

        {order.paymentLabel || order.note || order.dropoffAddress ? (
          <Card>
            <Separated inset={66}>
              {order.dropoffAddress ? <InfoRow icon="pin" caption="Delivering to" value={order.dropoffAddress} /> : null}
              {order.paymentLabel ? <InfoRow icon="cash" caption="Payment" value={order.paymentLabel} /> : null}
              {order.note ? <InfoRow icon="terms" caption="Note" value={order.note} /> : null}
            </Separated>
          </Card>
        ) : null}

        {!isActive && order.restaurantId ? (
          <PrimaryButton
            label="Order again"
            onPress={() => router.push(`/restaurant/${order.restaurantId}`)}
            accessibilityLabel={`Order again from ${order.restaurantName}`}
            accessibilityHint="Opens the restaurant's menu"
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: t.screenPadding, paddingTop: t.space[12], gap: t.space[14] },
  gap: { gap: t.space[12] },
  totals: { gap: t.space[8] },
  rule: { height: 1, backgroundColor: t.colors.divider },
}));
