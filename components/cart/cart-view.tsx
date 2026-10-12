import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BottomBar,
  Card,
  CartItem,
  IconButton,
  InfoNote,
  PillButton,
  PrimaryButton,
  RestaurantGroupHeader,
  Screen,
  Separated,
  StateView,
  SummaryLine,
  Text,
  TextLink,
  TopBar,
  toast,
  useBottomBarInset,
} from '@/components/ds';
import { DeliveryFeeModal, ServiceFeeModal } from '@/components/checkout';
import { useCartQuote } from '@/hooks/use-cart-sync';
import { useCustomerOrders } from '@/hooks/use-customer-orders';
import { useStoredImageSource } from '@/hooks/use-restaurant-image';
import { cartSubtotal, formatDT, groupByRestaurant, useCartStore, type CartSyncStatus } from '@/store/cart-store';
import { createStyles } from '@/theme';
import { SyncBadge } from './sync-badge';

/**
 * C1 Cart — the customer's ONE cart, line by line, grouped under the
 * restaurant each line is from.
 *
 * One cart, however many restaurants: the grouping says up front that two
 * restaurants mean two orders and two sets of fees, before Continue rather than
 * after. Items are rows, not boxed cards; the stepper turns into a delete at
 * quantity 1. Shared by the Cart tab and the pushed /cart/review route.
 */
