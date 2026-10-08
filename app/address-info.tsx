import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BottomBar,
  Card,
  Checkbox,
  ErrorBanner,
  FilterChip,
  IconButton,
  IconWell,
  PrimaryButton,
  Radio,
  Screen,
  SecondaryButton,
  Separated,
  Text,
  TextField,
  TextLink,
  TopBar,
  Touchable,
  toast,
  useBottomBarInset,
} from '@/components/ds';
import { useAuth } from '@/contexts/auth-context';
import { useSaveAddresses } from '@/hooks/use-customer';
import { useCustomerStore } from '@/store/customer-store';
import { useAddressDraftStore } from '@/store/address-draft-store';
import { AddressType, AddressLabel, AddressData } from '@/types/location';
import { createStyles, Icon, type IconName } from '@/theme';

const ADDRESS_TYPE_CONFIG: Record<AddressType, { label: string; icon: IconName }> = {
  apartment: { label: 'Apartment', icon: 'apartment' },
  office: { label: 'Office', icon: 'office' },
  house: { label: 'House', icon: 'house' },
  other: { label: 'Other', icon: 'pin' },
};

const LABEL_OPTIONS: { value: AddressLabel; display: string }[] = [
  { value: 'home', display: 'Home' },
  { value: 'work', display: 'Work' },
  { value: 'custom', display: 'Custom' },
];

/** The name an address will be saved under — used to spot label collisions. */
const resolveName = (label: AddressLabel, customLabel?: string) =>
  label === 'custom' ? customLabel?.trim() || 'other' : label;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const displayName = (address: AddressData) => capitalize(resolveName(address.label, address.customLabel));

/** "Yasser Arafat Avenue, Sahloul, Sousse" → "Sahloul" (the area after the street). */
const areaOf = (text: string) => text.split(',').map((p) => p.trim()).filter(Boolean)[1] ?? '';

/**
 * L4 Address details — floor, door, notes, a label and the default flag for
 * the point picked on the map. Several addresses can be queued ("Add another
 * address") and saved together.
 */
