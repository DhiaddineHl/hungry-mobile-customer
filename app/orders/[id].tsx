import { OrderLineRow, OrderProgress, OrderStatusChip } from '@/components/order';
import { PressableScale } from '@/components/ui/pressable-scale';
import { QueryEmpty, QueryError } from '@/components/ui/query-state';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useCustomerOrder } from '@/hooks/use-customer-orders';
import { useRestaurant } from '@/hooks/use-restaurants';
import {
  formatOrderDateTime,
  orderBucket,
  orderProgressStep,
  orderStatusLabel,
} from '@/services/api/order-list-view-model';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  RotateCcw,
  Store,
} from 'lucide-react-native';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * One order, read from `GET /orders/{id}` and polled while it is still in
 * progress.
 *
 * Read-only, like the list: status is the restaurant's, the delivery agent's
 * and the back-office's to move. The only action here is "Order again", which
 * opens the restaurant's menu — it does not re-submit anything, because a
 * create enqueues a real delivery.
 *
 * What is deliberately absent, because no backend field supplies it
 * (plan §3.3, `docs/plans/checkout-order-creation-plan.md`): every price, fee
 * and total; a delivery ETA; the addons and the per-line note that were sent at
 * checkout. The payment line is the one this app wrote into the order's
 * `comment` — the only place a payment choice can be recorded, since the
 * backend has no payment concept at all.
 */
export default function CustomerOrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { order, isLoading, isRefetching, isMissing, error, refetch } =
    useCustomerOrder(id);
  const { data: restaurant } = useRestaurant(order?.restaurantId);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header onBack={() => router.back()} insetTop={insets.top} />
        <View style={styles.centered}>
          <ActivityIndicator color={Palette.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Header onBack={() => router.back()} insetTop={insets.top} />
        <QueryError error={error} onRetry={refetch} />
      </View>
    );
  }

  if (!order || isMissing) {
    return (
      <View style={styles.container}>
        <Header onBack={() => router.back()} insetTop={insets.top} />
        <QueryEmpty
          title="Order not found"
          body="The server didn’t return this order. It may have been removed."
        />
      </View>
    );
  }

  const isActive = orderBucket(order) === 'active';

  return (
    <View style={styles.container}>
      <Header onBack={() => router.back()} insetTop={insets.top} />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Palette.primary}
            colors={[Palette.primary]}
          />
        }
      >
        <View style={styles.card}>
          <Text style={styles.orderReference}>Order {order.reference}</Text>
          <View style={styles.dateRow}>
            <CalendarDays size={14} color={Palette.textMuted} />
            <Text style={styles.dateText}>
              {formatOrderDateTime(order.createdAt)}
            </Text>
          </View>
          <OrderStatusChip status={order.status} />
          <View style={styles.restaurantRow}>
            <Store size={16} color={Palette.textSecondary} />
            <Text style={styles.restaurantName}>
              {restaurant?.name ?? order.restaurantName}
            </Text>
          </View>
        </View>

        {isActive ? (
          <View style={styles.card}>
            <OrderProgress
              step={orderProgressStep(order)}
              statusLabel={orderStatusLabel(order.status)}
            />
            <Text style={styles.footnote}>
              Updates as the restaurant and your delivery agent move the order
              along. Pull down to refresh.
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {order.hasLineDetail ? (
            order.lines.map((line, index) => (
              <View key={line.id}>
                {index > 0 ? <View style={styles.rowDivider} /> : null}
                <OrderLineRow line={line} />
              </View>
            ))
          ) : (
            /*
              An empty list is NOT an empty order: the backend never sets the
              `order_item.order_id` back-reference, so the items it accepted
              do not come back on a re-read (plan §2.2).
            */
            <Text style={styles.noDetail}>
              The server didn’t return the items for this order. The restaurant
              has them.
            </Text>
          )}
        </View>

        {order.paymentLabel || order.note ? (
          <View style={styles.card}>
            {order.paymentLabel ? (
              <>
                <Text style={styles.blockLabel}>PAYMENT METHOD</Text>
                <View style={styles.paymentRow}>
                  <View style={styles.paymentIcon}>
                    <CreditCard size={18} color={Palette.textPrimary} />
                  </View>
                  <Text style={styles.blockValue}>{order.paymentLabel}</Text>
                </View>
              </>
            ) : null}

            {order.note ? (
              <>
                {order.paymentLabel ? <View style={styles.rowDivider} /> : null}
                <Text style={styles.blockLabel}>NOTE</Text>
                <Text style={styles.blockValue}>{order.note}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.xl }]}>
          {order.restaurantId ? (
            <PressableScale
              style={styles.action}
              onPress={() => router.push(`/restaurant/${order.restaurantId}`)}
              scaleTo={0.97}
              haptic
              accessibilityLabel={`Order again from ${order.restaurantName}`}
              accessibilityHint="Opens the restaurant’s menu"
            >
              <RotateCcw size={18} color={Palette.textInverse} />
              <Text style={styles.actionText}>Order again</Text>
            </PressableScale>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Header({ onBack, insetTop }: { onBack: () => void; insetTop: number }) {
  return (
    <View style={[styles.header, { paddingTop: insetTop + Spacing.sm }]}>
      <TouchableOpacity onPress={onBack} hitSlop={8}>
        <ArrowLeft size={24} color={Palette.ink} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Order Details</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    marginHorizontal: Spacing.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: Palette.surfaceAlt,
    borderRadius: Radius.xl,
  },
  orderReference: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  restaurantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  restaurantName: {
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Palette.textSecondary,
  },
  footnote: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
    marginBottom: Spacing.xs,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Palette.border,
  },
  noDetail: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    lineHeight: 20,
  },
  blockLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    letterSpacing: 1,
    color: Palette.textMuted,
  },
  blockValue: {
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Palette.textPrimary,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  paymentIcon: {
    width: 40,
    height: 32,
    borderRadius: Radius.sm,
    backgroundColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Palette.borderSubtle,
  },
  actions: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.pill,
    backgroundColor: Palette.ink,
  },
  actionText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
});
