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
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import {
  AuthBackdrop,
  AuthButton,
  AuthHeading,
  AuthInput,
  AuthSwitchLink,
  GoogleButton,
  OrDivider,
  PhoneInput,
  TermsFooter,
} from '@/components/auth';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { useAuth } from '@/contexts/auth-context';
import { useRegisterCustomer } from '@/hooks/use-customer';
import { SignupFormData, signupSchema } from '@/schemas/auth';
import { Duration, FontSize, Fonts, Palette, Radius, Shadows, Spacing } from '@/constants/theme';

export default function SignupScreen() {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const insets = useSafeAreaInsets();
  const registerCustomer = useRegisterCustomer();
  const [countryCode] = useState('+216');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const isSubmitting = registerCustomer.isPending;

  const wasCancelled = (error?: string) => !!error && error.toLowerCase().includes('cancel');

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
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    setAuthError(null);
    try {
      // One backend call creates the Keycloak login account and the Customer
      // entity in sync (same flow as employees in the back-office app).
      await registerCustomer.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        phoneNumber: `${countryCode}${data.phoneNumber}`,
      });
      // Account created — walk the new user through location onboarding.
      router.replace('/location');
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
      );
    }
  };

  const handleGoogleSignup = async () => {
    setAuthError(null);
    setIsGoogleLoading(true);
    try {
      const result = await loginWithGoogle();
      if (!result.success && !wasCancelled(result.error)) {
        setAuthError(result.error ?? 'Google signup failed');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      {/* No intro here — the backdrop rests where login left it and the
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
              <AuthHeading title="Sign Up to Hungry" subtitle="Hungry? We got you !" />
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
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                )}
              />
            </AnimatedEntrance>

            <AnimatedEntrance index={4}>
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

            <AnimatedEntrance index={5}>
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
                disabled={isSubmitting || isGoogleLoading}
                color={Palette.primaryDeep}
                shape="rounded"
                style={styles.submitButton}
              />
            </AnimatedEntrance>

            <AnimatedEntrance index={6}>
              {/* back(), not push('/login'), so the stack doesn't grow when the
                  user ping-pongs between the two screens. */}
              <AuthSwitchLink
                prompt="Already have an account ?"
                action="LOGIN"
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
              />

              <OrDivider />

              <GoogleButton
                onPress={handleGoogleSignup}
                loading={isGoogleLoading}
                disabled={isSubmitting}
              />

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
});
