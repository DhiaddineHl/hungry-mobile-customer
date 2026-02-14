import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthBackground } from '@/components/auth/auth-background';
import { CustomInput } from '@/components/auth/custom-input';
import { CustomButton } from '@/components/auth/custom-button';
import { supabase } from '@/lib/supabase';
import { ChevronLeft } from 'lucide-react-native';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = () => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Email is invalid');
      return false;
    }
    return true;
  };

  const handleResetPassword = async () => {
    if (!validateEmail()) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.toLowerCase().trim()
      );

      if (error) throw error;

      Alert.alert(
        'Success',
        'Password reset link has been sent to your email.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <AuthBackground>
        <View style={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ChevronLeft size={24} color="#1A2B3D" />
          </TouchableOpacity>

          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a link to reset your password.
          </Text>

          <View style={styles.form}>
            <CustomInput
              label="Email"
              placeholder="Email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              error={error}
            />

            <CustomButton
              title="SEND RESET LINK"
              onPress={handleResetPassword}
              loading={loading}
              style={styles.resetButton}
            />

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Remember your password? </Text>
              <Link href="/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.loginLink}>LOG IN</Text>
                </TouchableOpacity>
              </Link>
            </View>
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
  backButton: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A2B3D',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  form: {
    gap: 8,
  },
  resetButton: {
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
});
