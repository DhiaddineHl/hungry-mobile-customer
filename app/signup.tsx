import { useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { PressableScale } from '@/components/ui/pressable-scale';
import { useRegisterCustomer } from '@/hooks/use-customer';
import { hasDeliveryAddress } from '@/services/api/customer-service';
import { usePendingVerificationStore } from '@/store/pending-verification-store';
import { SignupFormData, signupSchema } from '@/schemas/auth';
import { Duration, FontSize, Fonts, Palette, Radius, Shadows, Spacing } from '@/constants/theme';

/**
 * Account creation, reached only from the identification screen and only for
 * an address it found no account for. That address arrives as a route param
 * and is not asked for again — nor is there a link back to a separate login
 * screen, because there is no longer one to go to.
 */
export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const insets = useSafeAreaInsets();
  const registerCustomer = useRegisterCustomer();
  const startVerification = usePendingVerificationStore((state) => state.start);
  const [countryCode] = useState('+216');
  const [authError, setAuthError] = useState<string | null>(null);
  const isSubmitting = registerCustomer.isPending;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setAuthError(null);
    try {
      // One backend call creates the Keycloak login account and the Customer
      // entity in sync (same flow as employees in the back-office app), and
      // mails the one-time code the next screen asks for.
      const customer = await registerCustomer.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        password: data.password,
        phoneNumber: `${countryCode}${data.phoneNumber}`,
      });

      // No sign-in here any more: the account exists but its e-mail is
      // unproven, and a realm that gates login on verification would refuse
      // the password grant anyway. The verification screen signs in once the
      // code is accepted — which is why it needs the password, handed over in
      // memory rather than through route params.
      //
      // An account with nowhere to deliver to still has to pick an address
      // before it reaches the app; that decision is carried through so the
      // verification screen knows where to send the user next. The root
      // navigator enforces the same rule from the customer record, for every
      // way in — deciding here too just skips the extra hop through the tabs.
      startVerification({
        email,
        password: data.password,
        firstName: data.firstName,
        needsAddress: !hasDeliveryAddress(customer),
      });

      router.push('/verification');
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
      );
    }
  };

  // back(), not push('/login'), so the stack doesn't grow when the user
  // ping-pongs between identification and this screen.
  const goBackToIdentification = () =>
    router.canGoBack() ? router.back() : router.replace('/login');

  // Reached without an address (a deep link, or a reload that lost the param):
  // only the identification step can supply one.
  if (!email) {
    return (
      <View style={styles.emptyState}>
        <StatusBar style="dark" />
        <Text style={styles.emptyTitle}>Which email?</Text>
        <Text style={styles.emptyBody}>
          We do not know which address to create the account for. Start again and we will pick it
          back up.
        </Text>
        <AuthButton
          title="CONTINUE"
          onPress={() => router.replace('/login')}
          color={Palette.primaryDeep}
          shape="rounded"
          style={styles.emptyButton}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* No intro here — the backdrop rests where identification left it and the
          navigator's transition provides the motion. */}
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
              <AuthHeading title="Sign Up to Hungry" subtitle="Just a few details and you're in" />

              <View style={styles.identityRow}>
                <Text style={styles.identityEmail} numberOfLines={1}>
                  {email}
                </Text>
                <PressableScale
                  onPress={goBackToIdentification}
                  scaleTo={0.94}
                  accessibilityLabel="Change email"
                >
                  <Text style={styles.identityChange}>CHANGE</Text>
                </PressableScale>
              </View>
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
                    countryCode={countryCode}
                    error={errors.phoneNumber?.message}
                  />
                )}
              />
            </AnimatedEntrance>

            <AnimatedEntrance index={3}>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AuthInput
                    label="Password"
                    placeholder="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    isPassword
                  />
                )}
              />
            </AnimatedEntrance>

            <AnimatedEntrance index={4}>
              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <AuthInput
                    label="Verify Password"
                    placeholder="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.confirmPassword?.message}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    isPassword
                  />
                )}
              />

              <AuthButton
                title="SIGN UP"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting}
                color={Palette.primaryDeep}
                shape="rounded"
                style={styles.submitButton}
              />
            </AnimatedEntrance>

            <AnimatedEntrance index={5}>
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
    // Taller than login (six fields, so the form scrolls inside the card) but
    // still short enough to keep the logo in the artwork visible above it.
    height: '76%',
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
  identityChange: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    color: Palette.primaryDeep,
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
    marginBottom: Spacing.xl,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxxl,
    backgroundColor: Palette.surface,
  },
  emptyTitle: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.display,
    color: Palette.ink,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  emptyBody: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    color: Palette.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: Spacing.xxl,
  },
});
