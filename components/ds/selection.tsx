import { View, type StyleProp, type ViewStyle } from 'react-native';
import { createStyles, Icon } from '@/theme';
import { Text } from './text';
import { Touchable } from './touchable';

// ---------------------------------------------------------------------------
// Checkbox / Radio — 22. Visual only by default; pass onPress to make them
// their own target. Option rows make the whole row the target instead.
// ---------------------------------------------------------------------------

export function Checkbox({
  checked,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  checked: boolean;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const box = (
    <View style={[styles.checkbox, checked && styles.checkboxOn, disabled && styles.disabled]}>
      {checked ? <Icon name="check" size="inline" color="onInk" /> : null}
    </View>
  );
  if (!onPress) return box;
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={11}
    >
      {box}
    </Touchable>
  );
}

export function Radio({ selected, disabled }: { selected: boolean; disabled?: boolean }) {
  const styles = useStyles();
  return <View style={[styles.radio, selected && styles.radioOn, disabled && styles.disabled]} />;
}

// ---------------------------------------------------------------------------
// Toggle — 44×26 pill, ink when on.
// ---------------------------------------------------------------------------

export function Toggle({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  return (
    <Touchable
      onPress={() => onValueChange?.(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={9}
      scaleTo={1}
      style={[styles.toggle, value && styles.toggleOn, disabled && styles.disabled]}
    >
      <View style={[styles.knob, value && styles.knobOn]} />
    </Touchable>
  );
}

// ---------------------------------------------------------------------------
// FilterChip — 40 pill. Selected: ink fill, white text, optional ×.
// ---------------------------------------------------------------------------

export function FilterChip({
  label,
  selected,
  onPress,
  showClear = selected,
  disabled,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Trailing × on the selected chip (filters). Off for single-choice chips (labels, categories). */
  showClear?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <Touchable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.chipOn, disabled && styles.disabled, style]}
    >
      <Text variant="chip" color={selected ? 'onInk' : 'ink'} numberOfLines={1}>
        {label}
      </Text>
      {selected && showClear ? <Icon name="close" size="inline" color="onInk" /> : null}
    </Touchable>
  );
}

// ---------------------------------------------------------------------------
// SegmentedControl — 44 track (small: 32, language).
// ---------------------------------------------------------------------------

export interface Segment<K extends string> {
  key: K;
  label: string;
}

export function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
  size = 'regular',
  style,
}: {
  segments: readonly Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  size?: 'regular' | 'small';
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const small = size === 'small';
  return (
    <View accessibilityRole="tablist" style={[small ? styles.segTrackSmall : styles.segTrack, style]}>
      {segments.map((s) => {
        const on = s.key === value;
        return (
          <Touchable
            key={s.key}
            onPress={() => onChange(s.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={s.label}
            scaleTo={1}
            style={[small ? styles.segSmall : styles.seg, on && (small ? styles.segOnSmall : styles.segOn)]}
          >
            <Text
              variant={small ? 'caption' : 'chip'}
              color={on ? 'ink' : 'inkMuted'}
              numberOfLines={1}
              style={small && styles.segSmallText}
            >
              {s.label}
            </Text>
          </Touchable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Stepper — large 52 (dish bottom bar) / compact 32 (cart rows). At quantity 1
// the minus becomes Trash2 when `onRemove`-style deletion is allowed.
// ---------------------------------------------------------------------------

export function Stepper({
  value,
  onIncrement,
  onDecrement,
  size = 'large',
  min = 1,
  max,
  trashAtMin = false,
  disabled,
  itemName,
  style,
}: {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  size?: 'large' | 'compact';
  /** Lowest value reachable with minus. With `trashAtMin`, minus at `min` deletes. */
  min?: number;
  max?: number;
  /** At the minimum, show Trash2 and keep the button active (it removes the line). */
  trashAtMin?: boolean;
  disabled?: boolean;
  /** For screen readers: "Increase quantity of Coke". */
  itemName?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const compact = size === 'compact';
  const atMin = value <= min;
  const showTrash = trashAtMin && atMin;
  const minusDisabled = disabled || (atMin && !trashAtMin);
  const plusDisabled = disabled || (max != null && value >= max);
  const iconSize = compact ? 'small' : 'field';
  const suffix = itemName ? ` of ${itemName}` : '';
  return (
    <View style={[compact ? styles.stepperCompact : styles.stepper, style]}>
      <Touchable
        onPress={onDecrement}
        disabled={minusDisabled}
        accessibilityLabel={showTrash ? `Remove${itemName ? ` ${itemName}` : ''}` : `Decrease quantity${suffix}`}
        hitSlop={compact ? 8 : 10}
        style={minusDisabled && styles.disabled}
      >
        <Icon name={showTrash ? 'delete' : 'remove'} size={iconSize} />
      </Touchable>
      <Text
        variant={compact ? 'chip' : 'rowTitle'}
        tabular
        style={compact ? styles.valueCompact : styles.value}
        accessibilityLabel={`Quantity ${value}`}
      >
        {value}
      </Text>
      <Touchable
        onPress={onIncrement}
        disabled={plusDisabled}
        accessibilityLabel={`Increase quantity${suffix}`}
        hitSlop={compact ? 8 : 10}
        style={plusDisabled && styles.disabled}
      >
        <Icon name="add" size={iconSize} />
      </Touchable>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  disabled: { opacity: t.opacity.lockedInput },
  checkbox: {
    width: t.size.checkbox,
    height: t.size.checkbox,
    borderRadius: t.radius.badge,
    borderWidth: 1.5,
    borderColor: t.colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.surface,
  },
  checkboxOn: { backgroundColor: t.colors.ink, borderColor: t.colors.ink },
  radio: {
    width: t.size.radio,
    height: t.size.radio,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.outline,
    backgroundColor: t.colors.surface,
  },
  radioOn: { borderWidth: 7, borderColor: t.colors.ink },
  toggle: {
    width: t.size.toggle.w,
    height: t.size.toggle.h,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.outline,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: t.colors.ink },
  knob: {
    width: t.size.toggle.knob,
    height: t.size.toggle.knob,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
  },
  knobOn: { alignSelf: 'flex-end' },
  chip: {
    height: t.size.chip,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.outline,
    backgroundColor: t.colors.surface,
    paddingHorizontal: t.space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[6],
  },
  chipOn: { backgroundColor: t.colors.ink, borderColor: t.colors.ink },
  segTrack: {
    height: t.size.segment,
    borderRadius: t.radius.control,
    backgroundColor: t.colors.surfaceSunken,
    padding: t.space[4],
    gap: t.space[4],
    flexDirection: 'row',
  },
  seg: { flex: 1, borderRadius: t.radius.segmentInner, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.space[8] },
  segOn: { backgroundColor: t.colors.surface, ...t.shadow.segmentSelected },
  segTrackSmall: {
    height: t.size.segmentSmall,
    borderRadius: t.radius.segmentInner,
    backgroundColor: t.colors.surfaceSunken,
    padding: 3,
    gap: 2,
    flexDirection: 'row',
  },
  segSmall: { borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.space[10] },
  segOnSmall: { backgroundColor: t.colors.surface, ...t.shadow.segmentSelected },
  segSmallText: { fontFamily: t.typography.label.fontFamily },
  stepper: {
    height: t.size.stepper,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.outline,
    paddingHorizontal: t.space[14],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[14],
    backgroundColor: t.colors.surface,
  },
  stepperCompact: {
    height: t.size.stepperCompact,
    borderRadius: t.radius.pill,
    borderWidth: 1.5,
    borderColor: t.colors.outline,
    paddingHorizontal: t.space[8],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[10],
    alignSelf: 'flex-start',
    backgroundColor: t.colors.surface,
  },
  value: { minWidth: 18, textAlign: 'center', fontFamily: t.typography.button.fontFamily },
  valueCompact: { minWidth: 12, textAlign: 'center', fontFamily: t.typography.badge.fontFamily },
}));
