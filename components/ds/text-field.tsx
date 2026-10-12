import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TargetedEvent,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { createStyles, Icon, useTheme, type IconName } from '@/theme';
import { MAX_FONT_SCALE, Text } from './text';
import { Touchable } from './touchable';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'editable'> {
  label?: string;
  /** Error message (red field + message below). `true` paints the field red without a message. */
  error?: string | boolean | null;
  /** Helper under the field (`caption`, inkMuted). Hidden while an error shows. */
  helper?: string;
  /** Leading 20 icon (search). */
  leadingIcon?: IconName;
  /** Trailing slot — eye toggle, clear button. */
  trailing?: ReactNode;
  /** Locked while submitting: 0.6 opacity, not editable. */
  locked?: boolean;
  editable?: boolean;
  /** TextArea: 72–88 tall, top-aligned. */
  area?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  /** Extra style for the 52 pt box (e.g. the board's pill search on maps). */
  boxStyle?: StyleProp<ViewStyle>;
}

/**
 * Label + 52 pt box (design system §6 Inputs). Rest: muted fill, no border.
 * Focused: white, 2 ink border, 4 pt orange focus ring, orange caret. Error:
 * white, 2 danger border, message below — announced to screen readers.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    error,
    helper,
    leadingIcon,
    trailing,
    locked,
    editable = true,
    area,
    containerStyle,
    boxStyle,
    onFocus,
    onBlur,
    accessibilityLabel,
    ...inputProps
  },
  ref,
) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const message = typeof error === 'string' && error.length > 0 ? error : null;
  const hasError = !!error;

  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  const handleFocus = (e: NativeSyntheticEvent<TargetedEvent>) => {
    setFocused(true);
    onFocus?.(e as never);
  };
  const handleBlur = (e: NativeSyntheticEvent<TargetedEvent>) => {
    setFocused(false);
    onBlur?.(e as never);
  };

  return (
    <View style={[styles.container, locked && styles.locked, containerStyle]}>
      {label ? (
        <Text variant="label" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.ring, focused && !hasError && styles.ringOn]}>
        <View
          style={[
            styles.box,
            area && styles.area,
            focused && styles.boxFocused,
            hasError && styles.boxError,
            boxStyle,
          ]}
        >
          {leadingIcon ? <Icon name={leadingIcon} /> : null}
          <TextInput
            ref={ref}
            editable={editable && !locked}
            placeholderTextColor={colors.inkSubtle}
            cursorColor={colors.primary}
            selectionColor={colors.primary}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            multiline={area}
            textAlignVertical={area ? 'top' : 'center'}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityHint={message ?? undefined}
            onFocus={handleFocus}
            onBlur={handleBlur}
            style={[styles.input, area && styles.inputArea]}
            {...inputProps}
          />
          {trailing}
        </View>
      </View>
      {message ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Icon name="error" size="inline" color="danger" />
          <Text variant="fieldMessage" color="danger" style={styles.flex}>
            {message}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="caption" color="inkMuted" style={styles.helper}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

/** Clear (×) button for the trailing slot of a search field. */
export function ClearButton({ onPress, label = 'Clear search' }: { onPress: () => void; label?: string }) {
  const styles = useStyles();
  return (
    <Touchable onPress={onPress} accessibilityLabel={label} hitSlop={12} style={styles.clear}>
      <Icon name="close" size="clear" color="inkMuted" />
    </Touchable>
  );
}

/** Eye toggle for password fields. */
export function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <Touchable
      onPress={onToggle}
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      hitSlop={12}
    >
      <Icon name={visible ? 'hidePassword' : 'showPassword'} color="inkMuted" />
    </Touchable>
  );
}

/**
 * Search field: TextField with the 20 leading search icon. With `onPress` it
 * is a button that opens the Search screen (Home), not an input.
 */
export const SearchField = forwardRef<
  TextInput,
  Omit<TextFieldProps, 'leadingIcon'> & { onPress?: () => void; onClear?: () => void }
>(function SearchField({ onPress, onClear, value, placeholder, containerStyle, ...rest }, ref) {
  const styles = useStyles();
  if (onPress) {
    return (
      <Touchable
        onPress={onPress}
        accessibilityRole="search"
        accessibilityLabel={placeholder ?? 'Search'}
        style={[styles.box, styles.searchButton, containerStyle]}
      >
        <Icon name="search" />
        <Text variant="input" color="inkSubtle" numberOfLines={1} style={styles.flex}>
          {placeholder}
        </Text>
      </Touchable>
    );
  }
  return (
    <TextField
      ref={ref}
      leadingIcon="search"
      value={value}
      placeholder={placeholder}
      returnKeyType="search"
      containerStyle={containerStyle}
      trailing={onClear && value ? <ClearButton onPress={onClear} /> : undefined}
      {...rest}
    />
  );
});

const useStyles = createStyles((t) => ({
  container: { gap: t.space[6] },
  locked: { opacity: t.opacity.lockedInput },
  label: {},
  // The 4 pt focus ring is a wrapping view (radius 18); negative margin keeps
  // the box aligned with the rest of the form whether or not it shows.
  ring: { margin: -4, padding: 2, borderRadius: t.radius.field + 4, borderWidth: 2, borderColor: 'transparent' },
  ringOn: { borderColor: t.colors.focusRing },
  box: {
    minHeight: t.size.input,
    borderRadius: t.radius.field,
    backgroundColor: t.colors.surfaceMuted,
    borderWidth: 2,
    borderColor: 'transparent',
    paddingHorizontal: t.space[14],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[12],
  },
  area: { minHeight: 80, alignItems: 'flex-start', paddingVertical: t.space[12] },
  boxFocused: { backgroundColor: t.colors.surface, borderColor: t.colors.ink },
  boxError: { backgroundColor: t.colors.surface, borderColor: t.colors.danger },
  input: {
    flex: 1,
    ...t.typography.input,
    color: t.colors.ink,
    paddingVertical: t.space[14],
    paddingHorizontal: 0,
  },
  inputArea: { paddingVertical: 0, minHeight: 52 },
  message: { flexDirection: 'row', alignItems: 'center', gap: t.space[6] },
  helper: {},
  flex: { flex: 1 },
  clear: {
    width: 20,
    height: 20,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: { paddingHorizontal: t.space[16] },
}));
