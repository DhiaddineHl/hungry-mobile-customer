import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { ThumbsUp } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;

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
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  imageContainer: {
    width: '100%',
    height: CARD_WIDTH,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#F5A623',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoContainer: {
    marginTop: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A2B3D',
    marginBottom: 4,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F5A623',
  },
  originalPrice: {
    fontSize: 12,
    color: '#8A8A8A',
    textDecorationLine: 'line-through',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  rating: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F5A623',
  },
  reviewCount: {
    fontSize: 12,
    color: '#8A8A8A',
  },
});
