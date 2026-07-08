import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { Heart, Home, ShoppingCart, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts, FontSize, Palette, Radius } from '@/constants/theme';

const TAB_ICONS = {
  index: Home,
  favorites: Heart,
  cart: ShoppingCart,
  profile: User,
};

const TAB_LABELS: Record<string, string> = {
  index: 'Home',
  favorites: 'Favorites',
  cart: 'Cart',
  profile: 'Profile',
};

const SPRING = { damping: 18, stiffness: 200, mass: 0.8 };
const PILL_WIDTH = 52;
const PILL_HEIGHT = 40;
const BAR_PADDING_TOP = 10;

interface TabIconProps {
  routeName: string;
  isFocused: boolean;
  cartItemCount?: number;
}

function AnimatedTabIcon({
  routeName,
  isFocused,
  cartItemCount = 0,
}: TabIconProps) {
  const IconComponent = TAB_ICONS[routeName as keyof typeof TAB_ICONS];
  const active = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    active.set(withSpring(isFocused ? 1 : 0, SPRING));
  }, [isFocused, active]);

  // Icon lifts and scales up slightly as it becomes active.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(active.get(), [0, 1], [1, 1.12]) },
      { translateY: interpolate(active.get(), [0, 1], [0, -2]) },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(active.get(), [0, 1], [0.7, 1]),
  }));

  if (!IconComponent) return null;

  const showBadge = routeName === 'cart' && cartItemCount > 0;

  return (
    <View style={styles.tabContent}>
      <View style={styles.iconContainer}>
        <Animated.View style={iconStyle}>
          <IconComponent
            size={24}
            strokeWidth={isFocused ? 2.4 : 2}
            color={isFocused ? Palette.primary : Palette.textMuted}
          />
        </Animated.View>
        {showBadge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText} numberOfLines={1}>
              {cartItemCount > 9 ? '9+' : cartItemCount}
            </Text>
          </View>
        )}
      </View>
      <Animated.Text
        style={[
          styles.label,
          { color: isFocused ? Palette.primary : Palette.textMuted },
          isFocused && styles.labelActive,
          labelStyle,
        ]}
        numberOfLines={1}
      >
        {TAB_LABELS[routeName] ?? routeName}
      </Animated.Text>
    </View>
  );
}

interface CustomTabBarProps extends BottomTabBarProps {
  /** Number of items in the cart; drives the cart tab badge. */
  cartItemCount?: number;
}

export function CustomTabBar({
  state,
  descriptors,
  navigation,
  cartItemCount = 0,
}: CustomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const tabCount = state.routes.length;
  const tabWidth = barWidth > 0 ? barWidth / tabCount : 0;

  // Single highlight pill that slides horizontally to the active tab.
  const position = useSharedValue(state.index);

  useEffect(() => {
    position.set(withSpring(state.index, SPRING));
  }, [state.index, position]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: position.get() * tabWidth + (tabWidth - PILL_WIDTH) / 2 },
    ],
  }));

  const onBarLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  return (
    <View style={styles.container}>
      <View
        style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}
        onLayout={onBarLayout}
      >
        {tabWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.indicator, indicatorStyle]}
          />
        )}

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

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
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? route.name}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
              hitSlop={8}
            >
              <AnimatedTabIcon
                routeName={route.name}
                isFocused={isFocused}
                cartItemCount={route.name === 'cart' ? cartItemCount : 0}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent wrapper so nothing renders behind the bar's rounded corners.
  container: {
    backgroundColor: 'transparent',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: BAR_PADDING_TOP,
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    // Subtle lift only — no heavy gray halo around the corners.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 12,
  },
  indicator: {
    position: 'absolute',
    top: BAR_PADDING_TOP + (44 - PILL_HEIGHT) / 2,
    left: 0,
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    borderRadius: Radius.pill,
    backgroundColor: Palette.primarySoft,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContent: {
    alignItems: 'center',
    gap: 4,
  },
  iconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
  },
  labelActive: {
    fontFamily: Fonts.semiBold,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Palette.primary,
    borderWidth: 2,
    borderColor: Palette.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: FontSize.xs - 1,
    lineHeight: 14,
    fontFamily: Fonts.bold,
    color: Palette.textInverse,
  },
});
