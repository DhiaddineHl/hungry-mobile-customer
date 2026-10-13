import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, useTheme } from '@/theme';
import { IconButton } from './buttons';
import { AccentHeadline, Text } from './text';

// ---------------------------------------------------------------------------
// TopBar — outlined back + sectionTitle + optional trailing. Margin 4×16.
// ---------------------------------------------------------------------------

export function TopBar({
  title,
  onBack,
  trailing,
  divider,
  center,
  accent = true,
  backLabel = 'Back',
  style,
}: {
  title?: string;
  /** Omit to render without a back button (tab roots that scroll). */
  onBack?: () => void;
  trailing?: ReactNode;
  /** 1 pt divider below — scrolling pages. */
  divider?: boolean;
  /** Centred title, no back (Profile scrolled). */
  center?: boolean;
  /** Orange full stop after the title, like every page title. Off for names (a dish, a restaurant). */
  accent?: boolean;
  backLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[divider && styles.dividerLine, style]}>
      <View style={[styles.bar, center && styles.barCenter]}>
        {onBack ? <IconButton icon="back" onPress={onBack} accessibilityLabel={backLabel} /> : null}
        {title ? (
          <Text
            variant="sectionTitle"
            numberOfLines={1}
            accessibilityRole="header"
            style={[styles.title, center && styles.titleCenter]}
          >
            {title}
            {accent && !/[.?!]$/.test(title) ? (
              <Text variant="sectionTitle" color="primary">
                .
              </Text>
            ) : null}
          </Text>
        ) : (
          <View style={styles.title} />
        )}
        {trailing}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// PageTitle — a tab root's board title: display size, ink, orange full stop,
// optional trailing actions. One component so every tab reads the same.
// ---------------------------------------------------------------------------

export function PageTitle({
  title,
  trailing,
  style,
}: {
  title: string;
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.pageTitle, style]}>
      <AccentHeadline text={title} accent="." numberOfLines={1} style={styles.title} />
      {trailing}
    </View>
  );
}

// ---------------------------------------------------------------------------
// BottomBar — absolute bottom, divider top, padding 12×24, then the home
// indicator / safe area. Scroll content pads by `useBottomBarInset()`.
// ---------------------------------------------------------------------------

/** Height the bar covers — give scroll content this much bottom padding. */
export function useBottomBarInset(withSafeArea = true): number {
  const insets = useSafeAreaInsets();
  const { size, space } = useTheme();
  return space[12] + size.button + (withSafeArea ? Math.max(insets.bottom, space[12]) : space[12]);
}

export function BottomBar({
  children,
  absolute = true,
  withSafeArea = true,
  style,
}: {
  children: ReactNode;
  /** Pinned over the scroll view (default). `false` flows at the end of a column layout. */
  absolute?: boolean;
  /** Off above a tab bar, which already sits over the home indicator. */
  withSafeArea?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { space } = useTheme();
  return (
    <View
      style={[
        styles.bottomBar,
        absolute && styles.bottomBarAbsolute,
        { paddingBottom: withSafeArea ? Math.max(insets.bottom, space[12]) : space[12] },
        style,
      ]}
    >
      <View style={styles.bottomRow}>{children}</View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  dividerLine: { borderBottomWidth: 1, borderBottomColor: t.colors.divider },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.space[12],
    marginHorizontal: t.chromePadding,
    marginVertical: t.space[4],
    minHeight: t.size.iconButton,
  },
  barCenter: { justifyContent: 'center' },
  pageTitle: { flexDirection: 'row', alignItems: 'center', gap: t.space[12], paddingTop: t.space[16] },
  title: { flex: 1 },
  titleCenter: { textAlign: 'center' },
  bottomBar: {
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.divider,
    paddingTop: t.space[12],
    paddingHorizontal: t.screenPadding,
  },
  bottomBarAbsolute: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[12] },
}));

// ---------------------------------------------------------------------------
// Screen — white page under the status bar. `edges` picks which safe-area
// insets it pads (top by default; bottom bars add their own).
// ---------------------------------------------------------------------------

export function Screen({
  children,
  edges = ['top'],
  style,
}: {
  children: ReactNode;
  edges?: ('top' | 'bottom')[];
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
