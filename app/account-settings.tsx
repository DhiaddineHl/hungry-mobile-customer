import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BottomBar,
  ErrorBanner,
  PrimaryButton,
  Screen,
  Text,
  TextField,
  TopBar,
  toast,
  useBottomBarInset,
} from '@/components/ds';
import { useAuth } from '@/contexts/auth-context';
import { useUpdateCustomer } from '@/hooks/use-customer';
import { useCurrentCustomer } from '@/hooks/use-delivery-address';
import { useTranslation } from '@/i18n';
import { AccountSettingsFormData, accountSettingsSchema } from '@/schemas/auth';
import { createStyles } from '@/theme';

/**
 * P3 Account settings — names side by side, email, phone with what it is used
 * for. Save stays disabled until something changes, and again after a save
 * (S-P2 toast). A bad phone number is a field error that says the format
 * (S-P1).
 */
export default function AccountSettingsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation();
  const bottomInset = useBottomBarInset();
  const { user, reloadUser } = useAuth();
  const { data: customer } = useCurrentCustomer();
  const updateCustomer = useUpdateCustomer();

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // The customer record is the source of truth for the profile. The phone in
  // particular is only there: Keycloak's userinfo never returns it. Token
  // claims are only the fallback while it loads.
  const {
    control,
    handleSubmit,
    reset,
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
      setFormError('You need to be logged in to update your profile.');
      return;
    }
    setFormError(null);
    setIsSaving(true);
    try {
      // One backend call updates the Customer entity AND the Keycloak login
      // account atomically (resolved by `code` = the account's `sub`).
      await updateCustomer.mutateAsync({
        code: user.sub,
        name: `${data.firstName} ${data.lastName}`.trim(),
        fullname: { firstName: data.firstName, lastName: data.lastName },
        contact: { email: data.email, phones: data.phoneNumber ? [data.phoneNumber] : [] },
      });
      // Refresh the token claims (name/email shown elsewhere).
      await reloadUser();
      // The saved values become the new baseline, so Save disables again.
      reset(data);
      toast.show({ message: 'Changes saved' });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Your changes weren't saved. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <TopBar title={t('profile.accountManagement')} onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="bodySmall" color="inkMuted">
            Update your personal information.
          </Text>

          {formError ? <ErrorBanner title="Couldn't save your changes" body={`${formError} Try again.`} /> : null}

          <View style={styles.row}>
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="First name"
                  placeholder="First name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.firstName?.message}
                  locked={isSaving}
                  autoCapitalize="words"
                  autoComplete="name-given"
                  containerStyle={styles.flex}
                />
              )}
            />
            <Controller
              control={control}
              name="lastName"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextField
                  label="Last name"
                  placeholder="Last name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.lastName?.message}
                  locked={isSaving}
                  autoCapitalize="words"
                  autoComplete="name-family"
                  containerStyle={styles.flex}
                />
              )}
            />
          </View>

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Email"
                placeholder="Email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                locked={isSaving}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            )}
          />

          <Controller
            control={control}
            name="phoneNumber"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Phone number"
                placeholder="+216 22 222 222"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.phoneNumber?.message}
                helper="Riders use this number to reach you about an order."
                locked={isSaving}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            )}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomBar>
        <PrimaryButton
          label={formError ? 'Try again' : 'Save changes'}
          loadingLabel="Saving…"
          onPress={handleSubmit(onSubmit)}
          loading={isSaving}
          disabled={!isDirty}
          style={styles.flex}
        />
      </BottomBar>
    </Screen>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  content: { paddingHorizontal: t.screenPadding, paddingTop: t.space[8], gap: t.space[20] },
  row: { flexDirection: 'row', gap: t.space[12], alignItems: 'flex-start' },
}));
