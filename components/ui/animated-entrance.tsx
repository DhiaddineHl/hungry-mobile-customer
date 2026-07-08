import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ReduceMotion,
} from 'react-native-reanimated';
import { STAGGER_MS } from '@/constants/theme';

interface AnimatedEntranceProps {
  children: ReactNode;
  /** Position in a list/grid — drives the stagger delay. */
  index?: number;
  /** Base delay added before the staggered delay (ms). */
  delay?: number;
  /** Per-item stagger step (ms). */
  stagger?: number;
  /** Slide direction. "up" slides in from below (default), "none" just fades. */
  variant?: 'up' | 'fade';
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps content in a staggered entrance animation (fade + subtle slide).
 *
 * Uses Reanimated layout entering animations, animating only opacity/transform.
 * Respects the system "reduce motion" setting. Stagger items by ~60ms per the
 * `stagger-sequence` UX guideline.
 */
export function AnimatedEntrance({
  children,
  index = 0,
  delay = 0,
  stagger = STAGGER_MS,
  variant = 'up',
  style,
}: AnimatedEntranceProps) {
  const totalDelay = delay + index * stagger;

  const entering =
    variant === 'fade'
      ? FadeIn.delay(totalDelay).duration(260).reduceMotion(ReduceMotion.System)
      : FadeInDown.delay(totalDelay)
          .duration(320)
          .springify()
          .damping(18)
          .reduceMotion(ReduceMotion.System);

  return (
    <Animated.View style={style} entering={entering}>
      {children}
    </Animated.View>
  );
}
