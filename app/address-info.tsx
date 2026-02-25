import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Building2, Briefcase, Home, MapPin } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { AddressType, AddressLabel } from '@/types/location';

const ADDRESS_TYPE_CONFIG: Record<AddressType, { label: string; icon: React.ReactNode }> = {
  apartment: { label: 'Apartment', icon: <Building2 size={16} color="#1A2B3D" /> },
  office: { label: 'Office', icon: <Briefcase size={16} color="#1A2B3D" /> },
  house: { label: 'House', icon: <Home size={16} color="#1A2B3D" /> },
  other: { label: 'Other', icon: <MapPin size={16} color="#1A2B3D" /> },
};

const LABEL_OPTIONS: { value: AddressLabel; display: string }[] = [
  { value: 'home', display: 'Home' },
  { value: 'work', display: 'Work' },
  { value: 'custom', display: 'Custom' },
];

export default function AddressInfoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    addressType: AddressType;
    addressText: string;
    latitude: string;
    longitude: string;
  }>();

  const addressType = (params.addressType ?? 'apartment') as AddressType;
  const addressText = params.addressText ?? '';
  const latitude = parseFloat(params.latitude ?? '0');
  const longitude = parseFloat(params.longitude ?? '0');

  const [floorNumber, setFloorNumber] = useState('');
  const [doorNumber, setDoorNumber] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [selectedLabel, setSelectedLabel] = useState<AddressLabel>('home');
  const [customLabel, setCustomLabel] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const typeConfig = ADDRESS_TYPE_CONFIG[addressType];

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      console.log('Saving address:', {
        addressType,
        addressText,
        latitude,
        longitude,
        floorNumber,
        doorNumber,
        additionalInfo,
        label: selectedLabel,
        customLabel: selectedLabel === 'custom' ? customLabel : undefined,
      });
      router.replace('/(tabs)');
    } catch (err) {
      console.error('Failed to save address:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1A2B3D" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Address Information</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.addressRow}>
          <View style={styles.addressTypeBadge}>
            {typeConfig.icon}
            <Text style={styles.addressTypeBadgeText}>{typeConfig.label}</Text>
          </View>
          <Text style={styles.addressText} numberOfLines={1}>{addressText}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>Floor Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Floor Number"
              placeholderTextColor="#CCCCCC"
              value={floorNumber}
              onChangeText={setFloorNumber}
            />
          </View>
          <View style={styles.halfField}>
            <Text style={styles.fieldLabel}>Door Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Door Number"
              placeholderTextColor="#CCCCCC"
              value={doorNumber}
              onChangeText={setDoorNumber}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Addtional Information</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Information"
            placeholderTextColor="#CCCCCC"
            value={additionalInfo}
            onChangeText={setAdditionalInfo}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Label</Text>
          <Text style={styles.fieldSubLabel}>For simpler location identification</Text>
          <View style={styles.labelRow}>
            {LABEL_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.labelButton,
                  selectedLabel === option.value && styles.labelButtonActive,
                ]}
                onPress={() => setSelectedLabel(option.value)}
              >
                <Text
                  style={[
                    styles.labelButtonText,
                    selectedLabel === option.value && styles.labelButtonTextActive,
                  ]}
                >
                  {option.display}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {selectedLabel === 'custom' && (
            <TextInput
              style={[styles.input, styles.customLabelInput]}
              placeholder="Enter custom label"
              placeholderTextColor="#CCCCCC"
              value={customLabel}
              onChangeText={setCustomLabel}
            />
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.9}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving ? 'Saving...' : 'Save Address Info'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 24,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  addressTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addressTypeBadgeText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#1A2B3D',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
    gap: 8,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  fieldSubLabel: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
    marginTop: -4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: '#1A2B3D',
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  customLabelInput: {
    marginTop: 8,
  },
  labelRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  labelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DDDDDD',
    backgroundColor: '#FFFFFF',
  },
  labelButtonActive: {
    borderColor: '#1A2B3D',
    backgroundColor: '#1A2B3D',
  },
  labelButtonText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
  labelButtonTextActive: {
    color: '#FFFFFF',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#1A2B3D',
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
  },
});
