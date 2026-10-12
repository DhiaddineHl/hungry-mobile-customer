import { useMemo } from 'react';
import { SectionList, View } from 'react-native';
import { useRouter } from 'expo-router';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Divider, IconWell, Screen, StateView, Text, TextLink, TopBar, Touchable, UnreadDot, type WellTone } from '@/components/ds';
import { useNotificationStore, type CustomerNotification, type NotificationType } from '@/store/notification-store';
import { createStyles, formatDayMonth, Icon, type ColorToken, type IconName } from '@/theme';

/**
 * N1 Notifications — every order and delivery update this device has seen,
 * newest first, grouped by day (Today, This week, then dates).
 *
 * Read from the device inbox (`store/notification-store.ts`); nothing is
 * fetched here. Unread rows carry the orange dot until they are opened or
 * "Mark all read" is tapped — which is what clears the bell's counter. Tapping
 * a row opens its order; swiping it left deletes it.
 */

/** Wells by status: placed neutral, in progress orange, done green, failed red. */
const VISUALS: Record<NotificationType, { icon: IconName; tone: WellTone; color: ColorToken }> = {
  ORDER_PLACED: { icon: 'receipt', tone: 'neutral', color: 'ink' },
  ORDER_CONFIRMED: { icon: 'check', tone: 'success', color: 'success' },
  ORDER_PREPARING: { icon: 'preparing', tone: 'warm', color: 'primary' },
  ORDER_READY: { icon: 'ready', tone: 'warm', color: 'primary' },
  ORDER_CANCELLED: { icon: 'error', tone: 'danger', color: 'danger' },
  ORDER_REJECTED: { icon: 'error', tone: 'danger', color: 'danger' },
  DRIVER_ASSIGNED: { icon: 'delivery', tone: 'warm', color: 'primary' },
  DRIVER_PICKED_UP: { icon: 'delivery', tone: 'success', color: 'success' },
  ORDER_DELIVERED: { icon: 'delivered', tone: 'success', color: 'success' },
  DELIVERY_FAILED: { icon: 'error', tone: 'danger', color: 'danger' },
};

/** Width of the red delete panel revealed behind a row swiped left. */
const DELETE_ACTION_WIDTH = 88;

/** "Just now", "12 min ago", "3 h ago", "Yesterday", "2 days ago", then "26 Sept". */
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
  return formatDayMonth(then);
}

/** Today / This week / "26 Sept" — the overline a row is filed under. */
function groupOf(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (then.getTime() >= startOfToday) return 'Today';
  if (then.getTime() >= startOfToday - 6 * 24 * 3600 * 1000) return 'This week';
  return formatDayMonth(then);
}

export default function NotificationsScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const notifications = useNotificationStore((s) => s.notifications);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markRead = useNotificationStore((s) => s.markRead);
  const remove = useNotificationStore((s) => s.remove);

  const sections = useMemo(() => {
    const now = new Date();
    const groups: { title: string; data: CustomerNotification[] }[] = [];
    for (const n of notifications) {
      const title = groupOf(n.createdAt, now);
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.data.push(n);
      else groups.push({ title, data: [n] });
    }
    return groups;
  }, [notifications]);

  const hasUnread = notifications.some((n) => !n.read);

  const openOrder = (notification: CustomerNotification) => {
    markRead(notification.key);
    router.push(`/orders/${notification.orderId}`);
  };

  return (
    <Screen>
      <TopBar
        title="Notifications"
        onBack={() => router.back()}
        trailing={hasUnread ? <TextLink label="Mark all read" onPress={markAllRead} /> : undefined}
      />
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.key}
        renderSectionHeader={({ section }) => (
          <Text variant="overline" color="inkMuted" style={styles.overline} accessibilityRole="header">
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => (
          <NotificationRow notification={item} onPress={() => openOrder(item)} onDelete={() => remove(item.key)} />
        )}
        ItemSeparatorComponent={() => <Divider style={styles.separator} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          notifications.length === 0 ? styles.emptyContainer : styles.list,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          // S-N1.
          <StateView
            icon="bellOff"
            title="No notifications yet"
            body="Updates about your orders — confirmation, pickup and delivery — show up here."
          />
        }
      />
    </Screen>
  );
}

/**
 * NotificationRow: 40 well by status, title, time + unread dot, body.
 * Swiping left past the threshold deletes it — opening is the delete, as in
 * the system notification shade. A shorter swipe springs back.
 */
function NotificationRow({
  notification,
  onPress,
  onDelete,
}: {
  notification: CustomerNotification;
  onPress: () => void;
  onDelete: () => void;
}) {
  const styles = useStyles();
  const visual = VISUALS[notification.type];
  return (
    <Animated.View exiting={FadeOut.duration(180)}>
      <ReanimatedSwipeable
        friction={1.5}
        rightThreshold={DELETE_ACTION_WIDTH * 0.6}
        overshootRight={false}
        renderRightActions={() => (
          <View style={styles.deleteAction}>
            <Icon name="delete" color="onInk" />
            <Text variant="caption" color="onInk">
              Delete
            </Text>
          </View>
        )}
        onSwipeableOpen={onDelete}
      >
        <Touchable
          onPress={onPress}
          scaleTo={1}
          style={styles.row}
          accessibilityLabel={`${notification.read ? '' : 'Unread. '}${notification.title}. ${notification.body}`}
          accessibilityHint="Opens the order. Swipe left to delete."
          accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') onDelete();
          }}
        >
          <IconWell icon={visual.icon} tone={visual.tone} iconColor={visual.color} size={40} round />
          <View style={styles.text}>
            <View style={styles.titleLine}>
              <Text variant="itemTitle" numberOfLines={1} style={styles.flex}>
                {notification.title}
              </Text>
              <Text variant="caption" color="inkMuted">
                {relativeTime(notification.createdAt)}
              </Text>
              {!notification.read ? <UnreadDot /> : null}
            </View>
            <Text variant="meta" color="inkMuted" style={styles.body}>
              {notification.body}
            </Text>
          </View>
        </Touchable>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  list: { paddingHorizontal: t.screenPadding },
  emptyContainer: { flexGrow: 1 },
  overline: { marginTop: t.space[16], marginBottom: t.space[4], backgroundColor: t.colors.background },
  separator: {},
  row: { flexDirection: 'row', gap: t.space[14], paddingVertical: t.space[14], backgroundColor: t.colors.background },
  text: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: t.space[8] },
  body: { lineHeight: 19 },
  deleteAction: {
    width: DELETE_ACTION_WIDTH,
    backgroundColor: t.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space[4],
  },
}));
