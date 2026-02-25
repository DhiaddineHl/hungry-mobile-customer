import { Fonts } from '@/constants/theme';
import { Image } from 'expo-image';
import { ChevronRight, Heart, Motorbike, Sparkles, ThumbsUp, Timer } from 'lucide-react-native';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Restaurant {
  id: string;
  name: string;
  categories: string;
  rating: string;
  deliveryTime: string;
  deliveryFee: string;
  isFreeDelivery: boolean;
  discount?: string;
  isNew?: boolean;
  isSponsored?: boolean;
  bannerImage: any;
  isFavorite?: boolean;
}

const RESTAURANTS: Restaurant[] = [
  {
    id: '1',
    name: 'Tacoth',
    categories: 'French Tacos',
    rating: '92%',
    deliveryTime: '30-45 min',
    deliveryFee: 'Free',
    isFreeDelivery: true,
    discount: 'Up to -20% off',
    isNew: true,
    bannerImage: require('@/assets/restaurants-images/restaurant-banner-1.png'),
    isFavorite: true,
  },
  {
    id: '2',
    name: 'Crepe Factory',
    categories: 'Sweets - Breakfast - Dessert',
    rating: '75%',
    deliveryTime: '15-30 min',
    deliveryFee: 'Free',
    isFreeDelivery: true,
    discount: 'Up to -32% off',
    bannerImage: require('@/assets/restaurants-images/restaruant-banner-2.png'),
    isFavorite: true,
  },
  {
    id: '3',
    name: 'Baguette',
    categories: 'Sandwiches - Burgers',
    rating: '96%',
    deliveryTime: '30-45 min',
    deliveryFee: '2,5DT',
    isFreeDelivery: false,
    isSponsored: true,
    bannerImage: require('@/assets/restaurants-images/restaurant-banner-3.png'),
    isFavorite: true,
  },
  {
    id: '4',
    name: "Papa John's",
    categories: 'Pizza - Burgers - Sandwiches',
    rating: '96%',
    deliveryTime: '30-45 min',
    deliveryFee: '2,5DT',
    isFreeDelivery: false,
    isSponsored: true,
    bannerImage: require('@/assets/restaurants-images/restaurant-banner-4.png'),
    isFavorite: true,
  },
];

interface RestaurantCardProps {
  restaurant: Restaurant;
  onPress?: () => void;
  onFavoritePress?: () => void;
}

function RestaurantCard({ restaurant, onPress, onFavoritePress }: RestaurantCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.bannerContainer}>
        <Image
          source={restaurant.bannerImage}
          style={styles.bannerImage}
          contentFit="cover"
        />
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={onFavoritePress}
        >
          <Heart
            size={18}
            color={restaurant.isFavorite ? '#F5A623' : '#FFFFFF'}
            fill={restaurant.isFavorite ? '#F5A623' : 'transparent'}
          />
        </TouchableOpacity>
        {restaurant.discount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>{restaurant.discount}</Text>
          </View>
        )}
        {restaurant.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newText}>NEW</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <View style={styles.nameRow}>
          {restaurant.isSponsored && (
            <Sparkles size={16} color="#F5A623" />
          )}
          <Text style={styles.restaurantName}>{restaurant.name}</Text>
        </View>
        <Text style={styles.categories}>{restaurant.categories}</Text>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <ThumbsUp size={14} color="#8A8A8A" />
            <Text style={styles.infoText}>{restaurant.rating}</Text>
          </View>
          <View style={styles.infoItem}>
            <Timer size={14} color="#8A8A8A" />
            <Text style={styles.infoText}>{restaurant.deliveryTime}</Text>
          </View>
          <View style={styles.infoItem}>
            <Motorbike size={14} color={restaurant.isFreeDelivery ? '#4CAF50' : '#8A8A8A'} />
            <Text
              style={[
                styles.infoText,
                restaurant.isFreeDelivery && styles.freeDeliveryText,
              ]}
            >
              {restaurant.deliveryFee}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface OpenRestaurantsProps {
  onRestaurantPress?: (restaurantId: string) => void;
  onSeeAllPress?: () => void;
  onFavoritePress?: (restaurantId: string) => void;
}

export function OpenRestaurants({
  onRestaurantPress,
  onSeeAllPress,
  onFavoritePress,
}: OpenRestaurantsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Open Restaurants</Text>
        <TouchableOpacity style={styles.seeAllButton} onPress={onSeeAllPress}>
          <Text style={styles.seeAllText}>See All</Text>
          <ChevronRight size={16} color="#F5A623" />
        </TouchableOpacity>
      </View>

      <View style={styles.restaurantsList}>
        {RESTAURANTS.map((restaurant) => (
          <RestaurantCard
            key={restaurant.id}
            restaurant={restaurant}
            onPress={() => onRestaurantPress?.(restaurant.id)}
            onFavoritePress={() => onFavoritePress?.(restaurant.id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    color: '#F5A623',
    fontFamily: Fonts.medium,
  },
  restaurantsList: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  bannerContainer: {
    height: 160,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  favoriteButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: '#1A2B3D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
  newBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F5A623',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  newText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  cardContent: {
    padding: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  restaurantName: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
  },
  categories: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#8A8A8A',
    fontFamily: Fonts.medium,
  },
  freeDeliveryText: {
    color: '#4CAF50',
  },
});
