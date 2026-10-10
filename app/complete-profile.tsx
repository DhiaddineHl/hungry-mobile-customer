import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthHeading, AuthPrompt, AuthShell, EmailChip, PhoneField, TermsFooter } from '@/components/auth';
import { ErrorBanner, PrimaryButton, TextField } from '@/components/ds';
import { useAuth } from '@/contexts/auth-context';
import { useCompleteSocialProfile } from '@/hooks/use-customer';
import { useAddressDraftStore } from '@/store/address-draft-store';
import { CompleteProfileFormData, completeProfileSchema } from '@/schemas/auth';
import { createStyles } from '@/theme';

const COUNTRY_CODE = '+216';

/**
 * Splits whatever name Keycloak has into two fields.
 *
 * Google normally maps `given_name` and `family_name` through the broker, but
 * a profile with a single-word display name (or an IdP mapper that was never
 * configured) leaves only `name`. Falling back to a split on the last space
 * pre-fills the common case correctly; anything it gets wrong is one tap away
 * from being corrected, which is the point of showing the form at all.
 */
function splitName(user: {
  given_name?: string;
  family_name?: string;
  name?: string;
}): { firstName: string; lastName: string } {
  if (user.given_name || user.family_name) {
    return { firstName: user.given_name ?? '', lastName: user.family_name ?? '' };
  }
  const parts = (user.name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/**
 * Strips the country code off a stored phone number so the field shows only
 * the national part, which is all the country pill leaves room for.
 */
function toNationalNumber(phone?: string): string {
  if (!phone) return '';
  return phone.startsWith(COUNTRY_CODE) ? phone.slice(COUNTRY_CODE.length).trim() : phone;
}

/**
 * The one screen a Google sign-in stops at, and only on its first one.
 *
 * Keycloak provisions the account while brokering to Google, so it never went
 * through sign-up and the backend has no customer record for it. This collects
 * the two things that record needs and Google does not reliably give us — a
 * first/last name and a phone number — and creates it.
 *
 * There is no password field (the account has no password; it signs in through
 * Google) and no verification step after it (Google proved the address). The
 * router sends the user here purely on "authenticated, but no customer
 * record", so it is never shown twice.
 */
export default function CompleteProfileScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { user, logout } = useAuth();
  const completeProfile = useCompleteSocialProfile();
  const clearDrafts = useAddressDraftStore((s) => s.clear);
  const [authError, setAuthError] = useState<string | null>(null);
  const isSubmitting = completeProfile.isPending;

  // This screen replaces /location as the entry point of the address
  // onboarding for social sign-ins, so it inherits that screen's job of
  // dropping drafts left behind by an abandoned earlier run.
  useEffect(() => {
    clearDrafts();
  }, [clearDrafts]);

  const prefill = splitName(user ?? {});

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<CompleteProfileFormData>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      firstName: prefill.firstName,
      lastName: prefill.lastName,
      phoneNumber: toNationalNumber(user?.phoneNumber),
    },
  });

  const onSubmit = async (data: CompleteProfileFormData) => {
    setAuthError(null);
    try {
      await completeProfile.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email: user?.email,
        phoneNumber: `${COUNTRY_CODE}${data.phoneNumber.replace(/\s/g, '')}`,
      });

      // Straight to the map: the address is the only thing still missing, and
      // /location exists to ask for a permission this flow can ask for on the
      // map screen itself. `replace` so back does not return to a form whose
      // record has already been created.
      router.replace('/map-select');
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Your details weren't saved. Check your connection and try again."
      );
    }
  };

  // The only way out that does not leave a half-finished account behind: the
  // session is real but has no customer record, so there is nothing to go
  // "back" to and the router would send the user straight here again.
  const handleCancel = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <AuthShell
      compact
      footer={
        <PrimaryButton
          label={authError ? 'Try again' : 'Continue'}
          loadingLabel="Saving…"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          style={styles.flex}
        />
      }
    >
      <AuthHeading title="Almost there" subtitle="Check your details and add a phone number." align="left" />

      {user?.email ? (
        <EmailChip email={user.email} />
      ) : null}

      {authError ? <ErrorBanner title="Couldn't save your details" body={`${authError} Try again.`} /> : null}

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
              locked={isSubmitting}
              autoCapitalize="words"
              autoComplete="name-given"
              textContentType="givenName"
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
              locked={isSubmitting}
              autoCapitalize="words"
              autoComplete="name-family"
              textContentType="familyName"
              containerStyle={styles.flex}
            />
          )}
        />
      </View>

      <Controller
        control={control}
        name="phoneNumber"
        render={({ field: { onChange, onBlur, value } }) => (
          <PhoneField
            countryCode={COUNTRY_CODE}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.phoneNumber?.message}
            helper="Riders use this number to reach you about an order."
            locked={isSubmitting}
          />
        )}
      />

      <AuthPrompt prompt="Not you?" action="Use a different account" onPress={handleCancel} disabled={isSubmitting} />

      <TermsFooter />
    </AuthShell>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: t.space[10], alignItems: 'flex-start' },
}));
