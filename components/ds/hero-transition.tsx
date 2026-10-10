import { useEffect, useRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { createStyles, useTheme } from '@/theme';

/** A rect in window coordinates (`measureInWindow`). */
export interface WindowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a tapped card's photo was, and what it showed. */
export interface HeroOrigin {
  rect: WindowRect;
  source: ImageSource;
}

/** `open`: card → hero. `close`: hero → back into the card. */
type Direction = 'open' | 'close';
/** `flying`: the photo travels. `landed`: it is in place and fades out over the real one. */
type Phase = 'flying' | 'landed';

interface Transition extends HeroOrigin {
  restaurantId: string;
  direction: Direction;
  /** How far the restaurant page was scrolled when closing — the hero starts that far up. */
  heroScroll: number;
  phase: Phase;
  id: number;
}

interface HeroTransitionState {
  current: Transition | null;
  /** The card the last restaurant was opened from — where `close` flies back to. */
  last: (HeroOrigin & { restaurantId: string }) | null;
  open: (restaurantId: string, origin: HeroOrigin) => void;
  close: (restaurantId: string, heroScroll: number) => boolean;
  land: (id: number) => void;
  clear: (id: number) => void;
}

let nextId = 1;

const useHeroTransitionStore = create<HeroTransitionState>((set, get) => ({
  current: null,
  last: null,
  open: (restaurantId, origin) =>
    set({
      current: { ...origin, restaurantId, direction: 'open', heroScroll: 0, phase: 'flying', id: nextId++ },
      last: { ...origin, restaurantId },
    }),
  close: (restaurantId, heroScroll) => {
    const last = get().last;
    if (last?.restaurantId !== restaurantId) return false;
    set({
      current: { ...last, direction: 'close', heroScroll, phase: 'flying', id: nextId++ },
      last: null,
    });
    return true;
  },
  land: (id) => {
    const current = get().current;
    if (current?.id === id) set({ current: { ...current, phase: 'landed' } });
  },
  clear: (id) => {
    if (get().current?.id === id) set({ current: null });
  },
}));

/**
 * Card ⇄ restaurant hero hand-off:
 *   heroTransition.open(restaurant.id, origin); router.push(`/restaurant/${id}?hero=1`);
 *   heroTransition.close(restaurant.id, scrollY);   // as the restaurant screen is popped
 * The restaurant screen reads `useHeroTransition(id)` to hide its own photo
 * until the flying one lands; the card reads `useHeroCardHidden(id)` to hide
 * its photo while that photo is in the air.
 */
export const heroTransition = {
  open: (restaurantId: string, origin: HeroOrigin) => useHeroTransitionStore.getState().open(restaurantId, origin),
  /** Flies the hero back into the card it came from. `false` when it was not opened from one. */
  close: (restaurantId: string, heroScroll: number) =>
    useHeroTransitionStore.getState().close(restaurantId, heroScroll),
};

/** This restaurant's OPENING phase, or `null` when it was opened without one. */
export function useHeroTransition(restaurantId: string | undefined): Phase | null {
  return useHeroTransitionStore((s) =>
    s.current?.direction === 'open' && restaurantId && s.current.restaurantId === restaurantId
      ? s.current.phase
      : null,
  );
}

/** True while this card's photo is the one flying, either way. */
export function useHeroCardHidden(restaurantId: string): boolean {
  return useHeroTransitionStore((s) => s.current?.restaurantId === restaurantId && s.current.phase === 'flying');
}

const FLY = {
  open: { duration: 480, easing: Easing.bezier(0.2, 0.8, 0.2, 1) },
  close: { duration: 420, easing: Easing.bezier(0.4, 0, 0.2, 1) },
} as const;
/** Cross-fade from the flying photo to the real one once it has landed. */
const HERO_FADE_MS = 220;

/**
 * Mounted once at the root, above the navigator. Draws the card's photo and
 * moves it between the card's frame and the restaurant hero's (full width,
 * `restaurantHero` + top inset): growing and squaring off on open, shrinking
 * and rounding back into the card on close.
 */
export function HeroTransitionHost() {
  const styles = useStyles();
  const current = useHeroTransitionStore((s) => s.current);
  const land = useHeroTransitionStore((s) => s.land);
  const clear = useHeroTransitionStore((s) => s.clear);
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { size, radius } = useTheme();
  const hostRef = useRef<View>(null);

  const progress = useSharedValue(0);
  const opacity = useSharedValue(0);
  // The host's own window offset, so a window rect maps onto it exactly.
  const offset = useSharedValue({ x: 0, y: 0 });

  const id = current?.id;
  const phase = current?.phase;
  const direction = current?.direction ?? 'open';

  useEffect(() => {
    if (id == null) return;
    hostRef.current?.measureInWindow((x, y) => offset.set({ x, y }));
    progress.set(0);
    opacity.set(1);
    progress.set(
      withTiming(1, FLY[direction], (finished) => {
        if (finished) runOnJS(land)(id);
      }),
    );
  }, [id, direction, land, offset, opacity, progress]);

  useEffect(() => {
    if (id == null || phase !== 'landed') return;
    // A beat so the real photo has painted under the flying copy first.
    opacity.set(
      withDelay(
        60,
        withTiming(0, { duration: HERO_FADE_MS }, (finished) => {
          if (finished) runOnJS(clear)(id);
        }),
      ),
    );
  }, [id, phase, clear, opacity]);

  const card = current?.rect;
  const hero = { y: -(current?.heroScroll ?? 0), width: windowWidth, height: size.restaurantHero + insets.top };
  const cardRadius = radius.card;
  const opening = direction === 'open';

  const style = useAnimatedStyle(() => {
    if (!card) return { opacity: 0 };
    const { x: ox, y: oy } = offset.get();
    // 0 = sitting in the card, 1 = filling the hero.
    const t = opening ? progress.get() : 1 - progress.get();
    const cardX = card.x - ox;
    const cardY = card.y - oy;
    return {
      opacity: opacity.get(),
      left: cardX + (0 - cardX) * t,
      top: cardY + (hero.y - cardY) * t,
      width: card.width + (hero.width - card.width) * t,
      height: card.height + (hero.height - card.height) * t,
      borderRadius: cardRadius * (1 - t),
    };
  }, [card, opening, hero.y, hero.width, hero.height, cardRadius]);

  return (
    <View ref={hostRef} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {current ? (
        <Animated.View style={[styles.photo, style]}>
          <Image source={current.source} style={styles.fill} contentFit="cover" />
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles(() => ({
  photo: { position: 'absolute', overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
}));
