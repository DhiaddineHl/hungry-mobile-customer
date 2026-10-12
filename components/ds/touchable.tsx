import * as Haptics from 'expo-haptics';
import { forwardRef } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface TouchableProps extends PressableProps {
  /** Scale while pressed. Defaults to the theme's `motion.pressScale` (0.98). */
  scaleTo?: number;
  /** Light haptic on press in. */
  haptic?: boolean;
}

/**
 * The tappable every primitive is built on. A plain `Pressable` underneath, so
 * two of them nest correctly (a favourite button inside a card) and tests can
 * `fireEvent.press` them; the press scale runs on the UI thread.
 */
export const Touchable = forwardRef<View, TouchableProps>(function Touchable(
  { scaleTo, haptic, onPressIn, onPressOut, style, disabled, accessibilityRole = 'button', accessibilityState, ...rest },
  ref,
) {
  const { motion } = useTheme();
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const target = scaleTo ?? motion.pressScale;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (1 - target) * pressed.get() }],
  }));

  const handlePressIn = (e: GestureResponderEvent) => {
    if (!reduceMotion) pressed.set(withTiming(1, { duration: 90 }));
    if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPressIn?.(e);
  };
  const handlePressOut = (e: GestureResponderEvent) => {
    pressed.set(withTiming(0, { duration: 160 }));
    onPressOut?.(e);
  };

  return (
    <AnimatedPressable
      ref={ref}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      // Pressable's style may be a function of `pressed`; the press feedback
      // here is the animated scale, so only static styles are accepted.
      style={[style as object, animatedStyle]}
      {...rest}
    />
  );
});
