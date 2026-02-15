import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { CartHeader, RestaurantCartCard, TrackOrdersSection } from '@/components/cart';

const CART_DATA = {
  restaurantName: 'Tacoth',
  restaurantLogo: require('@/assets/restaurants-images/restaurant-2.png'),
  rating: '92%',
  reviewCount: '1000+',
  items: [
    {
      id: '1',
      name: 'Crispy Chicken',
      quantity: 2,
      image: require('@/assets/products/product-2.png'),
    },
  ],
  totalItems: 2,
  totalPrice: '28,36 DT',
};

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleOrdersPress = () => {
    console.log('Orders pressed');
  };

  const handleViewCart = () => {
    router.push('/cart/tacoth');
  };

  const handleDeleteCart = () => {
    console.log('Delete cart');
  };

  const handleAddMore = () => {
    router.push('/restaurant/1');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <CartHeader onOrdersPress={handleOrdersPress} />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.divider} />

        <View style={styles.cartsSection}>
          <RestaurantCartCard
            {...CART_DATA}
            onViewCart={handleViewCart}
            onDelete={handleDeleteCart}
            onAddMore={handleAddMore}
          />
        </View>

        <TrackOrdersSection />
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
    paddingBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
    marginBottom: 20,
  },
  cartsSection: {
    marginBottom: 16,
  },
});
