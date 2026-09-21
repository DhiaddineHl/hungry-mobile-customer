import { View, Text, StyleSheet } from 'react-native';
import { Image, type ImageSource } from 'expo-image';
import { ThumbsUp } from 'lucide-react-native';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { PRODUCT_IMAGE_PLACEHOLDER } from '@/constants/images';
import { PressableScale } from '@/components/ui/pressable-scale';

// Fixed width so cards form a horizontal carousel that hints at more items.
const CARD_WIDTH = 152;

/**
 * A card's artwork: an `expo-image` source (a backend URL, with the bearer
 * headers `/files/**` needs) or a bundled `require(...)` module id. Never
 * `any` — the two shapes are not interchangeable at the call site.
 */
export type ProductImage = ImageSource | number;

interface ProductCardProps {
  id: string;
  name: string;
  /** Absent when no price applies right now — see `selectPrice`. */
  price?: string;
  originalPrice?: string;
  discount?: string;
  rating?: string;
  reviewCount?: string;
  /** Absent when the product has no artwork; the placeholder fills in. */
  image?: ProductImage;
  onPress?: () => void;
}

export function ProductCard({
  name,
  price,
  originalPrice,
  discount,
  rating,
  reviewCount,
  image,
  onPress,
}: ProductCardProps) {
  return (
    <PressableScale
      style={styles.container}
      onPress={onPress}
      scaleTo={0.97}
      accessibilityLabel={name}
    >
      <View style={styles.imageContainer}>
        <Image
          source={image ?? { uri: PRODUCT_IMAGE_PLACEHOLDER }}
          style={styles.image}
          contentFit="cover"
        />
        {discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}</Text>
          </View>
        )}
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        {price ? (
          <View style={styles.priceRow}>
            <Text style={styles.price}>{price}</Text>
            {originalPrice && (
              <Text style={styles.originalPrice}>{originalPrice}</Text>
            )}
          </View>
        ) : (
          // No applicable price means unorderable, not free — say so rather
          // than leaving a blank where a number belongs.
          <Text style={styles.unavailable}>Currently unavailable</Text>
        )}
        {rating && (
          <View style={styles.ratingRow}>
            <ThumbsUp size={12} color={Palette.warning} />
            <Text style={styles.rating}>{rating}</Text>
            {reviewCount && <Text style={styles.reviewCount}>({reviewCount})</Text>}
          </View>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Palette.surfaceMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: Palette.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  discountText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Palette.textInverse,
  },
  infoContainer: {
    marginTop: Spacing.sm,
  },
  name: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Palette.textPrimary,
    marginBottom: Spacing.xs,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Palette.primary,
  },
  originalPrice: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
    textDecorationLine: 'line-through',
  },
  unavailable: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    color: Palette.textMuted,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  rating: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Palette.primary,
  },
  reviewCount: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Palette.textMuted,
  },
});