export function CartView({
  onBack,
  syncStatus,
  onRetrySync,
}: {
  /** Set when pushed on the stack; the tab root has no back. */
  onBack?: () => void;
  syncStatus: CartSyncStatus;
  onRetrySync?: () => void;
}) {
  const styles = useStyles();
  const router = useRouter();
  const inTab = !onBack;
  const bottomInset = useBottomBarInset(!inTab);

  const items = useCartStore((s) => s.items);
  const increment = useCartStore((s) => s.increment);
  const decrement = useCartStore((s) => s.decrement);
  const clearItems = useCartStore((s) => s.clearItems);
  const replaceAll = useCartStore((s) => s.replaceAll);

  // Which fee explanation is open, if any — only one at a time.
  const [feeSheet, setFeeSheet] = useState<'service' | 'delivery' | null>(null);

  // Stored artwork is a relative path or a bundled module id; it becomes a
  // renderable source only here, against the current API base.
  const toImageSource = useStoredImageSource();
  const groups = groupByRestaurant(items);
  const orderCount = groups.length;

  // Whether "track your orders" is worth offering on an empty cart: only when
  // something is actually in progress.
  const { active: activeOrders } = useCustomerOrders();

  // The price the BACKEND puts on this cart, from its fee rules. `null` while
  // a change is being saved: the local subtotal stands in until then.
  const { quote, isUpdating, error: quoteError } = useCartQuote();
  const total = quote ? quote.total : cartSubtotal(items);
  const priceFootnote = quote
    ? quote.deliveryPriced
      ? undefined
      : 'The delivery fee is set from your delivery address at checkout.'
    : isUpdating
      ? 'Updating prices…'
      : quoteError
        ? "Fees couldn't be loaded — they're shown at checkout."
        : 'Service and delivery fees are added at checkout.';

  // Reversible, so a toast with Undo rather than a confirmation dialog.
  const handleClear = () => {
    const previous = items;
    clearItems();
    toast.show({ message: 'Cart cleared', actionLabel: 'Undo', onAction: () => replaceAll(previous), aboveBar: true });
  };

  if (items.length === 0) {
    return (
      <Screen>
        <TopBar title="Your cart" onBack={onBack} />
        <StateView
          icon="cart"
          title="Your cart is empty"
          body={
            activeOrders.length > 0
              ? 'Your order is on its way. Follow it, or start a new one.'
              : 'Browse restaurants and add dishes to get started.'
          }
          actions={[
            { label: 'Browse restaurants', onPress: () => router.navigate('/') },
            ...(activeOrders.length > 0
              ? [{ label: 'Track your orders', onPress: () => router.push('/orders'), variant: 'secondary' as const }]
              : []),
          ]}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar
        title="Your cart"
        onBack={onBack}
        trailing={
          <View style={styles.trailing}>
            {inTab ? (
              <IconButton icon="receipt" variant="plain" onPress={() => router.push('/orders')} accessibilityLabel="My orders" />
            ) : null}
            <TextLink label="Clear" onPress={handleClear} accessibilityLabel="Clear the cart" />
          </View>
        }
      />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {orderCount > 1 ? (
          <InfoNote>
            {`Your cart has dishes from ${orderCount} restaurants. They are placed as ${orderCount} separate orders, each with its own service and delivery fee.`}
          </InfoNote>
        ) : null}

        <SyncBadge status={syncStatus} onRetry={onRetrySync} />

        {groups.map((group) => (
          <View key={group.restaurantId} style={styles.group}>
            <RestaurantGroupHeader
              logo={toImageSource(group.restaurantLogo)}
              name={group.restaurantName}
              meta={`${group.totalQuantity} ${group.totalQuantity === 1 ? 'item' : 'items'} · ${formatDT(group.totalPrice)}`}
              trailing={
                <PillButton
                  label="Add items"
                  icon="add"
                  variant="outline"
                  onPress={() => router.push(`/restaurant/${group.restaurantId}`)}
                  accessibilityLabel={`Add items from ${group.restaurantName}`}
                />
              }
            />
            <Separated>
              {group.items.map((line) => (
                <CartItem
                  key={line.lineId}
                  name={line.name}
                  options={line.addons.map((a) => a.name).join(', ') || line.note || undefined}
                  total={formatDT(line.unitPrice * line.quantity)}
                  quantity={line.quantity}
                  image={toImageSource(line.image)}
                  onIncrement={() => increment(line.lineId)}
                  onDecrement={() => decrement(line.lineId)}
                />
              ))}
            </Separated>
          </View>
        ))}

        <Card padded style={styles.summary}>
          <SummaryLine label="Subtotal" value={formatDT(quote ? quote.subtotal : cartSubtotal(items))} />
          {quote && quote.discountTotal > 0 ? (
            <SummaryLine label="Discount" value={`−${formatDT(quote.discountTotal)}`} valueColor="success" />
          ) : null}
          <SummaryLine
            label="Service"
            value={quote ? formatDT(quote.serviceFee) : '—'}
            trailing={<IconButton icon="info" variant="plain" iconColor="inkMuted" onPress={() => setFeeSheet('service')} accessibilityLabel="What is the service fee?" style={styles.infoButton} />}
          />
          <SummaryLine
            label="Delivery"
            value={quote && quote.deliveryPriced ? (quote.deliveryFee === 0 ? 'Free' : formatDT(quote.deliveryFee)) : '—'}
            valueColor={quote && quote.deliveryPriced && quote.deliveryFee === 0 ? 'success' : undefined}
            trailing={<IconButton icon="info" variant="plain" iconColor="inkMuted" onPress={() => setFeeSheet('delivery')} accessibilityLabel="What is the delivery fee?" style={styles.infoButton} />}
          />
          {quote?.additionalFees.map((fee) => (
            <SummaryLine key={fee.code ?? fee.label} label={fee.label} value={formatDT(fee.amount)} />
          ))}
          <View style={styles.rule} />
          <SummaryLine label="Total" value={formatDT(total)} total />
          {priceFootnote ? (
            <Text variant="caption" color="inkMuted">
              {priceFootnote}
            </Text>
          ) : null}
        </Card>
      </ScrollView>

      <BottomBar withSafeArea={!inTab}>
        <PrimaryButton label="Continue" right={formatDT(total)} onPress={() => router.push('/order-details')} style={styles.flex} />
      </BottomBar>

      <ServiceFeeModal visible={feeSheet === 'service'} onClose={() => setFeeSheet(null)} />
      <DeliveryFeeModal visible={feeSheet === 'delivery'} onClose={() => setFeeSheet(null)} />
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: t.space[4] },
  content: { paddingHorizontal: t.screenPadding, paddingTop: t.space[12], gap: t.space[20] },
  group: { gap: t.space[4] },
  summary: { gap: t.space[10] },
  infoButton: { width: 28, height: 28 },
  rule: { height: 1, backgroundColor: t.colors.divider },
}));
