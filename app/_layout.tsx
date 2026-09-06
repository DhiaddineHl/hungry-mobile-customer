import { Palette } from "@/constants/theme";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { useCurrentCustomer } from "@/hooks/use-delivery-address";
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
  const { isAuthenticated, isLoading, isCustomerResolved, user } = useAuth();
  const { data: customer } = useCurrentCustomer();

  useEffect(() => {
    if (isLoading) return;

    // "auth" is the OAuth deep-link landing group (app/auth/callback.tsx). It
    // belongs here so an unauthenticated arrival is not bounced to /login while
    // the token exchange is still in flight.
    const inAuthGroup =
      segments[0] === "login" ||
      segments[0] === "signup" ||
      segments[0] === "verification" ||
      segments[0] === "auth";

    // Address onboarding. Normally reached with a session (verification signs
    // the new account in before handing over), but kept out of the /login
    // bounce below so a mid-flow token refresh cannot eject the user from a
    // half-entered address.
    const inOnboarding =
      segments[0] === "location" ||
      segments[0] === "map-select" ||
      segments[0] === "address-info";

    // An account with a valid session but nowhere to deliver to is held in the
    // address onboarding — it outranks the rules below. This is keyed off the
    // customer record rather than a local flag so it covers every way in:
    // in-app registration, password login, and a Google sign-in (whose record
    // the app creates itself, addressless, right after the token exchange).
    if (isAuthenticated) {
      // An unverified email outranks even the address rule: the account exists
      // but has not proved it owns the address, so it goes back to the code
      // screen — whichever way it got a session. Keycloak is the source of
      // truth here (`email_verified` is a claim on the token), and a claim the
      // realm does not emit reads as undefined, which deliberately does not
      // gate anyone.
      if (user?.email_verified === false) {
        if (segments[0] !== "verification") {
          router.replace("/verification");
        }
        return;
      }

      // Route nothing until the record is known, or a new account flashes the
      // tabs on its way to the onboarding.
      if (!isCustomerResolved) return;
      // A null record means the lookup finished and found none (or its
      // creation failed). Sending the user to an onboarding that has nothing
      // to save against would strand them, so let them through instead.
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
  }, [isAuthenticated, isLoading, segments, isCustomerResolved, customer, user]);

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
          name="signup"
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
