import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, Heart, ThumbsUp } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';

interface FoodHeaderProps {
  name: string;
  price: string;
  originalPrice?: string;
  discount?: string;
  description?: string;
  rating?: string;
  reviewCount?: string;
  image: ReturnType<typeof require>;
  isFavorite?: boolean;
  onBack?: () => void;
  onFavorite?: () => void;
}

export function FoodHeader({
  name,
  price,
  originalPrice,
  discount,
  description,
  rating,
  reviewCount,
  image,
  isFavorite,
  onBack,
  onFavorite,
}: FoodHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View>
      <View style={styles.imageContainer}>
        <Image source={image} style={styles.image} contentFit="cover" />

        <View style={[styles.navRow, { top: insets.top + 8 }]}>
          <TouchableOpacity style={styles.navBtn} onPress={onBack}>
            <ArrowLeft size={20} color="#1A2B3D" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={onFavorite}>
            <Heart
              size={20}
              color={isFavorite ? '#FF4444' : '#1A2B3D'}
              fill={isFavorite ? '#FF4444' : 'transparent'}
            />
          </TouchableOpacity>
        </View>

        {discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{discount}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.name}>{name}</Text>
          {rating && (
            <View style={styles.ratingChip}>
              <ThumbsUp size={12} color="#F5A623" />
              <Text style={styles.ratingText}>{rating}</Text>
              {reviewCount && (
                <Text style={styles.reviewCount}>({reviewCount})</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{price}</Text>
          {originalPrice && (
            <Text style={styles.originalPrice}>{originalPrice}</Text>
          )}
        </View>

        {description && (
          <Text style={styles.description}>{description}</Text>
        )}
      </View>

      <View style={styles.sectionDivider} />
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    height: 240,
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  navRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#F5A623',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  info: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 22,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    flex: 1,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  ratingText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#F5A623',
  },
  reviewCount: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#F5A623',
  },
  originalPrice: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: '#AAAAAA',
    textDecorationLine: 'line-through',
  },
  description: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#666666',
    lineHeight: 20,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#F5F5F5',
  },
});
