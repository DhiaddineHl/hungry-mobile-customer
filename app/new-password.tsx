import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthHeading, AuthShell, EmailChip } from '@/components/auth';
import {
  ErrorBanner,
  IconWell,
  PasswordToggle,
  PrimaryButton,
  Screen,
  StateView,
  Text,
  TextField,
} from '@/components/ds';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { NewPasswordFormData, newPasswordSchema } from '@/schemas/auth';
import { confirmPasswordReset } from '@/services/api/customer-service';
import { usePasswordResetStore } from '@/store/password-reset-store';
import { createStyles } from '@/theme';

/**
 * The last step of a forgotten-password reset: the new password, typed twice.
 *
 * What authorizes the change is the ticket the accepted code bought, held in
 * memory only. Once the backend has taken it the flow ends on a confirmation
 * (S-A4) whose one action is Log in — no session is created on the user's
 * behalf; signing in stays its own deliberate act.
 */
export default function NewPasswordScreen() {
  const styles = useStyles();
  const router = useRouter();
  const email = usePasswordResetStore((state) => state.email);
  const ticket = usePasswordResetStore((state) => state.ticket);
  const clearReset = usePasswordResetStore((state) => state.clear);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // The address outlives the store for the confirmation's sentence: the store
  // is cleared the moment the ticket is spent.
  const [updatedFor, setUpdatedFor] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: NewPasswordFormData) => {
    if (!email || !ticket) return;
    setAuthError(null);
    setIsSubmitting(true);
    try {
      await confirmPasswordReset(email, ticket, data.password);
      setUpdatedFor(email);
      // Nothing of the reset outlives this line: the ticket is spent and the
      // address goes with it.
      clearReset();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "We couldn't change your password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // replace, not push: the reset screens are behind us and none of them can be
  // returned to — the ticket that made them work is gone.
  const goToLogin = () => router.replace('/login');

  if (updatedFor) {
    return (
      <AuthShell>
        <AnimatedEntrance>
          <View style={styles.success}>
            <IconWell icon="success" tone="success" size={72} round iconSize={30} />
            <Text variant="heading" align="center" accessibilityRole="header">
              Password updated
            </Text>
            <Text variant="bodySmall" color="inkMuted" align="center">
              {`You can now log in to ${updatedFor} with your new password.`}
            </Text>
          </View>
        </AnimatedEntrance>
        <AnimatedEntrance index={1}>
          <PrimaryButton label="Log in" onPress={goToLogin} />
        </AnimatedEntrance>
      </AuthShell>
    );
  }

  // No ticket means nothing here is authorized: the store was cleared (an app
  // restart mid-flow), or this screen was opened directly.
  if (!email || !ticket) {
    return (
      <Screen>
        <StateView
          icon="error"
          title="Start again"
          body="This reset is no longer valid. Ask for a new code and you can choose a new password."
          actions={[{ label: 'Start again', onPress: () => router.replace('/forgot-password') }]}
        />
      </Screen>
    );
  }

  return (
    <AuthShell>
      <AnimatedEntrance>
        <AuthHeading title="New password" subtitle="Choose the password you'll use from now on." />
      </AnimatedEntrance>

      <AnimatedEntrance index={1}>
        <EmailChip email={email} />
      </AnimatedEntrance>

      {authError ? <ErrorBanner title="Couldn't save your password" body={`${authError} Try again.`} /> : null}

      <AnimatedEntrance index={2}>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="New password"
              placeholder="Password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password?.message}
              locked={isSubmitting}
              secureTextEntry={!showPassword}
              autoComplete="password-new"
              textContentType="newPassword"
              autoFocus
              trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
            />
          )}
        />
      </AnimatedEntrance>

      <AnimatedEntrance index={3}>
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField
              label="Confirm password"
              placeholder="Re-enter password"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword?.message}
              helper="At least 8 characters."
              locked={isSubmitting}
              secureTextEntry={!showConfirm}
              autoComplete="password-new"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={() => handleSubmit(onSubmit)()}
              trailing={<PasswordToggle visible={showConfirm} onToggle={() => setShowConfirm((v) => !v)} />}
            />
          )}
        />
      </AnimatedEntrance>

      <AnimatedEntrance index={4}>
        <PrimaryButton
          label={authError ? 'Try again' : 'Save password'}
          loadingLabel="Saving…"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />
      </AnimatedEntrance>
    </AuthShell>
  );
}

const useStyles = createStyles((t) => ({
  success: { alignItems: 'center', gap: t.space[14], paddingTop: t.space[12] },
}));
