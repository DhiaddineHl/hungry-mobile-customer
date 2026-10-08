import { useEffect } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import HungryLogo from '@/assets/brand/logo-hungry.svg';
import { Spinner, Text } from '@/components/ds';
import { useAuth } from '@/contexts/auth-context';
import { createStyles, useTheme } from '@/theme';

/**
 * Landing route for the OAuth deep link `hungrycustomer://auth/callback`.
 *
 * expo-auth-session consumes that URL itself, but expo-router *also* receives
 * it and navigates here; without this file the router would show its
 * "Unmatched Route" screen even when the login succeeded.
 *
 * The screen owns no auth logic and does not route a successful sign-in: the
 * root navigator does that, once it knows whether the account has a delivery
 * address.
 */
export default function AuthCallbackScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { size } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    // The browser handed the code back but the exchange has not landed (or it
    // failed). Give it a beat, then return to login rather than spin forever.
    const timer = setTimeout(() => router.replace('/login'), 4000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, router]);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <HungryLogo width={size.authLogoWidth} height={size.authLogoWidth * (76 / 232)} />
      <View style={styles.status}>
        <Spinner tone="onInk" />
        <Text variant="chip" color="onInk">
          Signing you in…
        </Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((t) => ({
  screen: { flex: 1, backgroundColor: t.colors.ink, alignItems: 'center', justifyContent: 'center', gap: t.space[32] },
  status: { flexDirection: 'row', alignItems: 'center', gap: t.space[10] },
}));
