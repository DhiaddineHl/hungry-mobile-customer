import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Fonts, FontSize, Palette, Radius, Spacing } from '@/constants/theme';

interface CheckoutButtonProps {
  total: string;
  onPress?: () => void;
}

export function CheckoutButton({ total, onPress }: CheckoutButtonProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <PressableScale
        style={styles.button}
        onPress={onPress}
        scaleTo={0.98}
        dimTo={0.95}
        haptic
        accessibilityLabel={`Continue to checkout, total ${total}`}
      >
        <Text style={styles.buttonText}>Continue</Text>
        <Text style={styles.totalText}>{total}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    backgroundColor: Palette.surface,
    borderTopWidth: 1,
    borderTopColor: Palette.borderSubtle,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Palette.ink,
    borderRadius: Radius.xxl + 4,
    paddingVertical: Spacing.lg,
    gap: Spacing.xl,
  },
  buttonText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Palette.textInverse,
  },
  totalText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Palette.textInverse,
  },
});
