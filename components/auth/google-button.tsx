import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { GoogleLogo } from './google-logo';
import { FontSize, Fonts, Palette, Radius, Spacing } from '@/constants/theme';

interface GoogleButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Defaults to the label used on both auth screens in the design. */
  label?: string;
}

export function GoogleButton({
  onPress,
  loading = false,
  disabled = false,
  label = 'LOG IN WITH GOOGLE',
}: GoogleButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      scaleTo={0.97}
      dimTo={0.9}
      accessibilityLabel={label}
    >
      {loading ? (
        <ActivityIndicator color={Palette.ink} />
      ) : (
        <>
          <GoogleLogo size={22} />
          <Text style={styles.text}>{label}</Text>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Palette.border,
    backgroundColor: Palette.surface,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.md,
    color: Palette.ink,
    letterSpacing: 0.5,
  },
});
