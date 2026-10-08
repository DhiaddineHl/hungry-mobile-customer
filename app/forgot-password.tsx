import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthHeading, AuthPrompt, AuthShell } from '@/components/auth';
import { ErrorBanner, PrimaryButton, TextField } from '@/components/ds';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { ForgotPasswordFormData, forgotPasswordSchema } from '@/schemas/auth';
import { sendPasswordResetCode } from '@/services/api/customer-service';
import { usePasswordResetStore } from '@/store/password-reset-store';

/**
 * A4 Forgot password — step one of a reset: which address to send the code to.
 *
 * Reached from the password screen, which already knows the address, so the
 * field arrives filled in — but it stays editable: someone who mistyped their
 * way here, or who has two accounts, should not have to walk back to fix it.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
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
    <AuthShell>
      <AnimatedEntrance>
        <AuthHeading title="Forgot password?" subtitle="We'll email you a code to reset it." />
      </AnimatedEntrance>

      {authError ? <ErrorBanner title="Couldn't send the code" body={authError} /> : null}

      <AnimatedEntrance index={1}>
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
              locked={isSubmitting}
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
        <PrimaryButton
          label={authError ? 'Try again' : 'Send code'}
          loadingLabel="Sending code…"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />
      </AnimatedEntrance>

      <AnimatedEntrance index={3}>
        <AuthPrompt
          prompt="Remembered it?"
          action="Go back"
          disabled={isSubmitting}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
        />
      </AnimatedEntrance>
    </AuthShell>
  );
}
