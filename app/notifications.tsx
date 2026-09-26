import { PressableScale } from '@/components/ui/pressable-scale';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import {
  useNotificationStore,
  type CustomerNotification,
  type NotificationType,
} from '@/store/notification-store';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowLeft,
  BellOff,
  Bike,
  CircleCheck,
  ChefHat,
  ClipboardList,
  PackageCheck,
  ShoppingBag,
  CircleX,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * The customer's notifications — every order and delivery update this device
 * has seen, newest first.
 *
 * Read from the device inbox (`store/notification-store.ts`); nothing is
 * fetched here. Opening the screen marks everything read, which is what
 * clears the bell badge on the home header. Tapping a row opens the order it
 * is about.
 */

interface RowVisual {
  Icon: LucideIcon;
  color: string;
  background: string;
}

const VISUALS: Record<NotificationType, RowVisual> = {
  ORDER_PLACED: { Icon: ClipboardList, color: Palette.textSecondary, background: Palette.surfaceMuted },
  ORDER_CONFIRMED: { Icon: CircleCheck, color: Palette.success, background: Palette.successSoft },
  ORDER_PREPARING: { Icon: ChefHat, color: Palette.primary, background: Palette.primarySoft },
  ORDER_READY: { Icon: ShoppingBag, color: Palette.primary, background: Palette.primarySoft },
  ORDER_CANCELLED: { Icon: CircleX, color: Palette.danger, background: Palette.dangerSoft },
  ORDER_REJECTED: { Icon: CircleX, color: Palette.danger, background: Palette.dangerSoft },
  DRIVER_ASSIGNED: { Icon: Bike, color: Palette.primary, background: Palette.primarySoft },
  DRIVER_PICKED_UP: { Icon: Bike, color: Palette.success, background: Palette.successSoft },
  ORDER_DELIVERED: { Icon: PackageCheck, color: Palette.success, background: Palette.successSoft },
  DELIVERY_FAILED: { Icon: CircleX, color: Palette.danger, background: Palette.dangerSoft },
};

/** "Just now", "12 min ago", "3 h ago", "Yesterday", then a short date. */
function relativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const seconds = Math.max(0, (now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const notifications = useNotificationStore((s) => s.notifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  // Read once the customer has looked, and once more if they come back with
  // new rows in between — not on every render, which is what an effect on
  // `notifications` would do.
  useFocusEffect(
    useCallback(() => {
      markAllRead();
    }, [markAllRead])
  );

  const openOrder = (notification: CustomerNotification) => {
    router.push(`/orders/${notification.orderId}`);
  };

  const renderRow = ({ item }: { item: CustomerNotification }) => {
    const { Icon, color, background } = VISUALS[item.type];
    return (
      <PressableScale
        style={[styles.row, !item.read && styles.rowUnread]}
        onPress={() => openOrder(item)}
        scaleTo={0.98}
        accessibilityLabel={`${item.title}. ${item.body}`}
        accessibilityHint="Opens the order"
      >
        <View style={[styles.iconWrap, { backgroundColor: background }]}>
          <Icon size={20} color={color} />
        </View>
        <View style={styles.rowText}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.rowTime}>{relativeTime(item.createdAt)}</Text>
          </View>
          <Text style={styles.rowBody}>{item.body}</Text>
        </View>
        {!item.read ? <View style={styles.unreadDot} /> : null}
      </PressableScale>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={24} color={Palette.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.key}
        renderItem={renderRow}
        contentContainerStyle={[
          styles.list,
          notifications.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <BellOff size={32} color={Palette.primary} />
            </View>
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyBody}>
              Updates about your orders — confirmation, pickup and delivery —
              will show up here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Palette.ink,
  },
  headerSpacer: {
    width: 24,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: Palette.borderSubtle,
    marginVertical: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
  },
  rowUnread: {
    backgroundColor: Palette.surfaceAlt,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rowTitle: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
  },
  rowTime: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
  rowBody: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textSecondary,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Palette.primary,
    marginTop: Spacing.sm,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Palette.textPrimary,
  },
  emptyBody: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