export default function AddressInfoScreen() {
  const styles = useStyles();
  const router = useRouter();
  const bottomInset = useBottomBarInset();
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
  const [labelError, setLabelError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  /** Errors are local: a clash is flagged on the label, with what to do. */
  const hasDuplicateLabel = () => {
    const currentName = resolveName(selectedLabel, customLabel);
    if (!drafts.some((d) => resolveName(d.label, d.customLabel) === currentName)) return false;
    setLabelError(`You already added an address called "${capitalize(currentName)}". Pick another label.`);
    return true;
  };

  const chooseLabel = (label: AddressLabel) => {
    setSelectedLabel(label);
    setLabelError(null);
  };

  const handleAddAnother = () => {
    if (isSaving || hasDuplicateLabel()) return;
    addDraft(buildCurrentAddress());
    router.push('/map-select');
  };

  const handleSave = async () => {
    if (isSaving) return;
    setSaveError(null);
    if (!keycloakUserId) {
      router.replace('/login');
      return;
    }
    if (hasDuplicateLabel()) return;
    try {
      const addresses = [...drafts, buildCurrentAddress()];
      const nextDefault = Math.min(defaultIndex, addresses.length - 1);
      await saveAddresses.mutateAsync({ keycloakUserId, addresses, defaultIndex: nextDefault });
      clearDrafts();
      // S-L3: back to Home with a toast naming where orders now go.
      const chosen = addresses[nextDefault];
      const area = areaOf(chosen.addressText);
      toast.show({
        message: `Address saved. Delivering to ${displayName(chosen)}${area ? ` · ${area}` : ''}`,
        aboveBar: isAuthenticated,
      });
      // Saving seeds the customer cache with the new addresses, which is what
      // releases the root navigator's onboarding hold. A user who saved an
      // address without a session still has to log in.
      router.replace(isAuthenticated ? '/(tabs)' : '/login');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  const saveLabel = drafts.length > 0 ? `Save ${drafts.length + 1} addresses` : 'Save address';

  return (
    <Screen>
      <TopBar title="Address details" onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {drafts.length > 0 ? (
            <View style={styles.group}>
              <Text variant="overline" color="inkMuted">
                Added addresses
              </Text>
              <Card>
                <Separated inset={66}>
                  {drafts.map((draft, index) => (
                    <View key={`${resolveName(draft.label, draft.customLabel)}-${index}`} style={styles.draftRow}>
                      <IconWell icon={ADDRESS_TYPE_CONFIG[draft.addressType].icon} />
                      <View style={styles.flex}>
                        <Text variant="itemLabel">{displayName(draft)}</Text>
                        <Text variant="meta" color="inkMuted" numberOfLines={1}>
                          {draft.addressText}
                        </Text>
                      </View>
                      <Touchable
                        onPress={() => setDefaultIndex(index)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: defaultIndex === index }}
                        accessibilityLabel={`Make ${displayName(draft)} the default`}
                        hitSlop={8}
                      >
                        <Radio selected={defaultIndex === index} />
                      </Touchable>
                      <IconButton
                        icon="close"
                        variant="plain"
                        iconColor="inkMuted"
                        accessibilityLabel={`Remove ${displayName(draft)}`}
                        onPress={() => removeDraft(index)}
                      />
                    </View>
                  ))}
                </Separated>
              </Card>
            </View>
          ) : null}

          <Card padded style={styles.addressCard}>
            <View style={styles.thumb}>
              <Icon name="pin" />
            </View>
            <View style={styles.flex}>
              <View style={styles.typeLine}>
                <Icon name={typeConfig.icon} size="inline" color="inkMuted" />
                <Text variant="caption" color="inkMuted">
                  {typeConfig.label}
                </Text>
              </View>
              <Text variant="rowTitle" numberOfLines={2}>
                {addressText}
              </Text>
              <Text variant="coords" color="inkMuted">
                {`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`}
              </Text>
            </View>
            <TextLink label="Edit" onPress={() => router.back()} accessibilityLabel="Edit the address on the map" />
          </Card>

          <View style={styles.row}>
            <TextField
              label="Floor"
              placeholder="Floor"
              value={floorNumber}
              onChangeText={setFloorNumber}
              locked={isSaving}
              containerStyle={styles.flex}
            />
            <TextField
              label="Door number"
              placeholder="Door number"
              value={doorNumber}
              onChangeText={setDoorNumber}
              locked={isSaving}
              containerStyle={styles.flex}
            />
          </View>

          <TextField
            label="Additional information"
            placeholder="Building name, landmark, entry code"
            value={additionalInfo}
            onChangeText={setAdditionalInfo}
            locked={isSaving}
            area
          />

          <View style={styles.group}>
            <View>
              <Text variant="label">Label</Text>
              <Text variant="caption" color="inkMuted">
                Helps you find this address later.
              </Text>
            </View>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {LABEL_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value}
                  label={option.display}
                  selected={selectedLabel === option.value}
                  showClear={false}
                  onPress={() => chooseLabel(option.value)}
                  disabled={isSaving}
                />
              ))}
            </View>
            {selectedLabel === 'custom' ? (
              <TextField
                placeholder="Name this address"
                value={customLabel}
                onChangeText={(text) => {
                  setCustomLabel(text);
                  setLabelError(null);
                }}
                error={labelError}
                locked={isSaving}
                accessibilityLabel="Custom label"
              />
            ) : labelError ? (
              <ErrorBanner title={labelError} />
            ) : null}
          </View>

          <Touchable
            onPress={() => setDefaultIndex(currentIndex)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isCurrentDefault }}
            accessibilityLabel="Set as default address"
            scaleTo={1}
            style={styles.defaultRow}
          >
            <Checkbox checked={isCurrentDefault} />
            <Text variant="itemLabel">Set as default address</Text>
          </Touchable>

          <SecondaryButton label="Add another address" icon="add" onPress={handleAddAnother} disabled={isSaving} />

          {saveError ? <ErrorBanner title="Couldn't save the address" body={`${saveError} Try again.`} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomBar>
        <PrimaryButton
          label={saveError ? 'Try again' : saveLabel}
          loadingLabel="Saving…"
          onPress={handleSave}
          loading={isSaving}
          style={styles.flex}
        />
      </BottomBar>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: t.screenPadding, paddingTop: t.space[16], gap: t.space[20] },
  group: { gap: t.space[10] },
  draftRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[12], paddingVertical: t.space[8], paddingLeft: t.space[16], paddingRight: t.space[4] },
  addressCard: { flexDirection: 'row', alignItems: 'center', gap: t.space[12], padding: t.space[12] },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: t.radius.control,
    backgroundColor: t.colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeLine: { flexDirection: 'row', alignItems: 'center', gap: t.space[4] },
  row: { flexDirection: 'row', gap: t.space[10], alignItems: 'flex-start' },
  chips: { flexDirection: 'row', gap: t.space[8], flexWrap: 'wrap' },
  defaultRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[12], minHeight: t.size.minTouch },
}));
