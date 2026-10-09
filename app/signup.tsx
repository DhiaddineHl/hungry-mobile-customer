import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthHeading, AuthShell, EmailChip, PhoneField } from '@/components/auth';
import { ErrorBanner, PasswordToggle, PrimaryButton, Screen, StateView, TextField } from '@/components/ds';
import { AnimatedEntrance } from '@/components/ui/animated-entrance';
import { useRegisterCustomer } from '@/hooks/use-customer';
import { hasDeliveryAddress } from '@/services/api/customer-service';
import { usePendingVerificationStore } from '@/store/pending-verification-store';
import { SignupFormData, signupSchema } from '@/schemas/auth';
import { createStyles } from '@/theme';

const COUNTRY_CODE = '+216';

/**
 * A3 Sign up — account creation, reached only from the identification screen
 * and only for an address it found no account for. That address arrives as a
 * route param, is shown back as a chip and is not asked for again.
 */
export default function SignupScreen() {
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const registerCustomer = useRegisterCustomer();
  const startVerification = usePendingVerificationStore((state) => state.start);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const isSubmitting = registerCustomer.isPending;

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { firstName: '', lastName: '', phoneNumber: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: SignupFormData) => {
    setAuthError(null);
    try {
      // One backend call creates the Keycloak login account and the Customer
      // entity in sync, and mails the one-time code the next screen asks for.
      const customer = await registerCustomer.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email,
        password: data.password,
        phoneNumber: `${COUNTRY_CODE}${data.phoneNumber.replace(/\s/g, '')}`,
      });

      // No sign-in here: the account exists but its e-mail is unproven. The
      // verification screen signs in once the code is accepted — which is why
      // it needs the password, handed over in memory rather than route params.
      // Whether an address is still needed is carried through so verification
      // knows where to send the user next.
      startVerification({
        email,
        password: data.password,
        firstName: data.firstName,
        needsAddress: !hasDeliveryAddress(customer),
      });

      router.push('/verification');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Your account wasn't created. Check your connection and try again.");
    }
  };

  // back(), not push('/login'), so the stack doesn't grow when the user
  // ping-pongs between identification and this screen.
  const goBackToIdentification = () => (router.canGoBack() ? router.back() : router.replace('/login'));

  if (!email) {
    return (
      <Screen>
        <StateView
          icon="mail"
          title="Which email?"
          body="We don't know which address to create the account for. Start again and we'll pick it back up."
          actions={[{ label: 'Continue', onPress: () => router.replace('/login') }]}
        />
      </Screen>
    );
  }

  return (
    <AuthShell
      compact
      footer={
        <PrimaryButton
          label={authError ? 'Try again' : 'Create account'}
          loadingLabel="Creating account…"
          onPress={handleSubmit(onSubmit)}
          loading={isSubmitting}
          style={styles.flex}
        />
      }
    >
      <AnimatedEntrance>
        <AuthHeading title="Create your account" subtitle="Just a few details and you're in." align="left" />
      </AnimatedEntrance>

      <AnimatedEntrance index={1}>
        <EmailChip email={email} onChange={isSubmitting ? undefined : goBackToIdentification} />
      </AnimatedEntrance>

      {authError ? (
        <ErrorBanner title="Couldn't create your account" body={`${authError} Check your details and try again.`} />
      ) : null}

      <AnimatedEntrance index={2}>
        <View style={styles.row}>
          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="First name"
                placeholder="First name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.firstName?.message}
                locked={isSubmitting}
                autoCapitalize="words"
                autoComplete="name-given"
                textContentType="givenName"
                containerStyle={styles.flex}
              />
            )}
          />
          <Controller
            control={control}
            name="lastName"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextField
                label="Last name"
                placeholder="Last name"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.lastName?.message}
                locked={isSubmitting}
                autoCapitalize="words"
                autoComplete="name-family"
                textContentType="familyName"
                containerStyle={styles.flex}
              />
            )}
          />
        </View>
      </AnimatedEntrance>

      <AnimatedEntrance index={3}>
        <Controller
          control={control}
          name="phoneNumber"
          render={({ field: { onChange, onBlur, value } }) => (
            <PhoneField
              countryCode={COUNTRY_CODE}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.phoneNumber?.message}
              locked={isSubmitting}
            />
          )}
        />
      </AnimatedEntrance>

      <AnimatedEntrance index={4}>
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
              secureTextEntry={!showPassword}
              autoComplete="password-new"
              textContentType="newPassword"
              trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
            />
          )}
        />
      </AnimatedEntrance>

      <AnimatedEntrance index={5}>
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
    </AuthShell>
  );
}

const useStyles = createStyles((t) => ({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: t.space[10], alignItems: 'flex-start' },
}));
