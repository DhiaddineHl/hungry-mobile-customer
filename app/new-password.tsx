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
import { AuthBackdrop, AuthButton, AuthHeading, AuthInput } from '@/components/auth';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { NewPasswordFormData, newPasswordSchema } from '@/schemas/auth';
import { confirmPasswordReset } from '@/services/api/customer-service';
import { usePasswordResetStore } from '@/store/password-reset-store';
import { Duration, FontSize, Fonts, Palette, Radius, Shadows, Spacing } from '@/constants/theme';

/**
 * The last step of a forgotten-password reset: the new password, typed twice.
 *
 * What authorizes the change is the ticket the accepted code bought, held in
 * memory only. Once the backend has taken it the flow ends here: the user goes
 * back to the front door and signs in with the password they just chose. No
 * session is created on their behalf — a reset proves the mailbox, and logging
 * in is left as its own deliberate act.
 */
export default function NewPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const email = usePasswordResetStore((state) => state.email);
  const ticket = usePasswordResetStore((state) => state.ticket);
  const clearReset = usePasswordResetStore((state) => state.clear);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: NewPasswordFormData) => {
    if (!email || !ticket) return;
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await confirmPasswordReset(email, ticket, data.password);

      // Nothing of the reset outlives this line: the ticket is spent and the
      // address goes with it.
      clearReset();
      // replace, not push: the three reset screens are behind us and none of
      // them can be returned to — the ticket that made them work is gone.
      router.replace('/login');
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : 'We could not change your password. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // No ticket means nothing here is authorized: the store was cleared (an app
  // restart mid-flow), or this screen was opened directly.
  if (!email || !ticket) {
    return (
      <View style={styles.emptyState}>
        <StatusBar style="dark" />
        <Text style={styles.emptyTitle}>Start again</Text>
        <Text style={styles.emptyBody}>
          This reset is no longer valid. Ask for a new code and you can choose a new password.
        </Text>
        <AuthButton
          title="START AGAIN"
          onPress={() => router.replace('/forgot-password')}
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
              <AuthHeading title="New password" subtitle="Choose the password you'll use from now on" />

              <Text style={styles.identityEmail} numberOfLines={1}>
                {email}
              </Text>
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
                    label="New Password"
                    placeholder="Password"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.password?.message}
                    autoComplete="password-new"
                    textContentType="newPassword"
                    autoFocus
                    isPassword
                  />
                )}
              />
            </AnimatedEntrance>

            <AnimatedEntrance index={2}>
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
                    returnKeyType="go"
                    onSubmitEditing={() => handleSubmit(onSubmit)()}
                    isPassword
                  />
                )}
              />

              <AuthButton
                title="SAVE PASSWORD"
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
    // Two fields, like the sign-up card's tail — a little taller than the
    // single-field cards so both fit above the keyboard.
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
  identityEmail: {
    fontFamily: Fonts.medium,
    fontSize: FontSize.md,
    color: Palette.ink,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
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
