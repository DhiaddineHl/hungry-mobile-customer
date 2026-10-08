import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles, useTheme } from '@/theme';
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
          {onCart ? <IconButton icon="cart" variant="floating" onPress={onCart} accessibilityLabel="Go to cart" /> : null}
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
