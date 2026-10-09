import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Counter, Text } from '@/components/ds';
import { useTranslation, type TranslationKey } from '@/i18n';
import { selectCartItemCount, useCartStore } from '@/store/cart-store';
import { createStyles, Icon, useTheme, type IconName } from '@/theme';

const TAB_ICONS: Record<string, IconName> = {
  index: 'home',
  favorites: 'favourite',
  cart: 'cart',
  profile: 'profile',
};

const TAB_LABELS: Partial<Record<string, TranslationKey>> = {
  index: 'tabs.home',
  favorites: 'tabs.favorites',
  cart: 'tabs.cart',
  profile: 'tabs.profile',
};

const SPRING = { damping: 18, stiffness: 200, mass: 0.8 };
// Snappier than SPRING so the counter pop reads as a reaction to the tap.
const BADGE_SPRING = { damping: 12, stiffness: 320, mass: 0.6 };
const INDICATOR_WIDTH = 24;

function TabItem({
  routeName,
  isFocused,
  cartItemCount = 0,
}: {
  routeName: string;
  isFocused: boolean;
  cartItemCount?: number;
}) {
  const styles = useStyles();
  const { opacity } = useTheme();
  const { t } = useTranslation();
  const icon = TAB_ICONS[routeName];
  const labelKey = TAB_LABELS[routeName];

  // The counter pops on every change of the count, not just on the first item:
  // adding a second unit to a dish already in the cart changes only the digit,
  // which is easy to miss without the movement.
  const badgeScale = useSharedValue(cartItemCount > 0 ? 1 : 0);
  const previousCount = useRef(cartItemCount);

  useEffect(() => {
    const changed = previousCount.current !== cartItemCount;
    previousCount.current = cartItemCount;

    if (cartItemCount === 0) {
      // Hidden anyway at zero — reset so the next first item scales in from
      // nothing instead of appearing at full size.
      badgeScale.set(0);
      return;
    }
    if (!changed) return;

    badgeScale.set(withSequence(withSpring(1.3, BADGE_SPRING), withSpring(1, BADGE_SPRING)));
  }, [cartItemCount, badgeScale]);

  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: badgeScale.get() }] }));

  if (!icon) return null;
  const showBadge = routeName === 'cart' && cartItemCount > 0;

  return (
    <View style={styles.item}>
      {/* The counter is anchored to the icon box, not the item column: the
          column is as wide as the label, so a % offset drifted off the glyph. */}
      <View style={styles.iconBox}>
        <View style={{ opacity: isFocused ? 1 : opacity.tabInactiveIcon }}>
          <Icon name={icon} size="nav" />
        </View>
        {showBadge && (
          <Animated.View style={[styles.counter, badgeStyle]}>
            <Counter count={cartItemCount} />
          </Animated.View>
        )}
      </View>
      <Text variant="tabLabel" color={isFocused ? 'ink' : 'inkSubtle'} numberOfLines={1}>
        {labelKey ? t(labelKey) : routeName}
      </Text>
    </View>
  );
}

interface CustomTabBarProps extends BottomTabBarProps {
  /**
   * Overrides the counter. Left undefined in the app — the bar reads the cart
   * store itself so every screen that adds a line updates the counter without
   * threading a count through the navigator.
   */
  cartItemCount?: number;
}

/**
 * Tab bar (design system §6 Chrome): Home · Favourites · Cart · Profile.
 * Active tab: full-opacity icon, ink label, 24×3 orange indicator on the top
 * edge that slides between tabs. Inactive: icon at .45, inkSubtle label.
 */
export function CustomTabBar({ state, descriptors, navigation, cartItemCount }: CustomTabBarProps) {
  const styles = useStyles();
  const storeCartItemCount = useCartStore(selectCartItemCount);
  const badgeCount = cartItemCount ?? storeCartItemCount;
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [barWidth, setBarWidth] = useState(0);

  const tabCount = state.routes.length;
  const tabWidth = barWidth > 0 ? barWidth / tabCount : 0;

  const position = useSharedValue(state.index);
  useEffect(() => {
    position.set(withSpring(state.index, SPRING));
  }, [state.index, position]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.get() * tabWidth + (tabWidth - INDICATOR_WIDTH) / 2 }],
  }));

  const onRowLayout = (e: LayoutChangeEvent) => setBarWidth(e.nativeEvent.layout.width);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.row} onLayout={onRowLayout}>
        {tabWidth > 0 && <Animated.View pointerEvents="none" style={[styles.indicator, indicatorStyle]} />}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              Haptics.selectionAsync().catch(() => {});
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={
                options.tabBarAccessibilityLabel ??
                (route.name === 'cart' && badgeCount > 0
                  ? `${t('tabs.cart')}, ${badgeCount} item${badgeCount > 1 ? 's' : ''}`
                  : TAB_LABELS[route.name]
                    ? t(TAB_LABELS[route.name]!)
                    : route.name)
              }
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tab}
            >
              <TabItem
                routeName={route.name}
                isFocused={isFocused}
                cartItemCount={route.name === 'cart' ? badgeCount : 0}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  bar: {
    backgroundColor: t.colors.surface,
    borderTopWidth: 1,
    borderTopColor: t.colors.divider,
    paddingTop: t.space[8],
    paddingHorizontal: t.space[12],
  },
  row: { flexDirection: 'row' },
  // Sits on the bar's top edge: the item row starts 8 below it, the spec puts
  // the indicator at −9 from the item (over the 1 pt divider).
  indicator: {
    position: 'absolute',
    top: -9,
    left: 0,
    width: INDICATOR_WIDTH,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: t.colors.primary,
  },
  tab: { flex: 1, height: t.size.tabBarItem, alignItems: 'center', justifyContent: 'center' },
  item: { alignItems: 'center', gap: 4 },
  iconBox: { width: t.size.icon.nav, height: t.size.icon.nav },
  // Overlaps the glyph's top-right corner.
  counter: { position: 'absolute', top: -7, left: t.size.icon.nav - 9 },
}));
