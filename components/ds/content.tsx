import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { createStyles, Icon, type ColorToken, type IconName } from '@/theme';
import { Text } from './text';
import { Touchable } from './touchable';

// ---------------------------------------------------------------------------
// IconWell — round/rounded square behind an icon (info rows, list rows, states).
// ---------------------------------------------------------------------------

export type WellTone = 'neutral' | 'warm' | 'success' | 'danger' | 'ink' | 'white';

export function IconWell({
  icon,
  tone = 'neutral',
  size = 36,
  round,
  iconSize,
  iconColor,
  style,
}: {
  icon: IconName;
  tone?: WellTone;
  size?: number;
  round?: boolean;
  iconSize?: number;
  iconColor?: ColorToken;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const bg = {
    neutral: styles.wellNeutral,
    warm: styles.wellWarm,
    success: styles.wellSuccess,
    danger: styles.wellDanger,
    ink: styles.wellInk,
    white: styles.wellWhite,
  }[tone];
  const color: ColorToken =
    iconColor ?? (tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : tone === 'ink' ? 'onInk' : 'ink');
  return (
    <View
      style={[
        styles.well,
        bg,
        { width: size, height: size, borderRadius: round ? size / 2 : styles.well.borderRadius },
        style,
      ]}
    >
      <Icon name={icon} size={iconSize ?? (size >= 72 ? 30 : size >= 36 ? 18 : 14)} color={color} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// MetaRow — liked % · time · fee on one line, each behind a 28 well.
// The fee is green only when it is free.
// ---------------------------------------------------------------------------

export function MetaRow({
  likedPercent,
  likedCount,
  time,
  fee,
  style,
}: {
  likedPercent?: number | null;
  likedCount?: number | null;
  /** `30–45 min`. */
  time?: string | null;
  /** `'free'` or a formatted amount (`2,5 DT`). */
  fee?: 'free' | string | null;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.meta, style]}>
      {likedPercent != null ? (
        <View style={styles.metaItem}>
          <IconWell icon="liked" tone="warm" size={28} round iconSize={14} />
          <Text variant="meta" style={styles.semibold} tabular>
            {`${likedPercent}%`}
            {likedCount != null ? <Text variant="meta" color="inkMuted">{` (${likedCount})`}</Text> : null}
          </Text>
        </View>
      ) : null}
      {time ? (
        <View style={styles.metaItem}>
          <View style={styles.metaWell}>
            <Icon name="time" size={13} />
          </View>
          <Text variant="meta" color="inkMuted" tabular>
            {time}
          </Text>
        </View>
      ) : null}
      {fee ? (
        fee === 'free' ? (
          <View style={styles.metaItem}>
            <IconWell icon="delivery" tone="success" size={28} round iconSize={14} />
            <Text variant="meta" color="success" style={styles.semibold}>
              Free delivery
            </Text>
          </View>
        ) : (
          <View style={styles.metaItem}>
            <View style={styles.metaWell}>
              <Icon name="delivery" size="inline" />
            </View>
            <Text variant="meta" color="inkMuted" tabular>
              {fee}
            </Text>
          </View>
        )
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card — 1 divider border, radius 20, overflow hidden.
// ---------------------------------------------------------------------------

export function Card({
  children,
  padded,
  style,
}: {
  children: ReactNode;
  /** 16 inner padding (ProfileCard, OrderCard). Rows bring their own. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return <View style={[styles.card, padded && styles.cardPadded, style]}>{children}</View>;
}

/** 1 pt divider. `inset` starts it after the 36 well (66 from the card edge). */
export function Divider({ inset, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  return <View style={[styles.divider, inset != null && { marginLeft: inset }, style]} />;
}

/** Children separated by dividers — never after the last one. */
export function Separated({ children, inset }: { children: ReactNode; inset?: number }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <>
      {items.map((child, i) => (
        <Fragment key={child.key ?? i}>
          {i > 0 ? <Divider inset={inset} /> : null}
          {child}
        </Fragment>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// InfoRow — 36 well, caption above value, trailing chevron.
// ---------------------------------------------------------------------------

export function InfoRow({
  icon,
  caption,
  value,
  onPress,
  trailing,
  accessibilityLabel,
}: {
  icon: IconName;
  caption: string;
  value: string;
  onPress?: () => void;
  trailing?: ReactNode;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const body = (
    <>
      <IconWell icon={icon} />
      <View style={styles.flex}>
        <Text variant="caption" color="inkMuted">
          {caption}
        </Text>
        <Text variant="itemLabel" numberOfLines={2}>
          {value}
        </Text>
      </View>
      {trailing ?? (onPress ? <Icon name="chevronRight" size="row" color="inkMuted" /> : null)}
    </>
  );
  if (!onPress) return <View style={styles.infoRow}>{body}</View>;
  return (
    <Touchable onPress={onPress} scaleTo={1} accessibilityLabel={accessibilityLabel ?? `${caption}, ${value}`} style={styles.infoRow}>
      {body}
    </Touchable>
  );
}

// ---------------------------------------------------------------------------
// SummaryLine — 14/20 inkMuted label, ink value; total 15/700.
// ---------------------------------------------------------------------------

export function SummaryLine({
  label,
  value,
  total,
  valueColor,
  trailing,
}: {
  label: string;
  value: string;
  total?: boolean;
  valueColor?: ColorToken;
  /** Info button after the label (fee explanations). */
  trailing?: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.summary}>
      <View style={styles.summaryLabel}>
        <Text variant={total ? 'price' : 'description'} color={total ? 'ink' : 'inkMuted'}>
          {label}
        </Text>
        {trailing}
      </View>
      <Text variant={total ? 'price' : 'description'} color={valueColor ?? 'ink'} tabular>
        {value}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// ListGroup / ListRow (profile).
// ---------------------------------------------------------------------------

export function ListGroup({
  title,
  danger,
  children,
  style,
}: {
  title?: string;
  danger?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={style}>
      {title ? (
        <Text variant="overline" color={danger ? 'danger' : 'inkMuted'} style={styles.groupTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <Card>
        <Separated inset={66}>{children}</Separated>
      </Card>
    </View>
  );
}

export function ListRow({
  icon,
  label,
  sub,
  onPress,
  trailing,
  chevron = !!onPress,
  destructive,
  accessibilityLabel,
  disabled,
}: {
  icon: IconName;
  label: string;
  sub?: string;
  onPress?: () => void;
  /** Toggle, small segment, Badge… Shown before the chevron. */
  trailing?: ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const body = (
    <>
      <IconWell icon={icon} tone={destructive ? 'danger' : 'neutral'} />
      <View style={styles.flex}>
        <Text variant="itemLabel" color={destructive ? 'danger' : 'ink'}>
          {label}
        </Text>
        {sub ? (
          <Text variant="meta" color="inkMuted">
            {sub}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevronRight" size="row" color="inkMuted" /> : null}
    </>
  );
  if (!onPress) return <View style={styles.listRow}>{body}</View>;
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      scaleTo={1}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.listRow, disabled && styles.locked]}
    >
      {body}
    </Touchable>
  );
}

// ---------------------------------------------------------------------------
// Avatar — 56 primarySoft circle with initials.
// ---------------------------------------------------------------------------

export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export function Avatar({ name, size = 56 }: { name: string | null | undefined; size?: number }) {
  const styles = useStyles();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text variant="sectionTitle" style={styles.avatarText}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader — section title + optional right meta / link. 28 above, 14 below.
// ---------------------------------------------------------------------------

export function SectionHeader({
  title,
  meta,
  action,
  style,
}: {
  title: string;
  /** Right-aligned meta (`32 places`, `4 dishes`). */
  meta?: string;
  /** Right-aligned link/button (`See all`). */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.section, style]}>
      <Text variant="sectionTitle" accessibilityRole="header" style={styles.flex} numberOfLines={1}>
        {title}
      </Text>
      {meta ? (
        <Text variant="meta" color="inkMuted">
          {meta}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  semibold: { fontFamily: t.typography.label.fontFamily },
  locked: { opacity: t.opacity.lockedInput },
  well: { borderRadius: t.radius.control, alignItems: 'center', justifyContent: 'center' },
  wellNeutral: { backgroundColor: t.colors.surfaceSunken },
  wellWarm: { backgroundColor: t.colors.primarySoft },
  wellSuccess: { backgroundColor: t.colors.successSoft },
  wellDanger: { backgroundColor: t.colors.dangerSoft },
  wellInk: { backgroundColor: t.colors.ink },
  wellWhite: { backgroundColor: t.colors.surface },
  meta: { flexDirection: 'row', alignItems: 'center', gap: t.space[16], flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: t.space[6] },
  metaWell: {
    width: t.size.metaIconWell,
    height: t.size.metaIconWell,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.iconWell,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    borderColor: t.colors.divider,
    borderRadius: t.radius.card,
    overflow: 'hidden',
    backgroundColor: t.colors.surface,
  },
  cardPadded: { padding: t.space[16] },
  divider: { height: 1, backgroundColor: t.colors.divider },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[14],
    paddingVertical: t.space[12],
    paddingHorizontal: t.space[16],
    minHeight: t.size.listRow,
  },
  summary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.space[12] },
  summaryLabel: { flexDirection: 'row', alignItems: 'center', gap: t.space[6], flexShrink: 1 },
  groupTitle: { marginTop: t.space[28], marginBottom: t.space[8] },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[14],
    paddingVertical: t.space[12],
    paddingHorizontal: t.space[16],
    minHeight: t.size.listRow,
  },
  avatar: { backgroundColor: t.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { letterSpacing: 0 },
  section: { flexDirection: 'row', alignItems: 'center', gap: t.space[12], marginTop: t.space[28], marginBottom: t.space[14] },
}));
