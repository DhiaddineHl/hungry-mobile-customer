import type { ReactNode, Ref } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, useTheme } from '@/theme';
import { Counter } from './badges';
import { IconButton } from './buttons';

/**
 * HeroHeader — full-bleed photo (restaurant 220, dish 194) with floating
 * 44 pt white buttons: back on the left; favourite + cart on the right.
 * Plain white circles, NO shadow (design system §4.4). The cart button goes to
 * the Cart tab.
 */
export function HeroHeader({
  source,
  height,
  onBack,
  isFavorite,
  onFavorite,
  onCart,
  dimmed,
  children,
  cartRef,
  cartStyle,
  cartCount = 0,
}: {
  source: ImageSource | number | undefined;
  height: number;
  onBack: () => void;
  isFavorite?: boolean;
  onFavorite?: () => void;
  onCart?: () => void;
  /** Closed restaurant: the photo stays, a touch quieter. */
  dimmed?: boolean;
  /** Overlays on the photo (dish discount badge). */
  children?: ReactNode;
  /** Wrapper around the cart button — measured as the fly-to-cart target. */
  cartRef?: Ref<View>;
  /** Animated style on that wrapper (the landing pulse). */
  cartStyle?: StyleProp<AnimatedStyle<ViewStyle>>;
  /** Units in the cart — drawn as the orange counter on the cart button. */
  cartCount?: number;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { height: height + insets.top }]}>
      <Image source={source} style={[styles.fill, dimmed && styles.dimmed]} contentFit="cover" transition={150} />
      {children}
      <View style={[styles.buttons, { top: insets.top + 4 }]}>
        <IconButton icon="back" variant="floating" onPress={onBack} accessibilityLabel="Back" />
        <View style={styles.right}>
          {onFavorite ? (
            <IconButton
              icon="favourite"
              variant="floating"
              filled={isFavorite}
              iconColor={isFavorite ? 'primary' : 'ink'}
              onPress={onFavorite}
              accessibilityLabel={isFavorite ? 'Remove from favourites' : 'Favourite'}
            />
          ) : null}
          {onCart ? (
            <Animated.View ref={cartRef} collapsable={false} style={cartStyle}>
              <IconButton
                icon="cart"
                variant="floating"
                onPress={onCart}
                accessibilityLabel={cartCount > 0 ? `Go to cart, ${cartCount} item${cartCount > 1 ? 's' : ''}` : 'Go to cart'}
                badge={cartCount > 0 ? <Counter count={cartCount} ring /> : undefined}
              />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** Restaurant logo on the hero: 80, radius 22, 3 white border, logo shadow. */
export function HeroLogo({ source, style }: { source: ImageSource | undefined; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const { size } = useTheme();
  return (
    <View style={[styles.logo, { width: size.restaurantLogo, height: size.restaurantLogo }, style]}>
      <Image source={source} style={styles.logoImage} contentFit="cover" />
    </View>
  );
}

const useStyles = createStyles((t) => ({
  hero: { backgroundColor: t.colors.skeleton, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  dimmed: { opacity: 0.85 },
  buttons: {
    position: 'absolute',
    left: t.chromePadding,
    right: t.chromePadding,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  right: { flexDirection: 'row', gap: t.space[10] },
  logo: {
    borderRadius: t.radius.logo,
    borderWidth: 3,
    borderColor: t.colors.surface,
    backgroundColor: t.colors.surface,
    ...t.shadow.logo,
  },
  logoImage: { width: '100%', height: '100%', borderRadius: t.radius.logo - 3 },
}));
