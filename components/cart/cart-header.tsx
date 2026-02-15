import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CalendarCheck } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

interface CartHeaderProps {
  onOrdersPress?: () => void;
}

export function CartHeader({ onOrdersPress }: CartHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Carts</Text>
      <TouchableOpacity style={styles.ordersButton} onPress={onOrdersPress}>
        <CalendarCheck size={18} color="#1A2B3D" />
        <Text style={styles.ordersText}>Orders</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
  },
  ordersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF',
  },
  ordersText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
});
