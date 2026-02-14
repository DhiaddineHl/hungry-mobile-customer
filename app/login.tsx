import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthBackground } from '@/components/auth/auth-background';
import { CustomInput } from '@/components/auth/custom-input';
import { CustomButton } from '@/components/auth/custom-button';
import { GoogleButton } from '@/components/auth/google-button';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password,
      });

      if (error) throw error;

      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <AuthBackground>
        <View style={styles.content}>
          <Text style={styles.title}>Welcome !</Text>
          <Text style={styles.subtitle}>Hungry? We got you !</Text>

          <View style={styles.form}>
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

            <Link href="/forgot-password" asChild>
              <TouchableOpacity>
                <Text style={styles.forgotPassword}>Forgot Password</Text>
              </TouchableOpacity>
            </Link>

            <CustomButton
              title="LOG IN"
              onPress={handleLogin}
              loading={loading}
              style={styles.loginButton}
            />

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <Link href="/signup" asChild>
                <TouchableOpacity>
                  <Text style={styles.signupLink}>SIGN UP</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <Text style={styles.divider}>Or</Text>

            <GoogleButton
              onPress={() => Alert.alert('Coming Soon', 'Google login will be available soon')}
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
  forgotPassword: {
    fontSize: 14,
    color: '#1A2B3D',
    textAlign: 'right',
    marginTop: -8,
    marginBottom: 8,
  },
  loginButton: {
    marginTop: 16,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signupText: {
    fontSize: 14,
    color: '#666666',
  },
  signupLink: {
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
