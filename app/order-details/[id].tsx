import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Phone, DollarSign, Clock, Info } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { DeliveryLocationCard, OrderInfoRow, OrderRestaurantRow } from '@/components/order';

const ORDER_DATA = {
  restaurantName: 'Tacoth',
  restaurantLogo: require('@/assets/restaurants-images/restaurant-2.png'),
  itemCount: 2,
  addressLabel: 'Home',
  addressText: 'RM4+4QR2, Sousse',
  latitude: 35.8256,
  longitude: 10.6369,
  phone: '+216 23 401 884',
  paymentMethod: 'Payment Method - Cash',
  estimatedTime: '~45 min',
  arrivalTime: 'Arrives at 12:00',
  subtotal: '28,36 DT',
  serviceFee: '3 DT',
  isFreeDelivery: true,
  originalDeliveryFee: '2,5 DT',
  total: '31,36 DT',
};

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  console.log('Order ID:', id);

  const handleContinueCheckout = () => {
    console.log('Continue to checkout');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1A2B3D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 20 }]}
      >
        <DeliveryLocationCard
          addressLabel={ORDER_DATA.addressLabel}
          addressText={ORDER_DATA.addressText}
          latitude={ORDER_DATA.latitude}
          longitude={ORDER_DATA.longitude}
        />

        <View style={styles.sectionDivider} />

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Order Info</Text>

          <OrderInfoRow
            icon={<Phone size={18} color="#1A2B3D" />}
            label={ORDER_DATA.phone}
          />

          <View style={styles.rowDivider} />

          <OrderInfoRow
            icon={<DollarSign size={18} color="#1A2B3D" />}
            label={ORDER_DATA.paymentMethod}
            rightContent={
              <View style={styles.paymentDropdown} />
            }
          />

          <View style={styles.rowDivider} />

          <View style={styles.timeRow}>
            <View style={styles.timeLeft}>
              <Clock size={18} color="#1A2B3D" />
              <Text style={styles.timeLabel}>{ORDER_DATA.estimatedTime}</Text>
            </View>
            <Text style={styles.arrivalText}>{ORDER_DATA.arrivalTime}</Text>
          </View>
        </View>

        <View style={styles.sectionDivider} />

        <Text style={styles.summarySectionTitle}>Order Summary</Text>

        <OrderRestaurantRow
          name={ORDER_DATA.restaurantName}
          itemCount={ORDER_DATA.itemCount}
          logo={ORDER_DATA.restaurantLogo}
        />

        <View style={styles.pricingCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Subtotal</Text>
            <Text style={styles.priceValue}>{ORDER_DATA.subtotal}</Text>
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceLabelRow}>
              <Text style={styles.priceLabel}>Service Fee</Text>
              <Info size={14} color="#8A8A8A" />
            </View>
            <Text style={styles.priceValue}>{ORDER_DATA.serviceFee}</Text>
          </View>

          <View style={styles.priceRow}>
            <View style={styles.priceLabelRow}>
              <Text style={styles.priceLabel}>Delivery Fee</Text>
              <Info size={14} color="#8A8A8A" />
            </View>
            <View style={styles.deliveryFeeRight}>
              <View style={styles.freeBadge}>
                <Text style={styles.freeText}>Free</Text>
              </View>
              <Text style={styles.strikePrice}>{ORDER_DATA.originalDeliveryFee}</Text>
            </View>
          </View>

          <View style={styles.totalDivider} />

          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Delivery Fee</Text>
            <Text style={styles.totalValue}>{ORDER_DATA.total}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={handleContinueCheckout}
          activeOpacity={0.9}
        >
          <Text style={styles.checkoutButtonText}>Continue to Checkout</Text>
        </TouchableOpacity>
      </View>
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
    gap: 0,
  },
  sectionDivider: {
    height: 8,
    backgroundColor: '#F5F5F5',
    marginVertical: 8,
  },
  sectionCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  timeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeLabel: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
  arrivalText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#8A8A8A',
  },
  paymentDropdown: {
    width: 0,
  },
  summarySectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  pricingCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceLabel: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1A2B3D',
  },
  priceValue: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
  deliveryFeeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  freeBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  freeText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#4CAF50',
  },
  strikePrice: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    textDecorationLine: 'line-through',
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  totalValue: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  checkoutButton: {
    backgroundColor: '#1A2B3D',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  checkoutButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
});
