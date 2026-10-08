import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme';

const SIZE = 18;
const STROKE = 2.5;

/**
 * 18 pt ring, 2.5 stroke, 0.8 s linear turn (design system §6 Feedback).
 * `onInk` for buttons (white arc on a 35 % white track), `default` on light
 * surfaces (ink arc on ink @18 %). Static under Reduce Motion.
 */
export function Spinner({ tone = 'default', size = SIZE }: { tone?: 'default' | 'onInk'; size?: number }) {
  const { colors, motion } = useTheme();
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    rotation.set(withRepeat(withTiming(360, { duration: motion.spinnerMs, easing: Easing.linear }), -1, false));
    return () => cancelAnimation(rotation);
  }, [reduceMotion, rotation, motion.spinnerMs]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  const r = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const arc = tone === 'onInk' ? colors.onInk : colors.ink;
  const track = tone === 'onInk' ? colors.spinnerTrackOnInk : colors.spinnerTrack;

  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={arc}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.28} ${circumference}`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
