import {
  StyleSheet,
  TextInput,
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';

interface PhoneInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  countryCode?: string;
  error?: string;
  placeholder?: string;
}

export function PhoneInput({
  label,
  value,
  onChangeText,
  countryCode = '+216',
  error,
  placeholder = '22 222 222',
}: PhoneInputProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.countrySelector}>
          <Image
            source={{ uri: 'https://flagcdn.com/w40/tn.png' }}
            style={styles.flag}
          />
          <Text style={styles.countryCode}>{countryCode}</Text>
          <ChevronDown size={16} color="#1A2B3D" />
        </TouchableOpacity>
        <View style={styles.phoneInputWrapper}>
          <TextInput
            style={[styles.phoneInput, error && styles.inputError]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#AAAAAA"
            keyboardType="phone-pad"
          />
        </View>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A2B3D',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  flag: {
    width: 24,
    height: 16,
    borderRadius: 2,
  },
  countryCode: {
    fontSize: 14,
    color: '#1A2B3D',
    fontWeight: '500',
  },
  phoneInputWrapper: {
    flex: 1,
  },
  phoneInput: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A2B3D',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  error: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
});
