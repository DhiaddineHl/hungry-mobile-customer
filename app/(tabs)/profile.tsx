import { StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedTextInput } from '@/components/form/text-input';
import { ThemedButton } from '@/components/form/button';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileSchema, ProfileFormData } from '@/schemas/auth';
import { useState } from 'react';

export default function ProfileScreen() {
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors }, reset } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '1234567890',
      bio: 'Food enthusiast and adventure seeker',
    },
  });

  const onSubmit = async (data: ProfileFormData) => {
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      Alert.alert(
        'Profile Updated',
        `Name: ${data.fullName}\nEmail: ${data.email}\nPhone: ${data.phone || 'N/A'}\nBio: ${data.bio || 'N/A'}`
      );
    }, 1000);
  };

  const handleReset = () => {
    reset({
      fullName: 'John Doe',
      email: 'john.doe@example.com',
      phone: '1234567890',
      bio: 'Food enthusiast and adventure seeker',
    });
    Alert.alert('Form Reset', 'Profile form has been reset to default values');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedView style={styles.content}>
          <ThemedText type="title" style={styles.title}>Profile</ThemedText>
          <ThemedText style={styles.subtitle}>Manage your account information</ThemedText>

          <ThemedView style={styles.form}>
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, onBlur, value } }) => (
                <ThemedTextInput
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.fullName?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <ThemedTextInput
                  label="Email"
                  placeholder="Enter your email"
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
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <ThemedTextInput
                  label="Phone Number (Optional)"
                  placeholder="Enter your phone number"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.phone?.message}
                  keyboardType="phone-pad"
                />
              )}
            />

            <Controller
              control={control}
              name="bio"
              render={({ field: { onChange, onBlur, value } }) => (
                <ThemedTextInput
                  label="Bio (Optional)"
                  placeholder="Tell us about yourself"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.bio?.message}
                  multiline
                  numberOfLines={4}
                  style={styles.bioInput}
                />
              )}
            />

            <ThemedButton
              title="Save Changes"
              onPress={handleSubmit(onSubmit)}
              loading={loading}
            />

            <ThemedButton
              title="Reset Form"
              onPress={handleReset}
              variant="secondary"
            />
          </ThemedView>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
    marginBottom: 32,
  },
  form: {
    width: '100%',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
  },
});
