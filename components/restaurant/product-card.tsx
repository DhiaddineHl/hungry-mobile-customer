import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ThumbsUp } from 'lucide-react-native';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';
import { PressableScale } from '@/components/ui/pressable-scale';

// Fixed width so cards form a horizontal carousel that hints at more items.
const CARD_WIDTH = 152;

interface ProductCardProps {
  id: string;
  name: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  rating?: string;
  reviewCount?: string;
  image: any;
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
        <Image source={image} style={styles.image} contentFit="cover" />
        {discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}</Text>
          </View>
        )}
      </View>
      <View style={styles.infoContainer}>
        <Text style={styles.name} numberOfLines={2}>{name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{price}</Text>
          {originalPrice && (
            <Text style={styles.originalPrice}>{originalPrice}</Text>
          )}
        </View>
        {rating && (
          <View style={styles.ratingRow}>
            <ThumbsUp size={12} color="#F5A623" />
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
