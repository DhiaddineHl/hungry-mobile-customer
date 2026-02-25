import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Building2, Briefcase, Home, MapPin } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { AddressType } from '@/types/location';

interface AddressTypeOption {
  type: AddressType;
  label: string;
  icon: React.ReactNode;
}

const options: AddressTypeOption[] = [
  { type: 'apartment', label: 'Apartment', icon: <Building2 size={22} color="#1A2B3D" /> },
  { type: 'office', label: 'Office', icon: <Briefcase size={22} color="#1A2B3D" /> },
  { type: 'house', label: 'House', icon: <Home size={22} color="#1A2B3D" /> },
  { type: 'other', label: 'Other', icon: <MapPin size={22} color="#1A2B3D" /> },
];

interface AddressTypeSelectorProps {
  onSelect: (type: AddressType) => void;
}

export function AddressTypeSelector({ onSelect }: AddressTypeSelectorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Indicate the nature of the address</Text>
      <View style={styles.grid}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.type}
            style={styles.card}
            onPress={() => onSelect(option.type)}
            activeOpacity={0.7}
          >
            {option.icon}
            <Text style={styles.cardLabel}>{option.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#1A2B3D',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardLabel: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
});
