import { StyleSheet, ActivityIndicator, Text, ViewStyle } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { FontSize, Fonts, Palette, Radius } from '@/constants/theme';

interface AuthButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Fill colour. Defaults to the brand primary. */
  color?: string;
  /** Corner treatment: fully rounded (default) or the softer auth-card radius. */
  shape?: 'pill' | 'rounded';
}

export function AuthButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  style,
  color = Palette.primary,
  shape = 'pill',
}: AuthButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <PressableScale
      style={[
        styles.button,
        { backgroundColor: isDisabled ? Palette.disabled : color },
        shape === 'rounded' ? styles.rounded : styles.pill,
        style,
      ]}
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  pill: {
    borderRadius: Radius.pill,
  },
  rounded: {
    borderRadius: Radius.lg,
  },
  text: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.lg,
    color: Palette.textInverse,
    letterSpacing: 1,
  },
});
