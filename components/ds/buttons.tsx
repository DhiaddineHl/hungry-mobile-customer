import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { createStyles, Icon, type ColorToken, type IconName } from '@/theme';
import { Spinner } from './spinner';
import { Text } from './text';
import { Touchable } from './touchable';

// ---------------------------------------------------------------------------
// PrimaryButton — 52 h, radius 14, ink. Navy acts; never orange.
// ---------------------------------------------------------------------------

export interface PrimaryButtonProps {
  label: string;
  onPress?: () => void;
  /** Amount shown on the right (`21,36 DT`). Buttons that charge money show it. */
  right?: string;
  disabled?: boolean;
  /** Spinner + progressive label; not pressable while loading. */
  loading?: boolean;
  /** Label while loading ("Logging in…"). Falls back to `label`. */
  loadingLabel?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PrimaryButton({
  label,
  onPress,
  right,
  disabled,
  loading,
  loadingLabel,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: PrimaryButtonProps) {
  const styles = useStyles();
  const inactive = disabled || loading;
  const textColor: ColorToken = disabled && !loading ? 'inkMuted' : 'onInk';
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      haptic
      accessibilityLabel={accessibilityLabel ?? (right ? `${label}, ${right}` : label)}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: !!loading }}
      style={[
        styles.primary,
        right && !loading ? styles.split : styles.centered,
        disabled && !loading && styles.primaryDisabled,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.row}>
          <Spinner tone="onInk" />
          <Text variant="button" color="onInk" numberOfLines={1}>
            {loadingLabel ?? label}
          </Text>
        </View>
      ) : (
        <>
          <Text variant="button" color={textColor} numberOfLines={1} style={styles.shrink}>
            {label}
          </Text>
          {right ? (
            <Text variant="button" color={textColor} tabular numberOfLines={1}>
              {right}
            </Text>
          ) : null}
        </>
      )}
    </Touchable>
  );
}

// ---------------------------------------------------------------------------
// SecondaryButton — 52 h, 1.5 outline, optional 20 leading icon.
// ---------------------------------------------------------------------------

export function SecondaryButton({
  label,
  onPress,
  icon,
  leading,
  disabled,
  loading,
  accessibilityLabel,
  style,
  testID,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  /** Custom leading mark (the Google "G"). */
  leading?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: !!loading }}
      style={[styles.secondary, (disabled || loading) && styles.locked, style]}
    >
      {loading ? <Spinner /> : icon ? <Icon name={icon} /> : leading}
      <Text variant="buttonSecondary" numberOfLines={1}>
        {label}
      </Text>
    </Touchable>
  );
}

// ---------------------------------------------------------------------------
// TextLink — 14/600 underlined ink.
// ---------------------------------------------------------------------------

export function TextLink({
  label,
  onPress,
  color = 'ink',
  disabled,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress?: () => void;
  color?: ColorToken;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={12}
      style={[disabled && styles.locked, style]}
    >
      <Text variant="link" color={color} style={styles.underline}>
        {label}
      </Text>
    </Touchable>
  );
}

// ---------------------------------------------------------------------------
// IconButton — outlined (top bars), floating (hero photos, no shadow),
// filled (Home bell), add (white + floatingButton shadow).
// ---------------------------------------------------------------------------

export type IconButtonVariant = 'outlined' | 'floating' | 'filled' | 'add' | 'addSmall' | 'plain';

export function IconButton({
  icon,
  onPress,
  variant = 'outlined',
  accessibilityLabel,
  filled,
  iconColor,
  badge,
  disabled,
  style,
  testID,
}: {
  icon: IconName;
  onPress?: () => void;
  variant?: IconButtonVariant;
  /** Required: icon-only buttons are labelled (design system §11). */
  accessibilityLabel: string;
  /** Filled glyph (saved heart). */
  filled?: boolean;
  iconColor?: ColorToken;
  /** Counter / dot drawn at the top-right (bell). */
  badge?: ReactNode;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const styles = useStyles();
  const box = {
    outlined: styles.iconOutlined,
    floating: styles.iconFloating,
    filled: styles.iconFilled,
    add: styles.iconAdd,
    addSmall: styles.iconAddSmall,
    plain: styles.iconPlain,
  }[variant];
  const size =
    variant === 'add' ? 20 : variant === 'addSmall' ? 16 : variant === 'outlined' && icon === 'back' ? 'nav' : 'field';
  const color: ColorToken = iconColor ?? (variant === 'filled' ? 'onInk' : 'ink');
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={variant === 'addSmall' ? 6 : 0}
      style={[box, disabled && styles.locked, style]}
    >
      <Icon name={icon} size={size} color={color} filled={filled} />
      {badge ? <View style={styles.badgeSlot}>{badge}</View> : null}
    </Touchable>
  );
}

// ---------------------------------------------------------------------------
// PillButton — 40 ink pill ("Order again"); outline 36 ("Add items").
// ---------------------------------------------------------------------------

export function PillButton({
  label,
  onPress,
  icon,
  variant = 'filled',
  disabled,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  variant?: 'filled' | 'outline';
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const outline = variant === 'outline';
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[outline ? styles.pillOutline : styles.pill, disabled && styles.locked, style]}
    >
      {icon ? <Icon name={icon} size="small" color={outline ? 'ink' : 'onInk'} /> : null}
      <Text variant={outline ? 'label' : 'chip'} color={outline ? 'ink' : 'onInk'} numberOfLines={1}>
        {label}
      </Text>
    </Touchable>
  );
}

const useStyles = createStyles((t) => ({
  primary: {
    height: t.size.button,
    borderRadius: t.radius.field,
    backgroundColor: t.colors.ink,
    paddingHorizontal: t.space[20],
    flexDirection: 'row',
    alignItems: 'center',
  },
  centered: { justifyContent: 'center' },
  split: { justifyContent: 'space-between', gap: t.space[12] },
  primaryDisabled: { backgroundColor: t.colors.surfaceSunken },
  row: { flexDirection: 'row', alignItems: 'center', gap: t.space[10] },
  shrink: { flexShrink: 1 },
  secondary: {
    height: t.size.button,
    borderRadius: t.radius.field,
    borderWidth: 1.5,
    borderColor: t.colors.outline,
    backgroundColor: t.colors.surface,
    paddingHorizontal: t.space[20],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.space[10],
  },
  locked: { opacity: t.opacity.lockedInput },
  underline: { textDecorationLine: 'underline' },
  iconOutlined: {
    width: t.size.iconButton,
    height: t.size.iconButton,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.outlineSubtle,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFloating: {
    width: t.size.iconButton,
    height: t.size.iconButton,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFilled: {
    width: t.size.iconButton,
    height: t.size.iconButton,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconAdd: {
    width: t.size.addButton,
    height: t.size.addButton,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadow.floatingButton,
  },
  iconAddSmall: {
    width: t.size.addButtonSmall,
    height: t.size.addButtonSmall,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadow.floatingButton,
  },
  iconPlain: {
    width: t.size.minTouch,
    height: t.size.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSlot: { position: 'absolute', top: -4, right: -4 },
  pill: {
    height: t.size.pillButton,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.ink,
    paddingHorizontal: t.space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[8],
  },
  pillOutline: {
    height: t.size.pillButtonSmall,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.outline,
    backgroundColor: t.colors.surface,
    paddingHorizontal: t.space[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[6],
  },
}));
