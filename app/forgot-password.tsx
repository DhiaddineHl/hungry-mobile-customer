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
import { ForgotPasswordFormData, forgotPasswordSchema } from '@/schemas/auth';
import { sendPasswordResetCode } from '@/services/api/customer-service';
import { usePasswordResetStore } from '@/store/password-reset-store';
import { Duration, FontSize, Fonts, Palette, Radius, Shadows, Spacing } from '@/constants/theme';

/**
 * Step one of a forgotten-password reset: which address to send the code to.
 *
 * Reached from the password screen, which already knows the address, so the
 * field arrives filled in — but it stays editable: someone who mistyped their
 * way here, or who has two accounts, should not have to walk back to fix it.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const insets = useSafeAreaInsets();
  const startReset = usePasswordResetStore((state) => state.start);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: params.email ?? '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      const email = data.email.trim().toLowerCase();
      // Sent from here rather than on arrival at the code screen, so a 404 for
      // an address with no account is answered on the screen that asked for
      // it — and the next screen only ever opens with a code really in flight.
      await sendPasswordResetCode(email);
      startReset(email);
      router.push('/reset-code');
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'We could not send the code. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
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
                title="Forgot password?"
                subtitle="We'll email you a code to reset it"
              />
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
                    returnKeyType="send"
                    onSubmitEditing={() => handleSubmit(onSubmit)()}
                  />
                )}
              />
            </AnimatedEntrance>

            <AnimatedEntrance index={2}>
              <AuthButton
                title="SEND CODE"
                onPress={handleSubmit(onSubmit)}
                loading={isSubmitting}
                disabled={isSubmitting}
                color={Palette.primaryDeep}
                shape="rounded"
                style={styles.submitButton}
              />

              <PressableScale
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
                scaleTo={0.96}
                accessibilityLabel="Back to sign in"
              >
                <Text style={styles.backLink}>Remembered it? Go back</Text>
              </PressableScale>
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
    // Same share of the screen as the identification and password cards, so
    // the backdrop above it never shifts as the user moves between them.
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
  submitButton: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  backLink: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.textSecondary,
    textAlign: 'center',
  },
});
