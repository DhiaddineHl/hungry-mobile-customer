import { Palette } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { useCurrentCustomer } from "@/hooks/use-delivery-address";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { hasDeliveryAddress } from "@/services/api/customer-service";
import { queryClient, wireAppFocus } from "@/services/api/query-client";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import {
  DefaultTheme,
  Stack,
  ThemeProvider,
  useRouter,
  useSegments,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

function RootNavigator() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, isCustomerResolved, user, authMethod } = useAuth();
  const { data: customer } = useCurrentCustomer();

  // Registers this device and handles taps. Mounted here rather than in
  // RootLayout because it reads the auth context and drives the router, both of
  // which only exist inside this component.
  usePushNotifications();

  useEffect(() => {
    if (isLoading) return;

    // "auth" is the OAuth deep-link landing group (app/auth/callback.tsx). It
    // belongs here so an unauthenticated arrival is not bounced to /login while
    // the token exchange is still in flight.
    const inAuthGroup =
      segments[0] === "login" ||
      segments[0] === "password" ||
      segments[0] === "signup" ||
      segments[0] === "verification" ||
      // The forgotten-password reset: three screens reached from /password,
      // all of them without a session — the user is here precisely because
      // they cannot get one.
      segments[0] === "forgot-password" ||
      segments[0] === "reset-code" ||
      segments[0] === "new-password" ||
      segments[0] === "auth";

    // Address onboarding. Normally reached with a session (verification signs
    // the new account in before handing over), but kept out of the /login
    // bounce below so a mid-flow token refresh cannot eject the user from a
    // half-entered address.
    const inOnboarding =
      segments[0] === "complete-profile" ||
      segments[0] === "location" ||
      segments[0] === "map-select" ||
      segments[0] === "address-info";

    // A signed-in account is held in whichever step it has not finished yet,
    // in order: prove the e-mail, have a customer record, have somewhere to
    // deliver to. All three are keyed off server state rather than a local
    // flag, so they cover every way in — in-app registration, password login
    // and Google — and survive a reinstall.
    if (isAuthenticated) {
      // An unverified email outranks the rules below: the account exists but
      // has not proved it owns the address, so it goes back to the code
      // screen. Keycloak is the source of truth (`email_verified` is a claim
      // on the token), and a claim the realm does not emit reads as undefined,
      // which deliberately gates nobody.
      //
      // Social logins are exempt outright: Google proved the address, and no
      // code was ever mailed for it — sending them to /verification would ask
      // for a code that does not exist. (Keycloak may still mark the brokered
      // account unverified when the Google IdP has "Trust Email" off, which is
      // exactly the case this guard covers.)
      if (authMethod !== "google" && user?.email_verified === false) {
        if (segments[0] !== "verification") {
          router.replace("/verification");
        }
        return;
      }

      // Route nothing until the record is known, or a new account flashes the
      // tabs on its way to the onboarding.
      if (!isCustomerResolved) return;

      // A null record — the lookup finished and the backend has none — is a
      // Google account on its first sign-in: Keycloak provisioned it while
      // brokering, so nothing ever registered it here. It needs a name and a
      // phone number before there is a record to hang an address off.
      // `undefined` is different and deliberately not caught: the lookup
      // failed, and stranding the user in a form that cannot save is worse
      // than letting them through.
      if (customer === null) {
        if (segments[0] !== "complete-profile") {
          router.replace("/complete-profile");
        }
        return;
      }

      if (customer && !hasDeliveryAddress(customer)) {
        if (!inOnboarding) {
          router.replace("/location");
        }
        return;
      }
    }

    if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (!isAuthenticated && !inAuthGroup && !inOnboarding) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, segments, isCustomerResolved, customer, user, authMethod]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          // Default: push pages slide in smoothly from the side.
          animation: "slide_from_right",
          animationDuration: 280,
          gestureEnabled: true,
          contentStyle: { backgroundColor: "#FFFFFF" },
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* Auth screens cross-fade for a softer entrance. Their container is
            navy so the fade never flashes white behind the backdrop. */}
        <Stack.Screen
          name="login"
          options={{
            animation: "fade",
            contentStyle: { backgroundColor: Palette.navy },
          }}
        />
        <Stack.Screen
          name="password"
          options={{
            animation: "fade",
            contentStyle: { backgroundColor: Palette.navy },
          }}
        />
        <Stack.Screen
          name="signup"
          options={{
            animation: "fade",
            contentStyle: { backgroundColor: Palette.navy },
          }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{
            animation: "fade",
            contentStyle: { backgroundColor: Palette.navy },
          }}
        />
        <Stack.Screen name="reset-code" options={{ animation: "fade" }} />
        <Stack.Screen
          name="new-password"
          options={{
            animation: "fade",
            contentStyle: { backgroundColor: Palette.navy },
          }}
        />
        <Stack.Screen name="verification" options={{ animation: "fade" }} />
        <Stack.Screen
          name="auth/callback"
          options={{
            animation: "fade",
            contentStyle: { backgroundColor: Palette.navy },
          }}
        />
        <Stack.Screen
          name="account-settings"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="complete-profile"
          options={{
            animation: "fade",
            contentStyle: { backgroundColor: Palette.navy },
          }}
        />
        <Stack.Screen name="location" />
        <Stack.Screen
          name="map-select"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="address-info"
          options={{ animation: "slide_from_bottom" }}
        />
        {/* Restaurant details slide in from the side. */}
        <Stack.Screen
          name="restaurant/[id]/index"
          options={{ animation: "slide_from_right" }}
        />
        <Stack.Screen
          name="restaurant/[id]/info"
          options={{ presentation: "modal" }}
        />
        {/* A product opens as a bottom sheet: slides up on open and back down
            on dismiss at the same, slightly slower native tempo. */}
        <Stack.Screen
          name="food/[id]"
          options={{
            presentation: "modal",
            gestureEnabled: true,
            gestureDirection: "vertical",
          }}
        />
        <Stack.Screen
          name="cart/[id]"
          options={{ animation: "slide_from_bottom" }}
        />
        <Stack.Screen name="order-details/[id]" />
        {/* My Orders and one placed order — both slide in like the rest of
            the push stack. */}
        <Stack.Screen name="orders/index" />
        <Stack.Screen name="orders/[id]" />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  const [fontsLoaded, fontError] = useFonts({
    "Poppins-Regular": Poppins_400Regular,
    "Poppins-Medium": Poppins_500Medium,
    "Poppins-SemiBold": Poppins_600SemiBold,
    "Poppins-Bold": Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Forward app foreground/background state to React Query's focusManager so
  // stale queries refetch when the app comes back to the foreground.
  useEffect(() => wireAppFocus(), []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={DefaultTheme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
