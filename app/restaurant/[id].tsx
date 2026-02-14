import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RestaurantHeader, MenuFilterTabs, MenuSection } from '@/components/restaurant';
import { SearchBar } from '@/components/home';

const RESTAURANT_DATA = {
  id: '1',
  name: 'Tacoth',
  distance: '4 km',
  rating: '92%',
  reviewCount: '1000+',
  deliveryTime: '30-45 min',
  deliveryFee: '2,5 DT',
  isFreeDelivery: true,
  minOrder: '8DT',
  isOpen: true,
  isNew: true,
  isTopRated: true,
  discount: 'Up to -20% off',
  bannerImage: require('@/assets/restaurants-images/restaurant-banner-1.png'),
  logoImage: require('@/assets/restaurants-images/restaurant-2.png'),
  isFavorite: true,
};

const PROMOTIONS_PRODUCTS = [
  {
    id: 'p1',
    name: 'Double Crispy Deal',
    price: '24 DT',
    originalPrice: '30,9 DT',
    discount: '-10%',
    image: require('@/assets/products/product-1.png'),
  },
  {
    id: 'p2',
    name: 'Crispy Chicken',
    price: '9,68 DT',
    originalPrice: '12,9 DT',
    discount: '-25%',
    image: require('@/assets/products/product-2.png'),
  },
  {
    id: 'p3',
    name: 'Melty Crispy Chicken',
    price: '16,9 DT',
    image: require('@/assets/products/prodcut-3.png'),
  },
];

const PICKED_FOR_YOU = [
  {
    id: 'pfy1',
    name: 'Crispy Chicken Taco Bowl',
    price: '13,9 DT',
    rating: '66%',
    reviewCount: '12',
    image: require('@/assets/products/product-4.png'),
  },
  {
    id: 'pfy2',
    name: 'Melty Crispy Chicken',
    price: '16,9 DT',
    image: require('@/assets/products/prodcut-3.png'),
  },
  {
    id: 'pfy3',
    name: 'Double Crispy Deal',
    price: '24 DT',
    originalPrice: '30,9 DT',
    discount: '-10%',
    rating: '70%',
    reviewCount: '20',
    image: require('@/assets/products/product-1.png'),
  },
];

const CLASSIQUES = [
  {
    id: 'c1',
    name: 'Crispy Chicken',
    price: '9,68 DT',
    originalPrice: '12,9 DT',
    discount: '-25%',
    rating: '76%',
    reviewCount: '22',
    image: require('@/assets/products/product-2.png'),
  },
  {
    id: 'c2',
    name: 'Cordon Bleu',
    price: '12,9 DT',
    image: require('@/assets/products/product-5.png'),
  },
  {
    id: 'c3',
    name: 'Spicy Chicken',
    price: '12,9 DT',
    image: require('@/assets/products/product-1.png'),
  },
  {
    id: 'c4',
    name: 'Beef Tacoth',
    price: '12,9 DT',
    image: require('@/assets/products/product-4.png'),
  },
];

const SIGNATURES = [
  {
    id: 's1',
    name: 'Epic Spicy Chicken',
    price: '17,5 DT',
    image: require('@/assets/products/product-2.png'),
  },
  {
    id: 's2',
    name: 'Ultimate Beef',
    price: '17,5 DT',
    image: require('@/assets/products/product-5.png'),
  },
  {
    id: 's3',
    name: 'Melty Crispy Chicken',
    price: '16,9 DT',
    image: require('@/assets/products/prodcut-3.png'),
  },
  {
    id: 's4',
    name: 'Gourmand Cordon Bleu',
    price: '15,9 DT',
    image: require('@/assets/products/product-1.png'),
  },
];

const BOWLS = [
  {
    id: 'b1',
    name: 'Fajitas Taco Bowl',
    price: '14,9 DT',
    image: require('@/assets/products/product-4.png'),
  },
  {
    id: 'b2',
    name: 'Spicy Chicken Taco Bowl',
    price: '13,9 DT',
    image: require('@/assets/products/product-5.png'),
  },
  {
    id: 'b3',
    name: 'Crispy Chicken Taco Bown',
    price: '16,9 DT',
    image: require('@/assets/products/prodcut-3.png'),
  },
];

export default function RestaurantDetailsScreen() {
  const { id: restaurantId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  console.log('Restaurant ID:', restaurantId);
  const [selectedTab, setSelectedTab] = useState('promotions');
  const [searchQuery, setSearchQuery] = useState('');

  const handleBackPress = () => {
    router.back();
  };

  const handleFavoritePress = () => {
    console.log('Favorite pressed');
  };

  const handleMorePress = () => {
    console.log('More pressed');
  };

  const handleProductPress = (productId: string) => {
    console.log('Product pressed:', productId);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <RestaurantHeader
          {...RESTAURANT_DATA}
          onBackPress={handleBackPress}
          onFavoritePress={handleFavoritePress}
          onMorePress={handleMorePress}
        />

        <SearchBar
          value={searchQuery}
          placeholder="Search the menu"
          onChangeText={setSearchQuery}
        />

        <MenuFilterTabs
          selectedTab={selectedTab}
          onTabPress={setSelectedTab}
        />

        <MenuSection
          title=""
          products={PROMOTIONS_PRODUCTS}
          onProductPress={handleProductPress}
        />

        <MenuSection
          title="Picked For You"
          products={PICKED_FOR_YOU}
          onProductPress={handleProductPress}
        />

        <MenuSection
          title="Les Tacoths Classiques"
          products={CLASSIQUES}
          onProductPress={handleProductPress}
        />

        <MenuSection
          title="Les Tacoths Signatures"
          products={SIGNATURES}
          onProductPress={handleProductPress}
        />

        <MenuSection
          title="Tacoth Bowls"
          products={BOWLS}
          onProductPress={handleProductPress}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
});
