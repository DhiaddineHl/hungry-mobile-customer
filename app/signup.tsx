import { AuthButton, AuthInput, GoogleButton, PhoneInput } from '@/components/auth';
import { SignupFormData, signupSchema } from '@/schemas/auth';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AuthPageUpperSection from '@/assets/auth-page-upper-section.svg';

export default function SignupScreen() {
  const [countryCode] = useState('+216');

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

  const onSubmit = (data: SignupFormData) => {
    console.log('Signup data:', data);
    router.push('/location');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <AuthPageUpperSection
        width="100%"
        style={styles.svgBackground}
        preserveAspectRatio="xMidYMid slice"
      />
      <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.backgroundSpacer} />

          <View style={styles.formContainer}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>Sign Up to Hungry</Text>
              <Text style={styles.subtitle}>Hungry? We got you !</Text>
            </View>

            <View style={styles.form}>
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
                      />
                    )}
                  />
                </View>
              </View>

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
                  />
                )}
              />

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
                    isPassword
                  />
                )}
              />

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
                    isPassword
                  />
                )}
              />

              <AuthButton
                title="SIGN UP"
                onPress={handleSubmit(onSubmit)}
                style={styles.submitButton}
              />

              <View style={styles.loginRow}>
                <Text style={styles.loginText}>Already have an account ? </Text>
                <Link href="/login" asChild>
                  <TouchableOpacity>
                    <Text style={styles.loginLink}>LOGIN</Text>
                  </TouchableOpacity>
                </Link>
              </View>

              <View style={styles.dividerRow}>
                <Text style={styles.dividerText}>Or</Text>
              </View>

              <GoogleButton onPress={() => console.log('Google signup')} />

              <Text style={styles.termsText}>
                By continuing, you automatically accept our{' '}
                <Text style={styles.termsLink}>Terms & Conditions</Text>,{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text> and{' '}
                <Text style={styles.termsLink}>Cookies policy</Text>.
              </Text>
            </View>
          </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  svgBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  backgroundSpacer: {
    height: 200,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A2B3D',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
  },
  form: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameField: {
    flex: 1,
  },
  submitButton: {
    marginTop: 8,
    marginBottom: 20,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginText: {
    fontSize: 14,
    color: '#666666',
  },
  loginLink: {
    fontSize: 14,
    color: '#F5A623',
    fontWeight: '600',
  },
  dividerRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerText: {
    fontSize: 14,
    color: '#999999',
  },
  termsText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
  termsLink: {
    color: '#F5A623',
    textDecorationLine: 'underline',
  },
});
