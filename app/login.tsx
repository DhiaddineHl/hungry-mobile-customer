import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { AuthHeading, AuthShell, GoogleButton, OrDivider, TermsFooter } from '@/components/auth';
import { ErrorBanner, PrimaryButton, TextField } from '@/components/ds';
import { useAuth } from '@/contexts/auth-context';
import { identificationSchema, IdentificationFormData } from '@/schemas/auth';
import { lookupAccount } from '@/services/api/customer-service';

/**
 * A1 Welcome — identification, the single door into the app.
 *
 * There is no "log in or sign up?" choice: the user types an address, the
 * backend says whether an account already stands behind it, and that answer
 * picks the next screen (the password field, or the sign-up form with the
 * address already settled). Google is the secondary path below the rule.
 */
export default function IdentificationScreen() {
  const router = useRouter();
  const { loginWithGoogle } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<IdentificationFormData>({
    resolver: zodResolver(identificationSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (data: IdentificationFormData) => {
    setAuthError(null);
    setIsSubmitting(true);
    try {
      const email = data.email.trim().toLowerCase();
      const lookup = await lookupAccount(email);
      // The address travels as a route param rather than in a store: it is not
      // a secret (unlike the password, which never leaves memory), and a param
      // survives the screen being remounted by a reload.
      router.push({ pathname: lookup.registered ? '/password' : '/signup', params: { email } });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'We could not reach the server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setIsGoogleLoading(true);
    try {
      const result = await loginWithGoogle();
      if (!result.success && !result.error?.toLowerCase().includes('cancel')) {
        setAuthError(result.error ?? 'Google sign-in failed.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const busy = isSubmitting || isGoogleLoading;

  return (
    <AuthShell>
      <AuthHeading title="Welcome" subtitle="Hungry? We got you." />

      {authError ? (
        <ErrorBanner title="Couldn't continue" body={`${authError} Check your connection and try again.`} />
      ) : null}

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
            locked={busy}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => handleSubmit(onSubmit)()}
          />
        )}
      />

      <PrimaryButton
        label={authError ? 'Try again' : 'Continue'}
        loadingLabel="Checking…"
        onPress={handleSubmit(onSubmit)}
        loading={isSubmitting}
        disabled={isGoogleLoading}
      />

      <OrDivider />

      <GoogleButton onPress={handleGoogleLogin} loading={isGoogleLoading} disabled={isSubmitting} />

      <TermsFooter />
    </AuthShell>
  );
}
