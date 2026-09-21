import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import {
  AuthBackdrop,
  AuthButton,
  AuthHeading,
  AuthInput,
  PhoneInput,
  TermsFooter,
} from '@/components/auth';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { useAuth } from '@/contexts/auth-context';
import { useCompleteSocialProfile } from '@/hooks/use-customer';
import { useAddressDraftStore } from '@/store/address-draft-store';
import { CompleteProfileFormData, completeProfileSchema } from '@/schemas/auth';
import { Duration, FontSize, Fonts, Palette, Radius, Shadows, Spacing } from '@/constants/theme';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        phoneNumber: `${COUNTRY_CODE}${data.phoneNumber}`,
      });

      // Straight to the map: the address is the only thing still missing, and
      // /location exists to ask for a permission this flow can ask for on the
      // map screen itself. `replace` so back does not return to a form whose
      // record has already been created.
      router.replace('/map-select');
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
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
    <View style={styles.screen}>
      <StatusBar style="light" />
      <AuthBackdrop />

      <View style={styles.card}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.cardContent,
              { paddingBottom: insets.bottom + Spacing.xxl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <AnimatedEntrance>
              <AuthHeading
                title="Almost there"
                subtitle="Check your details and add a phone number"
              />

              {user?.email ? (
                <View style={styles.identityRow}>
                  <Text style={styles.identityEmail} numberOfLines={1}>
                    {user.email}
                  </Text>
                </View>
              ) : null}
            </AnimatedEntrance>

            {authError ? (
              <Animated.View
                entering={FadeInDown.duration(Duration.base).reduceMotion(ReduceMotion.System)}
                style={styles.errorBanner}
              >
                <Text style={styles.errorBannerText}>{authError}</Text>
              </Animated.View>
            ) : null}

            <AnimatedEntrance index={1}>
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
                        autoComplete="name-given"
                        textContentType="givenName"
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
                        autoComplete="name-family"
                        textContentType="familyName"
                      />
                    )}
                  />
                </View>
              </View>
            </AnimatedEntrance>

            <AnimatedEntrance index={2}>
              <Controller
                control={control}
                name="phoneNumber"
                render={({ field: { onChange, value } }) => (
                  <PhoneInput
                    label="Phone Number"
                    value={value}
                    onChangeText={onChange}
                    countryCode={COUNTRY_CODE}
                    error={errors.phoneNumber?.message}
                  />
                )}
              />

              <AuthButton
                title="CONTINUE"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting}
                color={Palette.primaryDeep}
                shape="rounded"
                style={styles.submitButton}
              />

              <Text
                style={styles.cancel}
                onPress={isSubmitting ? undefined : handleCancel}
                accessibilityRole="button"
              >
                Use a different account
              </Text>
            </AnimatedEntrance>

            <AnimatedEntrance index={3}>
              <TermsFooter />
            </AnimatedEntrance>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.navy,
  },
  flex: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Between login (72%) and signup (76%): three fields, so it needs less
    // room than sign-up's six but more than the single email field.
    height: '74%',
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xxl + Spacing.xl,
    borderTopRightRadius: Radius.xxl + Spacing.xl,
    ...Shadows.lg,
  },
  cardContent: {
    paddingHorizontal: Spacing.xxxxl,
    paddingTop: Spacing.xxxl,
  },
  errorBanner: {
    backgroundColor: Palette.dangerSoft,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Palette.danger,
  },
  errorBannerText: {
    fontFamily: Fonts.medium,
    color: Palette.danger,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  identityEmail: {
    flexShrink: 1,
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.ink,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  nameField: {
    flex: 1,
  },
  submitButton: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  cancel: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.sm,
    color: Palette.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
});
