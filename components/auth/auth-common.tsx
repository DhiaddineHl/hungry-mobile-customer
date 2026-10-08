import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ds';
import { createStyles } from '@/theme';

/** Title (`display`) + subtitle (`bodySmall`, inkMuted). Centred, or left on Sign up. */
export function AuthHeading({
  title,
  subtitle,
  detail,
  align = 'center',
}: {
  title: string;
  subtitle?: string;
  /** Bold line under the subtitle (the address a code went to). */
  detail?: string;
  align?: 'center' | 'left';
}) {
  const styles = useStyles();
  return (
    <View style={styles.heading}>
      <Text variant="display" align={align} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodySmall" color="inkMuted" align={align}>
          {subtitle}
        </Text>
      ) : null}
      {detail ? (
        <Text variant="bodySmall" align={align} style={styles.detail} numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** Thin rule with "or" between the email path and Google. */
export function OrDivider() {
  const styles = useStyles();
  return (
    <View style={styles.or}>
      <View style={styles.rule} />
      <Text variant="caption" color="inkMuted">
        or
      </Text>
      <View style={styles.rule} />
    </View>
  );
}

/** Small print under the sign-in actions. Links open the legal pages. */
export function TermsFooter() {
  const styles = useStyles();
  const router = useRouter();
  return (
    <Text variant="caption" color="inkMuted" align="center" style={styles.terms}>
      By continuing, you accept our{' '}
      <Text variant="caption" style={styles.link} onPress={() => router.push('/legal/terms')} accessibilityRole="link">
        Terms & Conditions
      </Text>
      ,{' '}
      <Text variant="caption" style={styles.link} onPress={() => router.push('/legal/privacy')} accessibilityRole="link">
        Privacy Policy
      </Text>{' '}
      and{' '}
      <Text variant="caption" style={styles.link} onPress={() => router.push('/legal/privacy')} accessibilityRole="link">
        Cookies policy
      </Text>
      .
    </Text>
  );
}

/** "Remembered it? Go back" — a muted prompt with an underlined action. */
export function AuthPrompt({
  prompt,
  action,
  onPress,
  disabled,
}: {
  prompt: string;
  action: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <Text variant="meta" color="inkMuted" align="center">
      {prompt}{' '}
      <Text
        variant="link"
        style={styles.link}
        onPress={disabled ? undefined : onPress}
        accessibilityRole="link"
      >
        {action}
      </Text>
    </Text>
  );
}

const useStyles = createStyles((t) => ({
  heading: { gap: t.space[4] },
  detail: { fontFamily: t.typography.itemLabel.fontFamily },
  or: { flexDirection: 'row', alignItems: 'center', gap: t.space[12] },
  rule: { flex: 1, height: 1, backgroundColor: t.colors.divider },
  terms: { lineHeight: 18 },
  link: { color: t.colors.ink, textDecorationLine: 'underline', fontFamily: t.typography.label.fontFamily },
}));
