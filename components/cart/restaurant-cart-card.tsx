import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ThumbsUp, Trash2, Plus } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

interface CartItem {
  id: string;
  name: string;
  quantity: number;
  image: any;
}

interface RestaurantCartCardProps {
  restaurantName: string;
  restaurantLogo: any;
  rating: string;
  reviewCount: string;
  items: CartItem[];
  totalItems: number;
  totalPrice: string;
  onViewCart?: () => void;
  onDelete?: () => void;
  onAddMore?: () => void;
}

export function RestaurantCartCard({
  restaurantName,
  restaurantLogo,
  rating,
  reviewCount,
  items,
  totalItems,
  totalPrice,
  onViewCart,
  onDelete,
  onAddMore,
}: RestaurantCartCardProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.restaurantInfo}>
          <Image source={restaurantLogo} style={styles.logo} contentFit="cover" />
          <View>
            <Text style={styles.restaurantName}>{restaurantName}</Text>
            <View style={styles.ratingRow}>
              <ThumbsUp size={12} color="#F5A623" />
              <Text style={styles.rating}>{rating}</Text>
              <Text style={styles.reviewCount}>({reviewCount})</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
          <Trash2 size={20} color="#1A2B3D" />
        </TouchableOpacity>
      </View>

      <View style={styles.itemsRow}>
        {items.slice(0, 2).map((item) => (
          <View key={item.id} style={styles.itemContainer}>
            <Image source={item.image} style={styles.itemImage} contentFit="cover" />
            {item.quantity > 1 && (
              <View style={styles.quantityBadge}>
                <Text style={styles.quantityText}>x{item.quantity}</Text>
              </View>
            )}
          </View>
        ))}
        <TouchableOpacity style={styles.addButton} onPress={onAddMore}>
          <Plus size={20} color="#1A2B3D" />
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.viewCartButton} onPress={onViewCart}>
        <Text style={styles.itemCount}>{totalItems}</Text>
        <Text style={styles.viewCartText}>View Cart</Text>
        <Text style={styles.totalPrice}>{totalPrice}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  restaurantName: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rating: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#F5A623',
  },
  reviewCount: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
  },
  deleteButton: {
    padding: 4,
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  itemContainer: {
    position: 'relative',
  },
  itemImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  quantityBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  quantityText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
  addButton: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
  viewCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1A2B3D',
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemCount: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
  viewCartText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
  totalPrice: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
});
