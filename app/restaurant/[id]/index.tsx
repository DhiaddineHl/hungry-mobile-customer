import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RestaurantHeader, MenuFilterTabs, MenuSection } from '@/components/restaurant';
import { SearchBar } from '@/components/home';
import { TimingsModal } from '@/components/restaurant/timings-modal';

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

const TIMINGS = [
  { day: 'Monday', hours: '11:00 AM - 11:00 PM', isToday: false, isClosed: false },
  { day: 'Tuesday', hours: '00:00 AM - 6:00 AM && 11:00AM - 11:00 PM', isToday: false, isClosed: false },
  { day: 'Wednesday', hours: '11:00 AM - 11:00 PM', isToday: false, isClosed: false },
  { day: 'Thursday', hours: '00:00 AM - 6:00 AM && 11:00AM - 11:00 PM', isToday: false, isClosed: false },
  { day: 'Friday (Today)', hours: '00:00 AM - 6:00 AM && 11:00AM - 11:00 PM', isToday: true, isClosed: false },
  { day: 'Saturday', hours: '11:00 AM - 11:00 PM', isToday: false, isClosed: false },
  { day: 'Sunday', hours: 'Closed', isToday: false, isClosed: true },
];

const PROMOTIONS_PRODUCTS = [
  { id: 'p1', name: 'Double Crispy Deal', price: '24 DT', originalPrice: '30,9 DT', discount: '-10%', image: require('@/assets/products/product-1.png') },
  { id: 'p2', name: 'Crispy Chicken', price: '9,68 DT', originalPrice: '12,9 DT', discount: '-25%', image: require('@/assets/products/product-2.png') },
  { id: 'p3', name: 'Melty Crispy Chicken', price: '16,9 DT', image: require('@/assets/products/prodcut-3.png') },
];

const PICKED_FOR_YOU = [
  { id: 'pfy1', name: 'Crispy Chicken Taco Bowl', price: '13,9 DT', rating: '66%', reviewCount: '12', image: require('@/assets/products/product-4.png') },
  { id: 'pfy2', name: 'Melty Crispy Chicken', price: '16,9 DT', image: require('@/assets/products/prodcut-3.png') },
  { id: 'pfy3', name: 'Double Crispy Deal', price: '24 DT', originalPrice: '30,9 DT', discount: '-10%', rating: '70%', reviewCount: '20', image: require('@/assets/products/product-1.png') },
];

const CLASSIQUES = [
  { id: 'c1', name: 'Crispy Chicken', price: '9,68 DT', originalPrice: '12,9 DT', discount: '-25%', rating: '76%', reviewCount: '22', image: require('@/assets/products/product-2.png') },
  { id: 'c2', name: 'Cordon Bleu', price: '12,9 DT', image: require('@/assets/products/product-5.png') },
  { id: 'c3', name: 'Spicy Chicken', price: '12,9 DT', image: require('@/assets/products/product-1.png') },
  { id: 'c4', name: 'Beef Tacoth', price: '12,9 DT', image: require('@/assets/products/product-4.png') },
];

const SIGNATURES = [
  { id: 's1', name: 'Epic Spicy Chicken', price: '17,5 DT', image: require('@/assets/products/product-2.png') },
  { id: 's2', name: 'Ultimate Beef', price: '17,5 DT', image: require('@/assets/products/product-5.png') },
  { id: 's3', name: 'Melty Crispy Chicken', price: '16,9 DT', image: require('@/assets/products/prodcut-3.png') },
  { id: 's4', name: 'Gourmand Cordon Bleu', price: '15,9 DT', image: require('@/assets/products/product-1.png') },
];

const BOWLS = [
  { id: 'b1', name: 'Fajitas Taco Bowl', price: '14,9 DT', image: require('@/assets/products/product-4.png') },
  { id: 'b2', name: 'Spicy Chicken Taco Bowl', price: '13,9 DT', image: require('@/assets/products/product-5.png') },
  { id: 'b3', name: 'Crispy Chicken Taco Bown', price: '16,9 DT', image: require('@/assets/products/prodcut-3.png') },
];

export default function RestaurantDetailsScreen() {
  const { id: restaurantId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [selectedTab, setSelectedTab] = useState('promotions');
  const [searchQuery, setSearchQuery] = useState('');
  const [timingsVisible, setTimingsVisible] = useState(false);

  const handleBackPress = () => router.back();
  const handleFavoritePress = () => {};
  const handleMorePress = () => {};
  const handleProductPress = (productId: string) => router.push(`/food/${productId}`);
  const handleOpenPress = () => setTimingsVisible(true);
  const handleNamePress = () => router.push(`/restaurant/${restaurantId}/info`);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[1]}
      >
        <RestaurantHeader
          {...RESTAURANT_DATA}
          onBackPress={handleBackPress}
          onFavoritePress={handleFavoritePress}
          onMorePress={handleMorePress}
          onOpenPress={handleOpenPress}
          onNamePress={handleNamePress}
        />

        <View style={styles.stickyHeader}>
          <SearchBar
            value={searchQuery}
            placeholder="Search the menu"
            onChangeText={setSearchQuery}
          />
          <MenuFilterTabs
            selectedTab={selectedTab}
            onTabPress={setSelectedTab}
          />
        </View>

        <MenuSection title="" products={PROMOTIONS_PRODUCTS} onProductPress={handleProductPress} />
        <MenuSection title="Picked For You" products={PICKED_FOR_YOU} onProductPress={handleProductPress} />
        <MenuSection title="Les Tacoths Classiques" products={CLASSIQUES} onProductPress={handleProductPress} />
        <MenuSection title="Les Tacoths Signatures" products={SIGNATURES} onProductPress={handleProductPress} />
        <MenuSection title="Tacoth Bowls" products={BOWLS} onProductPress={handleProductPress} />
      </ScrollView>

      <TimingsModal
        visible={timingsVisible}
        timings={TIMINGS}
        onClose={() => setTimingsVisible(false)}
      />
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
  stickyHeader: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 3,
  },
});
