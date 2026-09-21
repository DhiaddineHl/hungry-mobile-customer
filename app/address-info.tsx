import { useState } from 'react';
import {
  Alert,
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
import { ArrowLeft, Building2, Briefcase, Home, MapPin, Plus, X } from 'lucide-react-native';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useSaveAddresses } from '@/hooks/use-customer';
import { useCustomerStore } from '@/store/customer-store';
import { useAddressDraftStore } from '@/store/address-draft-store';
import { AddressType, AddressLabel, AddressData } from '@/types/location';

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

/** The name an address will be saved under — used to spot label collisions. */
const resolveName = (label: AddressLabel, customLabel?: string) =>
  label === 'custom' ? customLabel?.trim() || 'other' : label;

const displayName = (address: AddressData) => {
  const name = resolveName(address.label, address.customLabel);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export default function AddressInfoScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  // During post-sign-up onboarding there is no session yet, so fall back to
  // the account id persisted by the registration mutation.
  const pendingKeycloakUserId = useCustomerStore((s) => s.keycloakUserId);
  const keycloakUserId = user?.sub ?? pendingKeycloakUserId;
  const saveAddresses = useSaveAddresses();
  const drafts = useAddressDraftStore((s) => s.drafts);
  const defaultIndex = useAddressDraftStore((s) => s.defaultIndex);
  const addDraft = useAddressDraftStore((s) => s.addDraft);
  const removeDraft = useAddressDraftStore((s) => s.removeDraft);
  const setDefaultIndex = useAddressDraftStore((s) => s.setDefaultIndex);
  const clearDrafts = useAddressDraftStore((s) => s.clear);
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
  const isSaving = saveAddresses.isPending;

  const typeConfig = ADDRESS_TYPE_CONFIG[addressType];
  // The form being filled in sits conceptually after the committed drafts, so
  // it competes for "default" under the index `drafts.length`.
  const currentIndex = drafts.length;
  const isCurrentDefault = defaultIndex === currentIndex;

  const buildCurrentAddress = (): AddressData => ({
    coords: { latitude, longitude },
    addressText,
    addressType,
    label: selectedLabel,
    customLabel: selectedLabel === 'custom' ? customLabel : undefined,
    floorNumber: floorNumber || undefined,
    doorNumber: doorNumber || undefined,
    additionalInfo: additionalInfo || undefined,
  });

  const hasDuplicateLabel = () => {
    const currentName = resolveName(selectedLabel, customLabel);
    if (!drafts.some((d) => resolveName(d.label, d.customLabel) === currentName)) {
      return false;
    }
    Alert.alert(
      'Label already used',
      `You already added an address labeled "${currentName}". Pick a different label for this one.`
    );
    return true;
  };

  const handleAddAnother = () => {
    if (isSaving || hasDuplicateLabel()) return;
    addDraft(buildCurrentAddress());
    router.push('/map-select');
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!keycloakUserId) {
      Alert.alert('Not signed in', 'Please log in before saving an address.');
      router.replace('/login');
      return;
    }
    if (hasDuplicateLabel()) return;
    try {
      const addresses = [...drafts, buildCurrentAddress()];
      await saveAddresses.mutateAsync({
        keycloakUserId,
        addresses,
        defaultIndex: Math.min(defaultIndex, addresses.length - 1),
      });
      clearDrafts();
      // Saving seeds the customer cache with the new addresses, which is what
      // releases the root navigator's onboarding hold.
      // A user who saved an address without a session (registration whose
      // sign-in failed) still has to log in; an already-signed-in one goes
      // straight back to the app.
      router.replace(isAuthenticated ? '/(tabs)' : '/login');
    } catch (err) {
      Alert.alert(
        'Could not save address',
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
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
        {drafts.length > 0 && (
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Added Addresses</Text>
            {drafts.map((draft, index) => (
              <View key={`${resolveName(draft.label, draft.customLabel)}-${index}`} style={styles.draftCard}>
                <View style={styles.draftIcon}>
                  {ADDRESS_TYPE_CONFIG[draft.addressType].icon}
                </View>
                <View style={styles.draftInfo}>
                  <Text style={styles.draftName}>{displayName(draft)}</Text>
                  <Text style={styles.draftAddress} numberOfLines={1}>
                    {draft.addressText}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.radioRow}
                  onPress={() => setDefaultIndex(index)}
                  hitSlop={8}
                >
                  <View style={[styles.radioOuter, defaultIndex === index && styles.radioOuterActive]}>
                    {defaultIndex === index && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioText}>Default</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removeDraft(index)} hitSlop={8}>
                  <X size={18} color="#8A8A8A" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

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

        <TouchableOpacity
          style={styles.defaultRow}
          onPress={() => setDefaultIndex(currentIndex)}
          hitSlop={8}
        >
          <View style={[styles.radioOuter, isCurrentDefault && styles.radioOuterActive]}>
            {isCurrentDefault && <View style={styles.radioInner} />}
          </View>
          <Text style={styles.defaultRowText}>Set as default address</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.addAnotherButton}
          onPress={handleAddAnother}
          activeOpacity={0.8}
          disabled={isSaving}
        >
          <Plus size={18} color="#F5A623" />
          <Text style={styles.addAnotherButtonText}>Add Another Address</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.9}
          disabled={isSaving}
        >
          <Text style={styles.saveButtonText}>
            {isSaving
              ? 'Saving...'
              : drafts.length > 0
                ? `Save ${drafts.length + 1} Addresses`
                : 'Save Address Info'}
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
  draftCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  draftIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  draftInfo: {
    flex: 1,
    gap: 2,
  },
  draftName: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#1A2B3D',
  },
  draftAddress: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#8A8A8A',
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#F5A623',
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#F5A623',
  },
  radioText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  defaultRowText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1A2B3D',
  },
  addAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#F5A623',
    borderRadius: 28,
    paddingVertical: 14,
  },
  addAnotherButtonText: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    color: '#F5A623',
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
