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
import { AuthBackdrop, AuthButton, AuthHeading, AuthInput } from '@/components/auth';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useAuth } from '@/contexts/auth-context';
import { PasswordFormData, passwordSchema } from '@/schemas/auth';
import { Duration, FontSize, Fonts, Palette, Radius, Shadows, Spacing } from '@/constants/theme';

/**
 * Step two of signing in, for an address the identification screen found an
 * account for. It only asks for the password — the address is settled, shown
 * back for confirmation, and changed by going back rather than by editing it
 * here.
 *
 * No "don't have an account?" link: an address without an account never
 * reaches this screen.
 */
export default function PasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
    },
  });

  const onSubmit = async (data: PasswordFormData) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      // Nothing to route on success: the root navigator reacts to the session
      // appearing, and sends an account whose e-mail is still unproven to
      // /verification and one with nowhere to deliver to to /location.
      const result = await login(email, data.password);
      if (!result.success) {
        setAuthError(result.error ?? 'Login failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBackToIdentification = () =>
    router.canGoBack() ? router.back() : router.replace('/login');

  // Landing here without an address means the screen was opened directly (a
  // deep link, or a reload that lost the param); the identification step is
  // the only thing that can supply one.
  if (!email) {
    return (
      <View style={styles.emptyState}>
        <StatusBar style="dark" />
        <Text style={styles.emptyTitle}>Which account?</Text>
        <Text style={styles.emptyBody}>
          We do not know which email to sign in with. Start again and we will pick it back up.
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
      {/* No intro here — the backdrop rests where identification left it and
          the navigator's transition provides the motion. */}
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
              <AuthHeading title="Welcome back !" subtitle="Enter your password to continue" />

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
                    autoComplete="password"
                    textContentType="password"
                    autoFocus
                    returnKeyType="go"
                    onSubmitEditing={() => handleSubmit(onSubmit)()}
                    isPassword
                  />
                )}
              />
            </AnimatedEntrance>

            <AnimatedEntrance index={2}>
              <PressableScale
                style={styles.forgotPassword}
                onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
                scaleTo={0.94}
                accessibilityLabel="Forgot Password"
              >
                <Text style={styles.forgotPasswordText}>Forgot Password</Text>
              </PressableScale>

              <AuthButton
                title="LOG IN"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting}
                color={Palette.primaryDeep}
                shape="rounded"
                style={styles.submitButton}
              />
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
    // Matches the identification card: one field either side of the step, so
    // the card must not jump height between them.
    height: '72%',
    backgroundColor: Palette.surface,
    borderTopLeftRadius: Radius.xxl + Spacing.xl,
    borderTopRightRadius: Radius.xxl + Spacing.xl,
    ...Shadows.lg,
  },
  cardContent: {
    paddingHorizontal: Spacing.xxxxl,
    paddingTop: Spacing.xxxl,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.xxl,
  },
  forgotPasswordText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.md,
    color: Palette.navy,
  },
  submitButton: {
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
