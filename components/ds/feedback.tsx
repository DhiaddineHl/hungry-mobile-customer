import { useEffect, type ReactNode } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, Icon, useTheme, type IconName } from '@/theme';
import { PrimaryButton, SecondaryButton, TextLink } from './buttons';
import { IconWell, type WellTone } from './content';
import { Text } from './text';

// ---------------------------------------------------------------------------
// Skeleton — blocks in the exact layout of the content they replace.
// Opacity pulse 0.6 ↔ 1 over 1.2 s; static under Reduce Motion.
// ---------------------------------------------------------------------------

export function Skeleton({
  width = '100%',
  height = 14,
  radius,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius: r, motion } = useTheme();
  const reduceMotion = useReducedMotion();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withTiming(0.6, { duration: motion.skeletonPulseMs / 2 }), -1, true));
    return () => cancelAnimation(pulse);
  }, [reduceMotion, pulse, motion.skeletonPulseMs]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius ?? r.badge, backgroundColor: colors.skeleton }, animated, style]}
    />
  );
}

// ---------------------------------------------------------------------------
// InfoNote — muted note with an info icon.
// ---------------------------------------------------------------------------

export function InfoNote({ children, icon = 'info', style }: { children: ReactNode; icon?: IconName; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return (
    <View style={[styles.note, style]}>
      <Icon name={icon} size="row" />
      <Text variant="meta" style={styles.flex}>
        {children}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ErrorBanner — request errors, above the affected content. Always says what
// to do next.
// ---------------------------------------------------------------------------

export function ErrorBanner({
  title,
  body,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.banner, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icon name="error" size="row" color="danger" />
      <View style={[styles.flex, styles.bannerText]}>
        <Text variant="chip" color="danger" style={styles.bold}>
          {title}
        </Text>
        {body ? <Text variant="meta">{body}</Text> : null}
        {actionLabel && onAction ? <TextLink label={actionLabel} onPress={onAction} style={styles.bannerLink} /> : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// StateView — empty / error / offline. Centred, 72 well → heading → body →
// optional actions full width.
// ---------------------------------------------------------------------------

export interface StateAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

export function StateView({
  icon,
  tone = 'neutral',
  title,
  body,
  actions,
  children,
  style,
}: {
  icon: IconName;
  tone?: WellTone;
  title: string;
  body?: string;
  actions?: StateAction[];
  /** Extra content under the body ("Try instead" chips). */
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.state, style]}>
      <IconWell icon={icon} tone={tone} size={72} round iconSize={30} />
      <Text variant="heading" align="center" accessibilityRole="header">
        {title}
      </Text>
      {body ? (
        <Text variant="description" color="inkMuted" align="center" style={styles.stateBody}>
          {body}
        </Text>
      ) : null}
      {children}
      {actions?.length ? (
        <View style={styles.stateActions}>
          {actions.map((a) =>
            a.variant === 'secondary' ? (
              <SecondaryButton key={a.label} label={a.label} onPress={a.onPress} loading={a.loading} />
            ) : (
              <PrimaryButton key={a.label} label={a.label} onPress={a.onPress} loading={a.loading} />
            ),
          )}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// SuccessScreen — end of a flow. Success well + title, optional summary card,
// actions pinned to the bottom (PrimaryButton + TextLink).
// ---------------------------------------------------------------------------

export function SuccessScreen({
  title,
  body,
  summary,
  primaryLabel,
  onPrimary,
  linkLabel,
  onLink,
}: {
  title: string;
  body?: string;
  summary?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  linkLabel?: string;
  onLink?: () => void;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.success, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.successBody}>
        <IconWell icon="success" tone="success" size={72} round iconSize={30} />
        <Text variant="title" align="center" accessibilityRole="header">
          {title}
        </Text>
        {body ? (
          <Text variant="bodySmall" color="inkMuted" align="center" style={styles.stateBody}>
            {body}
          </Text>
        ) : null}
        {summary ? <View style={styles.successSummary}>{summary}</View> : null}
      </View>
      <View style={styles.successActions}>
        <PrimaryButton label={primaryLabel} onPress={onPrimary} />
        {linkLabel && onLink ? <TextLink label={linkLabel} onPress={onLink} style={styles.center} /> : null}
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  bold: { fontFamily: t.typography.button.fontFamily },
  center: { alignSelf: 'center' },
  note: {
    flexDirection: 'row',
    gap: t.space[10],
    backgroundColor: t.colors.surfaceMuted,
    borderRadius: t.radius.field,
    paddingVertical: t.space[12],
    paddingHorizontal: t.space[14],
  },
  banner: {
    flexDirection: 'row',
    gap: t.space[10],
    backgroundColor: t.colors.dangerSoft,
    borderRadius: t.radius.field,
    paddingVertical: t.space[12],
    paddingHorizontal: t.space[14],
  },
  bannerText: { gap: 2 },
  bannerLink: { marginTop: t.space[4], alignSelf: 'flex-start' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: t.space[14] },
  stateBody: { maxWidth: 280, lineHeight: 21 },
  stateActions: { alignSelf: 'stretch', gap: t.space[10], marginTop: t.space[8] },
  success: { flex: 1, backgroundColor: t.colors.background, paddingHorizontal: t.screenPadding },
  successBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[14] },
  successSummary: { alignSelf: 'stretch', marginTop: t.space[10] },
  successActions: { gap: t.space[16] },
}));
