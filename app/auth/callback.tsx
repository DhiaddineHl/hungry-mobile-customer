import FoodLogo from "@/assets/food2.svg";
import { Palette } from "@/constants/theme";
import { useAuth } from "@/contexts/auth-context";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

/** One full turn of the spinner. Slow enough to read as branding, not a hang. */
const SPIN_DURATION_MS = 2400;
/** Rendered size, keeping the asset's own 526 x 402 aspect ratio. */
const LOGO_WIDTH = 320;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 402) / 526);

/**
 * Landing route for the OAuth deep link `hungrycustomer://auth/callback`.
 *
 * expo-auth-session consumes that URL itself (it races a Linking listener
 * against the Custom Tab), but expo-router *also* receives it and navigates
 * here. Without this file the router falls through to its built-in "Unmatched
 * Route" screen, which strands the user even when the login succeeded.
 *
 * The screen owns no auth logic and does not route a successful sign-in: the
 * root navigator does that, once it knows whether the account has a delivery
 * address. Routing here as well would land the user in the tabs first and only
 * then bounce them to the address onboarding.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const spin = useSharedValue(0);

  // 0deg and 360deg are the same frame, so repeating without reversing gives a
  // seamless loop. Runs on the UI thread, so the token exchange resolving on
  // the JS thread never stutters it.
  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: SPIN_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [spin]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  useEffect(() => {
    // Signed in: the root navigator takes it from here (tabs, or the address
    // onboarding when the account has nowhere to deliver to).
    if (isLoading || isAuthenticated) return;

    // The browser handed the code back but the exchange has not landed (or it
    // failed). Give it a beat, then return to login rather than spin forever.
    const timer = setTimeout(() => router.replace("/login"), 4000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isLoading, router]);

  return (
    <View style={styles.container}>
      <Animated.View style={spinStyle}>
        <FoodLogo width={LOGO_WIDTH} height={LOGO_HEIGHT} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Palette.navy,
  },
});
