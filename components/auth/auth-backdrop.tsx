import { StyleProp, StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import AuthArt from '@/assets/auth-page-upper-section.svg';
import { Palette } from '@/constants/theme';

/** Source viewBox of assets/auth-page-upper-section.svg — read, not guessed. */
const ART_WIDTH = 412;
const ART_HEIGHT = 917;

/** height / width — sizing from this keeps the artwork from ever distorting. */
export const AUTH_ART_RATIO = ART_HEIGHT / ART_WIDTH;

/**
 * Distance (in art units) between the landing frame and the resting login
 * frame. The two design exports (`design/LandingPageAnimated.svg` and
 * `design/loginPageAnimatedFinal.svg`) are the same artwork 307 units apart, so
 * the intro is a single translate rather than a second asset.
 *
 * Expressed per unit of screen width, because the art is scaled off the width.
 */
export const AUTH_LANDING_SHIFT_RATIO = 307 / ART_WIDTH;

interface AuthBackdropProps {
  /** Animated style owned by the screen, so the backdrop itself stays dumb. */
  heroStyle?: StyleProp<AnimatedStyle<ViewStyle>>;
}

/**
 * Full-bleed navy vector backdrop for the auth screens.
 *
 * The artwork is pinned top-left and sized from the window width so it keeps
 * its aspect ratio; anything taller than the screen is clipped. It never
 * receives touches — the card in front of it owns every tap.
 */
export function AuthBackdrop({ heroStyle }: AuthBackdropProps) {
  const { width } = useWindowDimensions();
  const artHeight = width * AUTH_ART_RATIO;

  return (
    <View style={styles.fill} pointerEvents="none">
      <Animated.View style={[styles.hero, { width, height: artHeight }, heroStyle]}>
        <AuthArt width={width} height={artHeight} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Palette.navy,
    // The artwork is taller than the screen — clip it instead of letting it
    // paint over the card.
    overflow: 'hidden',
  },
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
