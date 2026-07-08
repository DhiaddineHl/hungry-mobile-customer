import { StyleSheet, ActivityIndicator, Text, ViewStyle } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { FontSize, Palette, Radius } from '@/constants/theme';

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function AuthButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
}: AuthButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      style={[styles.button, isDisabled && styles.buttonDisabled, style]}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      scaleTo={0.97}
      dimTo={0.9}
      haptic
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator color={Palette.textInverse} />
      ) : (
        <Text style={styles.text}>{title}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: Radius.xxl + 2,
    backgroundColor: Palette.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: Palette.disabled,
  },
  text: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Palette.textInverse,
    letterSpacing: 1,
  },
});
