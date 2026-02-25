import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

interface OrderRestaurantRowProps {
  name: string;
  itemCount: number;
  logo: ReturnType<typeof require>;
  onPress?: () => void;
}

export function OrderRestaurantRow({ name, itemCount, logo, onPress }: OrderRestaurantRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.logoContainer}>
        <Image source={logo} style={styles.logo} contentFit="cover" />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.itemCount}>{itemCount} items</Text>
      </View>
      <ChevronDown size={20} color="#8A8A8A" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  logoContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#EEEEEE',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  itemCount: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
  },
});
