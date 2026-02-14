import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthBackground } from '@/components/auth/auth-background';
import { CustomInput } from '@/components/auth/custom-input';
import { CustomButton } from '@/components/auth/custom-button';
import { GoogleButton } from '@/components/auth/google-button';
import { supabase } from '@/lib/supabase';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password: password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        'Account created successfully! You can now log in.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <AuthBackground>
        <View style={styles.content}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started!</Text>

          <View style={styles.form}>
            <CustomInput
              label="Name"
              placeholder="Your name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              error={errors.name}
            />

            <CustomInput
              label="Email"
              placeholder="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              error={errors.email}
            />

            <CustomInput
              label="Password"
              placeholder="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              secureTextEntry
              error={errors.password}
            />

            <CustomInput
              label="Confirm Password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword)
                  setErrors({ ...errors, confirmPassword: undefined });
              }}
              secureTextEntry
              error={errors.confirmPassword}
            />

            <CustomButton
              title="SIGN UP"
              onPress={handleSignup}
              loading={loading}
              style={styles.signupButton}
            />

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <Link href="/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.loginLink}>LOG IN</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <Text style={styles.divider}>Or</Text>

            <GoogleButton
              title="SIGN UP WITH GOOGLE"
              onPress={() => Alert.alert('Coming Soon', 'Google signup will be available soon')}
            />

            <Text style={styles.terms}>
              By continuing, you automatically accept our{' '}
              <Text style={styles.termsLink}>Terms & Conditions</Text>,{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text> and{' '}
              <Text style={styles.termsLink}>Cookies policy</Text>.
            </Text>
          </View>
        </View>
      </AuthBackground>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A2B3D',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 8,
  },
  signupButton: {
    marginTop: 16,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  loginText: {
    fontSize: 14,
    color: '#666666',
  },
  loginLink: {
    fontSize: 14,
    color: '#FF8C00',
    fontWeight: '600',
  },
  divider: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginVertical: 16,
  },
  terms: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
    marginTop: 16,
  },
  termsLink: {
    color: '#1A2B3D',
    textDecorationLine: 'underline',
  },
});
