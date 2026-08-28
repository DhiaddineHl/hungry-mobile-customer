import { Fonts, FontSize, Palette, Spacing } from '@/constants/theme';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

/**
 * The two-tab switch on My Orders.
 *
 * The underline is one shared element that slides between tabs, the same
 * pattern the tab bar's pill uses (`components/navigation/custom-tab-bar.tsx`),
 * so the two never drift apart in feel.
 */

const SPRING = { damping: 18, stiffness: 200, mass: 0.8 };

export interface OrderTab<T extends string> {
  key: T;
  label: string;
  /** Shown after the label when non-zero. */
  count?: number;
}

interface OrderTabSwitchProps<T extends string> {
  tabs: OrderTab<T>[];
  value: T;
  onChange: (key: T) => void;
}

export function OrderTabSwitch<T extends string>({
  tabs,
  value,
  onChange,
}: OrderTabSwitchProps<T>) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.key === value)
  );
  const position = useSharedValue(index);
  const tabWidth = tabs.length > 0 ? width / tabs.length : 0;

  useEffect(() => {
    position.set(withSpring(index, SPRING));
  }, [index, position]);

  const underlineStyle = useAnimatedStyle(() => ({
    width: tabWidth,
    transform: [{ translateX: position.get() * tabWidth }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.container} onLayout={onLayout}>
      <View style={styles.row}>
        {tabs.map((tab) => {
          const isActive = tab.key === value;
          return (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => onChange(tab.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              hitSlop={8}
            >
              <Text
                style={[styles.label, isActive && styles.labelActive]}
                numberOfLines={1}
              >
                {tab.label}
                {tab.count ? ` (${tab.count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.track}>
        {tabWidth > 0 ? (
          <Animated.View style={[styles.underline, underlineStyle]} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
  },
  row: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  label: {
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Palette.textMuted,
  },
  labelActive: {
    fontFamily: Fonts.semiBold,
    color: Palette.primary,
  },
  track: {
    height: 2,
    backgroundColor: Palette.borderSubtle,
  },
  underline: {
    height: 2,
    backgroundColor: Palette.primary,
  },
});
