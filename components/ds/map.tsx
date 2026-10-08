import { forwardRef, type ReactNode } from 'react';
import { TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { createStyles, Icon, useTheme, type IconName } from '@/theme';
import { Spinner } from './spinner';
import { MAX_FONT_SCALE, Text } from './text';
import { Touchable } from './touchable';

// ---------------------------------------------------------------------------
// MapPin — 40 teardrop (ink; danger on error), 12 inner dot (primary while
// choosing, white otherwise), 10×4 ground shadow, optional label bubble above
// with the street and mono coordinates, optional 96 searching halo.
//
// The component's box is exactly the pin body + tip (48 tall), so a parent
// that wants the tip on a point translates it up by PIN_TIP_OFFSET.
// ---------------------------------------------------------------------------

export const PIN_HEIGHT = 48;
/** Translate a centred pin by this to put its tip on the centre. */
export const PIN_TIP_OFFSET = -PIN_HEIGHT / 2;

export function MapPin({
  label,
  coords,
  choosing,
  error,
  halo,
}: {
  label?: string | null;
  coords?: { latitude: number; longitude: number } | null;
  /** Orange inner dot while the user is moving the map. */
  choosing?: boolean;
  error?: boolean;
  /** Searching halo (locating). */
  halo?: boolean;
}) {
  const styles = useStyles();
  return (
    <View style={styles.pinBox} pointerEvents="none">
      {halo ? <View style={styles.halo} /> : null}
      <View style={styles.ground} />
      <View style={[styles.drop, error && styles.dropError]}>
        <View style={[styles.dot, choosing && !error && styles.dotChoosing]} />
      </View>
      {label ? (
        <View style={styles.bubble}>
          <Text variant="meta" numberOfLines={1} style={styles.bubbleTitle}>
            {label}
          </Text>
          {coords ? (
            <Text variant="coords" color="inkMuted" align="center">
              {`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// MapSearchPill — 56 white pill floating over the map: inner back button,
// input, trailing search (or clear while typing).
// ---------------------------------------------------------------------------

export const MapSearchPill = forwardRef<
  TextInput,
  Omit<TextInputProps, 'style'> & {
    onBack: () => void;
    onClear?: () => void;
    onSearch?: () => void;
    busy?: boolean;
    style?: StyleProp<ViewStyle>;
  }
>(function MapSearchPill({ onBack, onClear, onSearch, busy, value, style, ...inputProps }, ref) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.pill, style]}>
      <Touchable onPress={onBack} accessibilityLabel="Back" style={styles.pillBack}>
        <Icon name="back" size="row" />
      </Touchable>
      <TextInput
        ref={ref}
        value={value}
        placeholderTextColor={colors.inkSubtle}
        cursorColor={colors.primary}
        selectionColor={colors.primary}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        returnKeyType="search"
        autoCorrect={false}
        style={styles.pillInput}
        {...inputProps}
      />
      {busy ? (
        <View style={styles.pillTrailing}>
          <Spinner />
        </View>
      ) : value && onClear ? (
        <Touchable onPress={onClear} accessibilityLabel="Clear search" hitSlop={10} style={styles.pillTrailing}>
          <Icon name="close" />
        </Touchable>
      ) : (
        <Touchable onPress={onSearch} accessibilityLabel="Search" hitSlop={10} style={styles.pillTrailing}>
          <Icon name="search" />
        </Touchable>
      )}
    </View>
  );
});

// ---------------------------------------------------------------------------
// LocateButton — floating 44 white circle with shadow.
// ---------------------------------------------------------------------------

export function LocateButton({
  onPress,
  busy,
  style,
}: {
  onPress: () => void;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <Touchable onPress={onPress} disabled={busy} accessibilityLabel="Use my location" style={[styles.locate, style]}>
      {busy ? <Spinner /> : <Icon name="locate" />}
    </Touchable>
  );
}

// ---------------------------------------------------------------------------
// MapSheet — map bottom sheet: top radius 28, sheet shadow, padding 10×24,
// gap 16, 36×4 grabber.
// ---------------------------------------------------------------------------

export function MapSheet({ children, bottomInset = 0 }: { children: ReactNode; bottomInset?: number }) {
  const styles = useStyles();
  const { space } = useTheme();
  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, space[16]) }]}>
      <View style={styles.grabber} />
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// TypeTile — address type, 2-column grid. Selected: white, 2 ink border, ink
// well with a white icon.
// ---------------------------------------------------------------------------

export function TypeTile({
  icon,
  label,
  selected,
  onPress,
}: {
  icon: IconName;
  label: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  return (
    <Touchable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={[styles.tile, selected && styles.tileOn]}
    >
      <View style={[styles.tileWell, selected && styles.tileWellOn]}>
        <Icon name={icon} size="row" color={selected ? 'onInk' : 'ink'} />
      </View>
      <Text variant="itemLabel" numberOfLines={1} style={styles.flex}>
        {label}
      </Text>
    </Touchable>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  pinBox: { width: 40, height: PIN_HEIGHT, alignItems: 'center' },
  // The teardrop: a 40 circle with one square-ish corner, turned so the corner
  // points down.
  drop: {
    width: 40,
    height: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 4,
    backgroundColor: t.colors.ink,
    transform: [{ rotate: '-45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropError: { backgroundColor: t.colors.danger },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: t.colors.surface },
  dotChoosing: { backgroundColor: t.colors.primary },
  ground: {
    position: 'absolute',
    bottom: -4,
    width: 10,
    height: 4,
    borderRadius: 5,
    backgroundColor: t.colors.spinnerTrack,
  },
  halo: {
    position: 'absolute',
    top: PIN_HEIGHT - 48,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: t.colors.pinHalo,
    alignSelf: 'center',
  },
  bubble: {
    position: 'absolute',
    bottom: PIN_HEIGHT + t.space[8],
    minWidth: 140,
    maxWidth: 240,
    backgroundColor: t.colors.surface,
    borderRadius: t.radius.control,
    paddingVertical: t.space[8],
    paddingHorizontal: t.space[12],
    alignItems: 'center',
    ...t.shadow.floatingButton,
  },
  bubbleTitle: { fontFamily: t.typography.itemTitle.fontFamily },
  pill: {
    height: t.size.mapSearchPill,
    borderRadius: t.size.mapSearchPill / 2,
    backgroundColor: t.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 6,
    paddingRight: t.space[8],
    gap: t.space[10],
    ...t.shadow.floatingButton,
  },
  pillBack: {
    width: t.size.iconButton,
    height: t.size.iconButton,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillInput: { flex: 1, ...t.typography.input, color: t.colors.ink, paddingVertical: 0 },
  pillTrailing: { width: t.size.minTouch, height: t.size.minTouch, alignItems: 'center', justifyContent: 'center' },
  locate: {
    width: t.size.iconButton,
    height: t.size.iconButton,
    borderRadius: t.radius.pill,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...t.shadow.floatingButton,
  },
  sheet: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: t.radius.sheet,
    borderTopRightRadius: t.radius.sheet,
    paddingTop: t.space[10],
    paddingHorizontal: t.screenPadding,
    gap: t.space[16],
    ...t.shadow.sheet,
  },
  grabber: {
    alignSelf: 'center',
    width: t.size.sheetGrabber.w,
    height: t.size.sheetGrabber.h,
    borderRadius: 2,
    backgroundColor: t.colors.outline,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    height: t.size.typeTile,
    borderRadius: t.radius.thumb,
    paddingHorizontal: t.space[14],
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[12],
    backgroundColor: t.colors.surfaceMuted,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileOn: { backgroundColor: t.colors.surface, borderColor: t.colors.ink },
  tileWell: {
    width: t.size.iconWell,
    height: t.size.iconWell,
    borderRadius: t.radius.control,
    backgroundColor: t.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileWellOn: { backgroundColor: t.colors.ink },
}));
