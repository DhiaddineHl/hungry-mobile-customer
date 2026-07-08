import { StyleSheet, ActivityIndicator, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';

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
  disabled = false,
}: ThemedButtonProps) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  const backgroundColor = isPrimary
    ? isDisabled
      ? Palette.disabled
      : Palette.primary
    : 'transparent';

  const borderColor = isPrimary ? 'transparent' : Palette.primary;
  const contentColor = isPrimary
    ? Palette.textInverse
    : isDisabled
      ? Palette.textMuted
      : Palette.primary;

  return (
    <PressableScale
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      scaleTo={0.97}
      dimTo={0.9}
      haptic={isPrimary}
      style={[
        styles.button,
        {
          backgroundColor,
          borderColor,
          borderWidth: isPrimary ? 0 : 1.5,
          opacity: isDisabled && !isPrimary ? 0.5 : 1,
        },
      ]}
      accessibilityLabel={title}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={contentColor} />
        ) : (
          <ThemedText style={[styles.text, { color: contentColor }]}>
            {title}
          </ThemedText>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: Spacing.sm,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  text: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
  },
});
