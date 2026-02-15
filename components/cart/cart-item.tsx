import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Trash2, Minus, Plus } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

interface CartItemProps {
  id: string;
  name: string;
  description: string;
  price: string;
  originalPrice?: string;
  quantity: number;
  image: any;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onDelete?: () => void;
}

export function CartItem({
  name,
  description,
  price,
  originalPrice,
  quantity,
  image,
  onIncrement,
  onDecrement,
  onDelete,
}: CartItemProps) {
  return (
    <View style={styles.container}>
      <Image source={image} style={styles.image} contentFit="cover" />
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <TouchableOpacity onPress={onDelete}>
            <Trash2 size={18} color="#1A2B3D" />
          </TouchableOpacity>
        </View>
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
        <View style={styles.bottomRow}>
          <View style={styles.quantityControl}>
            <TouchableOpacity style={styles.quantityButton} onPress={onDecrement}>
              <Minus size={14} color="#1A2B3D" />
            </TouchableOpacity>
            <Text style={styles.quantity}>{quantity}</Text>
            <TouchableOpacity style={styles.quantityButton} onPress={onIncrement}>
              <Plus size={14} color="#1A2B3D" />
            </TouchableOpacity>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{price}</Text>
            {originalPrice && (
              <Text style={styles.originalPrice}>{originalPrice}</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
    flex: 1,
    marginRight: 8,
  },
  description: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    lineHeight: 16,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantity: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
    minWidth: 24,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  price: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#F5A623',
  },
  originalPrice: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    textDecorationLine: 'line-through',
  },
});
