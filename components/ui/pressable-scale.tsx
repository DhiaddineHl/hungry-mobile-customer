import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Duration } from '@/constants/theme';

interface PressableScaleProps {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Scale applied while pressed. Cards ~0.97, buttons ~0.95. */
  scaleTo?: number;
  /** Dim while pressed. */
  dimTo?: number;
  /** Fire a light haptic on press in. */
  haptic?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

function triggerHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/**
 * Tappable wrapper with UI-thread press feedback (scale + optional dim).
 *
 * Press animation runs entirely on the UI thread via Gesture.Tap worklets — no
 * JS round-trip — per the `animation-gesture-detector-press` rule. Only
 * transform/opacity are animated (GPU-accelerated). Shared values use
 * `.get()/.set()` for React Compiler compatibility.
 */
export function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  scaleTo = 0.96,
  dimTo = 1,
  haptic = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: PressableScaleProps) {
  const pressed = useSharedValue(0);

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .maxDuration(10000)
    .shouldCancelWhenOutside(true)
    .onBegin(() => {
      pressed.set(withTiming(1, { duration: Duration.fast }));
      if (haptic) runOnJS(triggerHaptic)();
    })
    .onFinalize(() => {
      pressed.set(withTiming(0, { duration: Duration.base }));
    })
    .onEnd(() => {
      if (onPress) runOnJS(onPress)();
    });

  const gesture = onLongPress
    ? Gesture.Exclusive(
        Gesture.LongPress()
          .minDuration(350)
          .onStart(() => {
            runOnJS(onLongPress)();
          }),
        tap,
      )
    : tap;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, scaleTo]) }],
    opacity: interpolate(pressed.get(), [0, 1], [1, dimTo]),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[style, animatedStyle]}
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
