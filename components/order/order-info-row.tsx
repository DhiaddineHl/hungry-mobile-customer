import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';

interface OrderInfoRowProps {
  icon: React.ReactNode;
  label: string;
  rightContent?: React.ReactNode;
  rightLabel?: string;
  chevron?: boolean;
  onPress?: () => void;
}

export function OrderInfoRow({
  icon,
  label,
  rightContent,
  rightLabel,
  chevron = true,
  onPress,
}: OrderInfoRowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={styles.left}>
        {icon}
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.right}>
        {rightContent ?? (rightLabel ? <Text style={styles.rightLabel}>{rightLabel}</Text> : null)}
        {chevron && <ChevronRight size={18} color="#8A8A8A" />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rightLabel: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#8A8A8A',
  },
});
