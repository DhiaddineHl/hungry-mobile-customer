import { AuthButton, AuthInput } from '@/components/auth';
import { Fonts, FontSize, Palette, Spacing } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useUpdateCustomer } from '@/hooks/use-customer';
import { useCurrentCustomer } from '@/hooks/use-delivery-address';
import { AccountSettingsFormData, accountSettingsSchema } from '@/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AccountSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, reloadUser } = useAuth();
  const { data: customer } = useCurrentCustomer();
  const updateCustomer = useUpdateCustomer();

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // The customer record is the source of truth for the profile. The phone in
  // particular is only there: Keycloak's userinfo never returns it (no mapper,
  // and the realm's user profile does not declare the `phoneNumber` attribute
  // the backend mirrors). Token claims are only the fallback while it loads.
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<AccountSettingsFormData>({
    resolver: zodResolver(accountSettingsSchema),
    values: {
      firstName: customer?.fullname?.firstName ?? user?.given_name ?? '',
      lastName: customer?.fullname?.lastName ?? user?.family_name ?? '',
      email: customer?.contact?.email ?? user?.email ?? '',
      phoneNumber: customer?.contact?.phones?.[0] ?? user?.phoneNumber ?? '',
    },
    // A refetch landing mid-edit must not wipe what the user typed.
    resetOptions: { keepDirtyValues: true },
  });

  const onSubmit = async (data: AccountSettingsFormData) => {
    if (!user?.sub) {
      setFormError('You must be signed in to update your profile.');
      return;
    }
    setFormError(null);
    setIsSaving(true);
    try {
      // One backend call updates the Customer entity AND the Keycloak login
      // account atomically (the record is resolved by `code` = the account's
      // `sub`) — same sync flow as employees in the back-office.
      await updateCustomer.mutateAsync({
        code: user.sub,
        name: `${data.firstName} ${data.lastName}`.trim(),
        fullname: { firstName: data.firstName, lastName: data.lastName },
        contact: {
          email: data.email,
          phones: data.phoneNumber ? [data.phoneNumber] : [],
        },
      });
      // Refresh the token claims (name/email shown elsewhere). The phone is
      // read from the customer record, which the mutation already re-cached.
      await reloadUser();
      Alert.alert('Saved', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <ArrowLeft size={24} color={Palette.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>Update your personal information</Text>

        {formError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{formError}</Text>
          </View>
        )}

        <View style={styles.nameRow}>
          <View style={styles.nameField}>
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <AuthInput
                  label="First Name"
                  placeholder="First Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.firstName?.message}
                  autoCapitalize="words"
                />
              )}
            />
          </View>
          <View style={styles.nameField}>
            <Controller
              control={control}
              name="lastName"
              render={({ field: { onChange, onBlur, value } }) => (
                <AuthInput
                  label="Last Name"
                  placeholder="Last Name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.lastName?.message}
                  autoCapitalize="words"
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthInput
              label="Email"
              placeholder="Email"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          )}
        />

        <Controller
          control={control}
          name="phoneNumber"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthInput
              label="Phone Number"
              placeholder="+216 00 000 000"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.phoneNumber?.message}
              keyboardType="phone-pad"
            />
          )}
        />

        <AuthButton
          title="SAVE CHANGES"
          onPress={handleSubmit(onSubmit)}
          loading={isSaving}
          disabled={isSaving || !isDirty}
          style={styles.saveButton}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.xl,
    color: Palette.ink,
  },
  headerSpacer: {
    width: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    color: Palette.textSecondary,
    marginBottom: Spacing.xl,
  },
  errorBanner: {
    backgroundColor: Palette.dangerSoft,
    borderRadius: 12,
    padding: 14,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorBannerText: {
    color: Palette.danger,
    fontSize: FontSize.md,
    textAlign: 'center',
    fontFamily: Fonts.medium,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  nameField: {
    flex: 1,
  },
  saveButton: {
    marginTop: Spacing.lg,
  },
});
