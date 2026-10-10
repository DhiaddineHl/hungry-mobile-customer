import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { createStyles } from '@/theme';
import type { WindowRect } from './hero-transition';

/** Fly-to-cart: a photo shrinks into the cart button, which pulses as it lands. */
const FLY_MS = 650;
const LAND_PULSE_SPRING = { damping: 10, stiffness: 340, mass: 0.6 };
/** Pause after the landing pulse so it registers before `onDone` (e.g. a screen pop). */
const AFTER_LAND_MS = 220;

type ViewRef = RefObject<View | null>;

export function measureInWindow(ref: ViewRef): Promise<WindowRect | null> {
  return new Promise((resolve) => {
    if (!ref.current) return resolve(null);
    ref.current.measureInWindow((x, y, width, height) => resolve(width > 0 ? { x, y, width, height } : null));
  });
}

interface Flight {
  /** Both rects are local to `rootRef`. */
  from: WindowRect;
  to: WindowRect;
  source: ImageSource;
}

export interface FlyOptions {
  /** Where the photo starts: a view to measure, or a window rect already measured. */
  from: ViewRef | WindowRect | null;
  /** The cart button it lands in. */
  to: ViewRef;
  source: ImageSource;
  /** Units added by this flight — held back from `inFlightUnits` consumers until it lands. */
  units?: number;
  /** Runs once the photo has landed, or right away when the flight is skipped. */
  onDone?: () => void;
}

/**
 * Shrinks a copy of a photo into a cart button. Render `overlay` last inside
 * the view holding `rootRef` (it is positioned absolutely within it), put
 * `cartPulseStyle` on the cart button's wrapper, and subtract `inFlightUnits`
 * from the count the button shows so it ticks up when the photo lands, not
 * when the button is tapped. Skipped with reduced motion, while another flight
 * is in the air, or when anything can't be measured.
 */
export function useFlyToCart() {
  const styles = useStyles();
  const rootRef = useRef<View>(null);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [inFlightUnits, setInFlightUnits] = useState(0);
  // Set from takeoff until `onDone` has run — covers the post-landing pause too.
  const busy = useRef<{ units: number; onDone?: () => void } | null>(null);
  const flyProgress = useSharedValue(0);
  const cartPulse = useSharedValue(1);
  const reduceMotion = useReducedMotion();

  const cartPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: cartPulse.get() }] }));

  const onLanded = useCallback(() => {
    const current = busy.current;
    setFlight(null);
    setInFlightUnits((n) => Math.max(0, n - (current?.units ?? 0)));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    cartPulse.set(withSequence(withSpring(1.25, LAND_PULSE_SPRING), withSpring(1, LAND_PULSE_SPRING)));
    setTimeout(() => {
      busy.current = null;
      current?.onDone?.();
    }, AFTER_LAND_MS);
  }, [cartPulse]);

  // Started once the flying copy is mounted at its starting frame.
  useEffect(() => {
    if (!flight) return;
    flyProgress.set(0);
    flyProgress.set(
      withTiming(1, { duration: FLY_MS, easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(onLanded)();
      }),
    );
  }, [flight, flyProgress, onLanded]);

  // Size and corner radius ease in-out; x leads and y lags, so the photo
  // travels on a slight arc instead of a straight diagonal. It lands a little
  // smaller than the button and fades as it drops in.
  const flightStyle = useAnimatedStyle(() => {
    if (!flight) return { opacity: 0 };
    const { from, to } = flight;
    const p = flyProgress.get();
    const sizeT = Easing.inOut(Easing.cubic)(p);
    const xT = Easing.out(Easing.cubic)(p);
    const yT = Easing.in(Easing.quad)(p);
    const endW = to.width * 0.6;
    const endH = to.height * 0.6;
    const width = from.width + (endW - from.width) * sizeT;
    const height = from.height + (endH - from.height) * sizeT;
    const fromCx = from.x + from.width / 2;
    const fromCy = from.y + from.height / 2;
    const cx = fromCx + (to.x + to.width / 2 - fromCx) * xT;
    const cy = fromCy + (to.y + to.height / 2 - fromCy) * yT;
    return {
      left: cx - width / 2,
      top: cy - height / 2,
      width,
      height,
      borderRadius: interpolate(sizeT, [0, 1], [0, endW / 2]),
      opacity: interpolate(p, [0, 0.8, 1], [1, 1, 0.2]),
    };
  }, [flight]);

  /**
   * Call in the same handler as the cart add: the held-back units are set
   * synchronously so the counter never flashes the new total early.
   */
  const fly = ({ from, to, source, units = 1, onDone }: FlyOptions) => {
    if (reduceMotion || busy.current) {
      onDone?.();
      return;
    }
    busy.current = { units, onDone };
    setInFlightUnits((n) => n + units);
    const skip = () => {
      busy.current = null;
      setInFlightUnits((n) => Math.max(0, n - units));
      onDone?.();
    };
    void Promise.all([
      measureInWindow(rootRef),
      from && 'current' in from ? measureInWindow(from) : Promise.resolve(from),
      measureInWindow(to),
    ]).then(([root, start, target]) => {
      if (!root || !start || !target) return skip();
      const local = (r: WindowRect): WindowRect => ({
        ...r,
        x: r.x - root.x,
        y: r.y - root.y,
      });
      setFlight({ from: local(start), to: local(target), source });
    });
  };

  /** Whether a flight (or its post-landing pause) is still running. */
  const isFlying = () => busy.current !== null;

  // The photo in flight; above everything, untouchable.
  const overlay = flight ? (
    <Animated.View pointerEvents="none" style={[styles.flight, flightStyle]}>
      <Image source={flight.source} style={styles.flightImage} contentFit="cover" />
    </Animated.View>
  ) : null;

  return { rootRef, cartPulseStyle, inFlightUnits, fly, isFlying, overlay };
}

const useStyles = createStyles(() => ({
  flight: { position: 'absolute', overflow: 'hidden' },
  flightImage: { width: '100%', height: '100%' },
}));
