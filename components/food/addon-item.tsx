import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

interface AddonItemProps {
  id: string;
  name: string;
  price?: string;
  isPopular?: boolean;
  isSelected: boolean;
  isDisabled?: boolean;
  type: 'checkbox' | 'radio';
  onToggle: (id: string) => void;
}

export function AddonItem({
  id,
  name,
  price,
  isPopular,
  isSelected,
  isDisabled,
  type,
  onToggle,
}: AddonItemProps) {
  return (
    <TouchableOpacity
      style={[styles.row, isDisabled && styles.rowDisabled]}
      onPress={() => !isDisabled && onToggle(id)}
      activeOpacity={isDisabled ? 1 : 0.7}
    >
      <View style={styles.left}>
        <Text style={[styles.name, isDisabled && styles.textDisabled]}>{name}</Text>
        <View style={styles.meta}>
          {price && (
            <Text style={[styles.price, isDisabled && styles.textDisabled]}>{price}</Text>
          )}
          {isPopular && <Text style={styles.popular}>Popular</Text>}
        </View>
      </View>

      {type === 'checkbox' ? (
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected, isDisabled && styles.checkboxDisabled]}>
          {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
      ) : (
        <View style={[styles.radio, isSelected && styles.radioSelected]}>
          {isSelected && <View style={styles.radioDot} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowDisabled: {
    opacity: 0.4,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
  textDisabled: {
    color: '#AAAAAA',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#666666',
  },
  popular: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#F5A623',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: '#F5A623',
    borderColor: '#F5A623',
  },
  checkboxDisabled: {
    borderColor: '#DDDDDD',
    backgroundColor: '#F5F5F5',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioSelected: {
    borderColor: '#F5A623',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F5A623',
  },
});
