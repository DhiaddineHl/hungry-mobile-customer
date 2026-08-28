import {
  ActiveOrderCard,
  CompletedOrderCard,
  OrderTabSwitch,
} from '@/components/order';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { QueryState } from '@/components/ui/query-state';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { useCustomerOrders } from '@/hooks/use-customer-orders';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * My Orders — the customer's orders, read from the backend and split by the
 * status the backend reports.
 *
 * Nothing on this screen writes: an order's status is moved by the restaurant,
 * the delivery agent and the back-office, and the customer app consults and
 * tracks it. The in-progress list re-reads itself every 20s while something is
 * still running (`useCustomerOrders`), which is the whole tracking mechanism —
 * there are no push notifications behind it.
 */

type TabKey = 'active' | 'completed';

export default function MyOrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('active');

  const { active, completed, isLoading, isRefetching, error, refetch } =
    useCustomerOrders();

  const orders = tab === 'active' ? active : completed;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={24} color={Palette.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.headerSpacer} />
      </View>

      <OrderTabSwitch
        tabs={[
          { key: 'active', label: 'In Progress', count: active.length },
          { key: 'completed', label: 'Completed', count: completed.length },
        ]}
        value={tab}
        onChange={setTab}
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xxxl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Palette.primary}
            colors={[Palette.primary]}
          />
        }
      >
        <QueryState
          isLoading={isLoading}
          error={error}
          isEmpty={orders.length === 0}
          loading={<OrdersSkeleton />}
          emptyTitle={
            tab === 'active' ? 'No orders in progress' : 'No past orders yet'
          }
          emptyBody={
            tab === 'active'
              ? 'Orders you place appear here while the restaurant prepares them.'
              : 'Orders land here once the restaurant or the delivery agent closes them.'
          }
          onRetry={refetch}
        >
          {orders.map((order, index) => (
            <AnimatedEntrance key={order.id} index={index}>
              {tab === 'active' ? (
                <ActiveOrderCard
                  order={order}
                  onPress={() => router.push(`/orders/${order.id}`)}
                />
              ) : (
                <CompletedOrderCard
                  order={order}
                  onPress={() => router.push(`/orders/${order.id}`)}
                  onOrderAgain={() =>
                    order.restaurantId
                      ? router.push(`/restaurant/${order.restaurantId}`)
                      : router.push('/(tabs)')
                  }
                />
              )}
            </AnimatedEntrance>
          ))}
        </QueryState>
      </ScrollView>
    </View>
  );
}

/** Two card-shaped blocks, so the list does not jump when the orders land. */
function OrdersSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {[0, 1].map((index) => (
        <View key={index} style={styles.skeletonCard} />
      ))}
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
    paddingTop: Spacing.xl,
    gap: Spacing.lg,
  },
  skeletonList: {
    gap: Spacing.lg,
  },
  skeletonCard: {
    marginHorizontal: Spacing.xl,
    height: 220,
    borderRadius: Radius.xl,
    backgroundColor: Palette.surfaceAlt,
  },
});
