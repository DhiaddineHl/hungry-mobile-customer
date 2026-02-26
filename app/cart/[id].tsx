import { CartItem, CheckoutButton, OrderSummary, SuggestedItems } from '@/components/cart';
import { Fonts } from '@/constants/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CART_ITEMS = [
  {
    id: '1',
    name: 'Crispy Chicken',
    description: 'Breaded Chicken Escalope, Bell Peppers, Caramelized ...',
    price: '9,68 DT',
    originalPrice: '12,9 DT',
    quantity: 2,
    image: require('@/assets/products/product-2.png'),
  },
];

const SUGGESTED_ITEMS = [
  {
    id: 's1',
    name: 'Boga - Lim (24Cl) Canette',
    price: '2,7 DT',
    image: require('@/assets/products/product-5.png'),
    isPopular: true,
  },
  {
    id: 's2',
    name: 'Nuggets (12 pcs)',
    description: '12 pieces of nuggets',
    price: '12,9 DT',
    image: require('@/assets/products/product-4.png'),
  },
  {
    id: 's3',
    name: 'Nuggets (12 pcs)',
    description: '12 pieces of nuggets',
    price: '12,9 DT',
    image: require('@/assets/products/prodcut-3.png'),
  },
];

export default function RestaurantCartScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [cartItems, setCartItems] = useState(CART_ITEMS);

  console.log('Cart ID:', id);

  const handleBackPress = () => {
    router.back();
  };

  const handleIncrement = (itemId: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const handleDecrement = (itemId: string) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === itemId && item.quantity > 1
          ? { ...item, quantity: item.quantity - 1 }
          : item
      )
    );
  };

  const handleDeleteItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleAddSuggestedItem = (itemId: string) => {
    console.log('Add suggested item:', itemId);
  };

  const handleAddItems = () => {
    router.push('/restaurant/1');
  };

  const handleCheckout = () => {
    router.push({
      pathname: '/order-details/[id]',
      params: { id },
    });
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={handleBackPress}>
          <ArrowLeft size={24} color="#1A2B3D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tacoth Cart</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.itemsSection}>
          {cartItems.map((item) => (
            <CartItem
              key={item.id}
              {...item}
              onIncrement={() => handleIncrement(item.id)}
              onDecrement={() => handleDecrement(item.id)}
              onDelete={() => handleDeleteItem(item.id)}
            />
          ))}

          <TouchableOpacity style={styles.addItemsButton} onPress={handleAddItems}>
            <Plus size={18} color="#1A2B3D" />
            <Text style={styles.addItemsText}>Add Items</Text>
          </TouchableOpacity>
        </View>

        <SuggestedItems
          title="Based On Your Choice"
          items={SUGGESTED_ITEMS}
          onAddItem={handleAddSuggestedItem}
        />

        <OrderSummary
          subtotal="28,36 DT"
          serviceFee="3 DT"
          deliveryFee="Free"
          originalDeliveryFee="2,5 DT"
          isFreeDelivery={true}
          total="31,36 DT"
        />
      </ScrollView>

      <CheckoutButton total="31,36 DT" onPress={handleCheckout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  itemsSection: {
    padding: 20,
    gap: 12,
  },
  addItemsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  addItemsText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
});
