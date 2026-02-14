import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ThemedButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
}

export function ThemedButton({
  title,
  onPress,
  loading = false,
  variant = 'primary',
  disabled = false
}: ThemedButtonProps) {
  const colorScheme = useColorScheme();
  const isPrimary = variant === 'primary';

  const backgroundColor = disabled
    ? '#cccccc'
    : isPrimary
      ? (colorScheme === 'dark' ? '#2563eb' : '#3b82f6')
      : 'transparent';

  const borderColor = isPrimary ? 'transparent' : (colorScheme === 'dark' ? '#3b82f6' : '#2563eb');

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor, borderColor, borderWidth: isPrimary ? 0 : 1 },
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? '#ffffff' : (colorScheme === 'dark' ? '#3b82f6' : '#2563eb')} />
      ) : (
        <ThemedText style={[styles.text, { color: isPrimary ? '#ffffff' : (colorScheme === 'dark' ? '#3b82f6' : '#2563eb') }]}>
          {title}
        </ThemedText>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
