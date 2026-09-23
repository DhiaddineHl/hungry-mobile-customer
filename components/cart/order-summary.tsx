import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Info } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

/** One labelled amount, both already formatted for display. */
export interface SummaryLine {
  label: string;
  amount: string;
}

interface OrderSummaryProps {
  subtotal: string;
  /** Promotions taken off the total, one line each — shown as a deduction. */
  discounts?: SummaryLine[];
  /** One delivery fee per restaurant: each order is delivered on its own. */
  deliveryFees: SummaryLine[];
  /** The app's fee for the cart, or `null` when none applies. */
  serviceFee?: string | null;
  /** Says how the service fee is shared when the cart becomes several orders. */
  serviceFeeNote?: string;
  /** Night, weather… surcharges. */
  additionalFees?: SummaryLine[];
  total: string;
  /**
   * True while a change to the cart is on its way to the server. The lines
   * above are then about to change, so the total says so instead of showing a
   * figure that is about to be wrong.
   */
  updating?: boolean;
  /**
   * Opens the fee explanations from `design/Cart Service Fee Info.png` and
   * `design/Cart Delivery Fee Info.png`. Optional so the two `Info` icons stay
   * decorative wherever the sheets are not mounted, rather than presenting a
   * dead control.
   */
  onServiceFeeInfo?: () => void;
  onDeliveryFeeInfo?: () => void;
}

/**
 * What the server says the cart costs, line by line. Nothing here is computed:
 * every amount arrives formatted from the cart the backend recalculated.
 */
export function OrderSummary({
  subtotal,
  discounts = [],
  deliveryFees,
  serviceFee,
  serviceFeeNote,
  additionalFees = [],
  total,
  updating = false,
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

        {discounts.map((discount, index) => (
          <View key={`discount-${index}`} style={styles.row}>
            <Text style={[styles.label, styles.discountLabel]} numberOfLines={1}>
              {discount.label}
            </Text>
            <Text style={[styles.value, styles.discountValue]}>−{discount.amount}</Text>
          </View>
        ))}

        {deliveryFees.length > 0 ? (
          deliveryFees.map((fee, index) => (
            <View key={`delivery-${index}`} style={styles.row}>
              <View style={styles.labelRow}>
                <Text style={styles.label} numberOfLines={1}>
                  {fee.label}
                </Text>
                {index === 0 ? (
                  <TouchableOpacity
                    onPress={onDeliveryFeeInfo}
                    disabled={!onDeliveryFeeInfo}
                    accessibilityLabel="What is the delivery fee?"
                    hitSlop={8}
                  >
                    <Info size={14} color="#8A8A8A" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <Text style={styles.value}>{fee.amount}</Text>
            </View>
          ))
        ) : null}

        {serviceFee ? (
          <View style={styles.row}>
            <View style={styles.labelRow}>
              <View>
                <Text style={styles.label}>Service Fee</Text>
                {serviceFeeNote ? <Text style={styles.note}>{serviceFeeNote}</Text> : null}
              </View>
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
        ) : null}

        {additionalFees.map((fee, index) => (
          <View key={`additional-${index}`} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>
              {fee.label}
            </Text>
            <Text style={styles.value}>{fee.amount}</Text>
          </View>
        ))}

        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{updating ? 'Updating…' : total}</Text>
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
    gap: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1A2B3D',
    flexShrink: 1,
  },
  note: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    marginTop: 2,
  },
  value: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
  discountLabel: {
    color: '#2E7D32',
  },
  discountValue: {
    color: '#2E7D32',
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
