import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Info } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

interface OrderSummaryProps {
  subtotal: string;
  serviceFee: string;
  deliveryFee: string;
  originalDeliveryFee?: string;
  isFreeDelivery?: boolean;
  total: string;
  /**
   * Opens the fee explanations from `design/Cart Service Fee Info.png` and
   * `design/Cart Delivery Fee Info.png`. Optional so the two `Info` icons stay
   * decorative wherever the sheets are not mounted, rather than presenting a
   * dead control.
   */
  onServiceFeeInfo?: () => void;
  onDeliveryFeeInfo?: () => void;
}

export function OrderSummary({
  subtotal,
  serviceFee,
  deliveryFee,
  originalDeliveryFee,
  isFreeDelivery,
  total,
  onServiceFeeInfo,
  onDeliveryFeeInfo,
}: OrderSummaryProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Summary</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Subtotal</Text>
          <Text style={styles.value}>{subtotal}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Service Fee</Text>
            <TouchableOpacity
              onPress={onServiceFeeInfo}
              disabled={!onServiceFeeInfo}
              accessibilityLabel="What is the service fee?"
              hitSlop={8}
            >
              <Info size={14} color="#8A8A8A" />
            </TouchableOpacity>
          </View>
          <Text style={styles.value}>{serviceFee}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Delivery Fee</Text>
            <TouchableOpacity
              onPress={onDeliveryFeeInfo}
              disabled={!onDeliveryFeeInfo}
              accessibilityLabel="What is the delivery fee?"
              hitSlop={8}
            >
              <Info size={14} color="#8A8A8A" />
            </TouchableOpacity>
          </View>
          <View style={styles.deliveryFeeRow}>
            {isFreeDelivery && (
              <View style={styles.freeBadge}>
                <Text style={styles.freeText}>Free</Text>
              </View>
            )}
            {originalDeliveryFee && (
              <Text style={styles.originalFee}>{originalDeliveryFee}</Text>
            )}
            {/* The charged amount, shown whenever it is not waived — without
                this the row rendered nothing at all once the waiver ends. */}
            {!isFreeDelivery && <Text style={styles.value}>{deliveryFee}</Text>}
          </View>
        </View>

        <View style={[styles.row, styles.totalRow]}>
          {/* Reads `Total`, not `Delivery Fee`: the row has always shown the
              total, and the old label named the row above it. */}
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{total}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1A2B3D',
  },
  value: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
  deliveryFeeRow: {
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
  originalFee: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    textDecorationLine: 'line-through',
  },
  totalRow: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
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
});
