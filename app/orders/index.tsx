import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Screen, SegmentedControl, Skeleton, StateView, TopBar } from '@/components/ds';
import { ActiveOrderCard } from '@/components/order/active-order-card';
import { CompletedOrderCard } from '@/components/order/completed-order-card';
import { useCustomerOrders } from '@/hooks/use-customer-orders';
import { createStyles, useTheme, withCount } from '@/theme';

/**
 * O1–O2 My orders — the customer's orders, read from the backend and split by
 * the status it reports.
 *
 * Nothing on this screen writes: an order's status is moved by the restaurant,
 * the delivery agent and the back-office. The in-progress list re-reads itself
 * every 20 s while something is still running (`useCustomerOrders`).
 */

type TabKey = 'active' | 'completed';

export default function MyOrdersScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('active');

  const { active, completed, isLoading, isRefetching, error, refetch } = useCustomerOrders();
  const orders = tab === 'active' ? active : completed;

  const renderBody = () => {
    // S-O1: skeleton cards in the page's own layout.
    if (isLoading) return [0, 1].map((i) => <OrderCardSkeleton key={i} />);
    if (error) {
      return (
        <StateView
          icon="offline"
          title="Couldn't load your orders"
          body="Check your connection, then try again."
          actions={[{ label: 'Try again', onPress: () => refetch() }]}
          style={styles.state}
        />
      );
    }
    if (orders.length === 0) {
      return tab === 'active' ? (
        <StateView
          icon="receipt"
          title="No orders in progress"
          body="Orders you place appear here while the restaurant prepares them."
          actions={[{ label: 'Browse restaurants', onPress: () => router.navigate('/') }]}
          style={styles.state}
        />
      ) : (
        <StateView
          icon="delivered"
          title="No past orders yet"
          body="Orders land here once they're delivered or closed."
          style={styles.state}
        />
      );
    }
    return orders.map((order) =>
      tab === 'active' ? (
        <ActiveOrderCard key={order.id} order={order} onPress={() => router.push(`/orders/${order.id}`)} />
      ) : (
        <CompletedOrderCard
          key={order.id}
          order={order}
          onPress={() => router.push(`/orders/${order.id}`)}
          onOrderAgain={() =>
            order.restaurantId ? router.push(`/restaurant/${order.restaurantId}`) : router.push('/(tabs)')
          }
        />
      ),
    );
  };

  return (
    <Screen>
      <TopBar title="My orders" onBack={() => router.back()} />
      <View style={styles.segment}>
        <SegmentedControl
          segments={[
            { key: 'active', label: withCount('In progress', isLoading ? null : active.length) },
            { key: 'completed', label: withCount('Completed', isLoading ? null : completed.length) },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>
      <ScrollView
        style={styles.flex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.ink} />}
      >
        {renderBody()}
      </ScrollView>
    </Screen>
  );
}

function OrderCardSkeleton() {
  const styles = useStyles();
  return (
    <Card padded style={styles.skeleton}>
      <View style={styles.skeletonHeader}>
        <Skeleton width={40} height={40} radius={12} />
        <View style={styles.flexGap}>
          <Skeleton width="50%" height={16} />
          <Skeleton width="70%" height={12} />
        </View>
      </View>
      <Skeleton width="45%" height={14} />
      <Skeleton height={4} radius={2} />
      <Skeleton height={44} radius={12} />
    </Card>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  segment: { paddingHorizontal: t.screenPadding, paddingTop: t.space[8], paddingBottom: t.space[16] },
  content: { paddingHorizontal: t.screenPadding, gap: t.space[14] },
  state: { paddingVertical: t.space[32] },
  skeleton: { gap: t.space[14] },
  skeletonHeader: { flexDirection: 'row', alignItems: 'center', gap: t.space[12] },
  flexGap: { flex: 1, gap: t.space[6] },
}));
