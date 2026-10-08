import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthHeading, AuthShell, EmailChip } from '@/components/auth';
import {
  ErrorBanner,
  PasswordToggle,
  PrimaryButton,
  Screen,
  StateView,
  TextField,
  TextLink,
} from '@/components/ds';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { useAuth } from '@/contexts/auth-context';
import { PasswordFormData, passwordSchema } from '@/schemas/auth';
import { createStyles } from '@/theme';

const WRONG_PASSWORD = 'Wrong password. Try again or reset it.';

/** Keycloak's refusal of the credentials, as opposed to the request failing. */
function isCredentialError(message: string): boolean {
  return /invalid|credential|password|unauthori[sz]ed|401/i.test(message);
}

/**
 * A2 Log in — password. Step two of signing in, for an address the
 * identification screen found an account for. The address is settled, shown
 * back as a chip, and changed by going back rather than edited here.
 */
export default function PasswordScreen() {
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const { login } = useAuth();
  const [visible, setVisible] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  });

  const onSubmit = async (data: PasswordFormData) => {
    setRequestError(null);
    setIsSubmitting(true);
    try {
      // Nothing to route on success: the root navigator reacts to the session
      // appearing, and sends an account whose e-mail is still unproven to
      // /verification and one with nowhere to deliver to to /location.
      const result = await login(email, data.password);
      if (!result.success) {
        const message = result.error ?? 'Login failed';
        // Wrong credentials are a field error (S-A2); anything else is the
        // request failing and gets the banner.
        if (isCredentialError(message)) setError('password', { message: WRONG_PASSWORD });
        else setRequestError(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBackToIdentification = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  // Opened without an address (a deep link, or a reload that lost the param):
  // only the identification step can supply one.
  if (!email) {
    return (
      <Screen>
        <StateView
          icon="mail"
          title="Which account?"
          body="We don't know which email to sign in with. Start again and we'll pick it back up."
          actions={[{ label: 'Continue', onPress: () => router.replace('/login') }]}
        />
      </Screen>
    );
  }

  return (
    <AuthShell>
      <AnimatedEntrance>
        <AuthHeading title="Welcome back" subtitle="Enter your password to continue." />
      </AnimatedEntrance>

      <AnimatedEntrance index={1}>
        <EmailChip email={email} onChange={isSubmitting ? undefined : goBackToIdentification} />
      </AnimatedEntrance>

      {requestError ? (
        <ErrorBanner title="Couldn't log in" body={`${requestError} Check your connection and try again.`} />
      ) : null}

      <AnimatedEntrance index={2}>
        <View style={styles.passwordBlock}>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Password"
                placeholder="Password"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
                locked={isSubmitting}
                secureTextEntry={!visible}
                autoComplete="password"
                textContentType="password"
                autoFocus
                returnKeyType="go"
                onSubmitEditing={() => handleSubmit(onSubmit)()}
                trailing={<PasswordToggle visible={visible} onToggle={() => setVisible((v) => !v)} />}
              />
            )}
          />
          {!isSubmitting ? (
            <TextLink
              label="Forgot password?"
              onPress={() => router.push({ pathname: '/forgot-password', params: { email } })}
              style={styles.forgot}
            />
          ) : null}
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance index={3}>
        <PrimaryButton
          label={requestError ? 'Try again' : 'Log in'}
          loadingLabel="Logging in…"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
        />
      </AnimatedEntrance>
    </AuthShell>
  );
}

const useStyles = createStyles((t) => ({
  passwordBlock: { gap: t.space[12] },
  forgot: { alignSelf: 'flex-end' },
}));
