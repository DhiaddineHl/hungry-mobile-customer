import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Fonts } from '@/constants/theme';

const POPULAR_RESTAURANTS = [
  {
    id: '1',
    name: 'Taxi Pizza',
    subtitle: 'Khzema',
    image: require('@/assets/restaurants-images/restaurant-1.png'),
    hasRoundedImage: true,
  },
  {
    id: '2',
    name: 'Tacoth',
    subtitle: '',
    image: require('@/assets/restaurants-images/restaurant-2.png'),
    hasRoundedImage: false,
    backgroundColor: '#F5A623',
  },
  {
    id: '3',
    name: 'Papadam Food',
    subtitle: 'Khzema',
    image: require('@/assets/restaurants-images/restaurant-3.png'),
    hasRoundedImage: true,
  },
];

interface PopularRestaurantsProps {
  onRestaurantPress?: (restaurantId: string) => void;
}

export function PopularRestaurants({ onRestaurantPress }: PopularRestaurantsProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Popular</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {POPULAR_RESTAURANTS.map((restaurant) => (
          <TouchableOpacity
            key={restaurant.id}
            style={styles.restaurantItem}
            onPress={() => onRestaurantPress?.(restaurant.id)}
          >
            <View
              style={[
                styles.imageContainer,
                restaurant.hasRoundedImage && styles.imageContainerRounded,
                restaurant.backgroundColor && { backgroundColor: restaurant.backgroundColor },
              ]}
            >
              <Image
                source={restaurant.image}
                style={[
                  styles.restaurantImage,
                  restaurant.hasRoundedImage && styles.restaurantImageRounded,
                ]}
                contentFit="contain"
              />
            </View>
            <Text style={styles.restaurantName}>{restaurant.name}</Text>
            {restaurant.subtitle ? (
              <Text style={styles.restaurantSubtitle}>{restaurant.subtitle}</Text>
            ) : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  restaurantItem: {
    alignItems: 'center',
    width: 100,
  },
  imageContainer: {
    width: 100,
    height: 100,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    overflow: 'hidden',
  },
  imageContainerRounded: {
    backgroundColor: 'transparent',
  },
  restaurantImage: {
    width: '100%',
    height: '100%',
  },
  restaurantImageRounded: {
    borderRadius: 20,
  },
  restaurantName: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
    textAlign: 'center',
  },
  restaurantSubtitle: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    textAlign: 'center',
    marginTop: 2,
  },
});
