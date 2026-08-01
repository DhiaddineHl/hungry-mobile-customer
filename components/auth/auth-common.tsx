import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { FontSize, Fonts, Palette, Spacing } from '@/constants/theme';

/** Centred title + subtitle block at the top of the auth card. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.heading}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

/** "Don't have an account? SIGN UP" style cross-link between the auth screens. */
export function AuthSwitchLink({
  prompt,
  action,
  onPress,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchText}>{prompt}</Text>
      <PressableScale onPress={onPress} scaleTo={0.94} accessibilityLabel={action}>
        <Text style={styles.switchAction}>{action}</Text>
      </PressableScale>
    </View>
  );
}

export function OrDivider() {
  return (
    <View style={styles.divider}>
      <Text style={styles.dividerText}>Or</Text>
    </View>
  );
}

export function TermsFooter() {
  return (
    <Text style={styles.terms}>
      By continuing, you automatically accept our{' '}
      <Text style={styles.termsLink}>Terms & Conditions</Text>,{' '}
      <Text style={styles.termsLink}>Privacy Policy</Text> and{' '}
      <Text style={styles.termsLink}>Cookies policy</Text>.
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.display,
    color: Palette.ink,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    color: Palette.textSecondary,
  },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  switchText: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    color: Palette.textSecondary,
  },
  switchAction: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.md,
    color: Palette.primaryDeep,
  },
  divider: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  dividerText: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.md,
    color: Palette.textMuted,
  },
  terms: {
    fontFamily: Fonts.regular,
    fontSize: FontSize.sm,
    color: Palette.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.xl,
  },
  termsLink: {
    color: Palette.textSecondary,
    textDecorationLine: 'underline',
  },
});
