import { View, type StyleProp, type ViewStyle } from 'react-native';
import { createStyles, Icon, type IconName } from '@/theme';
import { Text } from './text';

export type BadgeVariant =
  | 'discount'
  | 'status'
  | 'required'
  | 'neutral'
  | 'optional'
  | 'done'
  | 'closed'
  | 'success'
  | 'danger';

/** `-25%`, `Required`, `Placed`, `Ready`, `Closed · Opens at 10:00`. Radius 6, padding 3×7. */
export function Badge({
  label,
  variant = 'status',
  style,
}: {
  label: string;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const tone = {
    discount: [styles.warm, 'ink'],
    status: [styles.warm, 'ink'],
    required: [styles.warm, 'ink'],
    neutral: [styles.sunken, 'inkMuted'],
    optional: [styles.sunken, 'inkMuted'],
    done: [styles.sunken, 'inkMuted'],
    closed: [styles.sunken, 'ink'],
    success: [styles.successBg, 'success'],
    danger: [styles.dangerBg, 'danger'],
  } as const;
  const [bg, color] = tone[variant];
  const closed = variant === 'closed';
  return (
    <View style={[styles.badge, bg, closed && styles.closed, style]}>
      <Text
        variant={closed ? 'caption' : 'badge'}
        color={color}
        numberOfLines={1}
        style={closed && styles.closedText}
      >
        {label}
      </Text>
    </View>
  );
}

/** The single navy promo tag: `Up to 20% off`. 30 pill. */
export function PromoTag({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.tag, styles.promo, style]}>
      <Text variant="meta" color="onInk" numberOfLines={1} style={styles.semibold}>
        {label}
      </Text>
    </View>
  );
}

/** Neutral tag with an icon: `Top rated`. */
export function InfoTag({ label, icon, style }: { label: string; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.tag, styles.info, style]}>
      {icon ? <Icon name={icon} size="inline" /> : null}
      <Text variant="meta" numberOfLines={1} style={styles.semibold}>
        {label}
      </Text>
    </View>
  );
}

/** Green status pill: `Delivered`. */
export function StatusPill({
  label,
  icon = 'delivered',
  tone = 'success',
}: {
  label: string;
  icon?: IconName;
  tone?: 'success' | 'neutral' | 'danger';
}) {
  const styles = useStyles();
  const bg = tone === 'success' ? styles.successBg : tone === 'danger' ? styles.dangerBg : styles.sunken;
  const color = tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'inkMuted';
  return (
    <View style={[styles.tag, bg]}>
      <Icon name={icon} size="inline" color={color} />
      <Text variant="meta" color={color} style={styles.semibold}>
        {label}
      </Text>
    </View>
  );
}

/** Orange counter (cart, bell). `ring` adds the 2 pt white border used on the bell. */
export function Counter({ count, max = 9, ring }: { count: number; max?: number; ring?: boolean }) {
  const styles = useStyles();
  if (count <= 0) return null;
  return (
    <View style={[styles.counter, ring && styles.counterRing]} accessibilityElementsHidden importantForAccessibility="no">
      <Text variant="counter" color="onPrimary">
        {count > max ? `${max}+` : count}
      </Text>
    </View>
  );
}

/** 8 pt orange dot on unread rows. */
export function UnreadDot({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.dot, style]} accessibilityLabel="Unread" />;
}

const useStyles = createStyles((t) => ({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: t.radius.badge,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  closed: { paddingHorizontal: t.space[8] },
  closedText: { fontFamily: t.typography.label.fontFamily },
  warm: { backgroundColor: t.colors.primarySoft },
  sunken: { backgroundColor: t.colors.surfaceSunken },
  successBg: { backgroundColor: t.colors.successSoft },
  dangerBg: { backgroundColor: t.colors.dangerSoft },
  tag: {
    height: 30,
    borderRadius: t.radius.pill,
    paddingHorizontal: t.space[12],
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: t.space[6],
  },
  promo: { backgroundColor: t.colors.ink },
  info: { backgroundColor: t.colors.surfaceSunken },
  semibold: { fontFamily: t.typography.label.fontFamily },
  counter: {
    minWidth: t.size.counter,
    height: t.size.counter,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.primary,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterRing: {
    minWidth: 20,
    height: 20,
    borderWidth: 2,
    borderColor: t.colors.surface,
    paddingHorizontal: 4,
  },
  dot: { width: t.size.unreadDot, height: t.size.unreadDot, borderRadius: t.radius.pill, backgroundColor: t.colors.primary },
}));
