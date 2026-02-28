import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Fonts } from '@/constants/theme';

interface AddToCartBarProps {
  quantity: number;
  total: string;
  onDecrement: () => void;
  onIncrement: () => void;
  onAddToCart: () => void;
}

export function AddToCartBar({
  quantity,
  total,
  onDecrement,
  onIncrement,
  onAddToCart,
}: AddToCartBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <View style={styles.quantityControl}>
        <TouchableOpacity style={styles.quantityBtn} onPress={onDecrement}>
          <Minus size={18} color="#1A2B3D" />
        </TouchableOpacity>
        <Text style={styles.quantity}>{quantity}</Text>
        <TouchableOpacity style={styles.quantityBtn} onPress={onIncrement}>
          <Plus size={18} color="#1A2B3D" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.addBtn} onPress={onAddToCart} activeOpacity={0.9}>
        <Text style={styles.addBtnText}>Add for {total}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 28,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 4,
  },
  quantityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    minWidth: 28,
    textAlign: 'center',
  },
  addBtn: {
    flex: 1,
    backgroundColor: '#F5A623',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
});
