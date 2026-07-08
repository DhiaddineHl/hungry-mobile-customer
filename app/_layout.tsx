import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { useFrameworkReady } from "@/hooks/useFrameworkReady";
import { queryClient, wireAppFocus } from "@/services/api/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
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
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup =
      segments[0] === "login" ||
      segments[0] === "signup" ||
      segments[0] === "verification";

    // Post-sign-up onboarding screens are reachable before the user has a
    // session (sign up → location → map → address → login), so they must not
    // be bounced back to /login while unauthenticated.
    const inOnboarding =
      segments[0] === "location" ||
      segments[0] === "map-select" ||
      segments[0] === "address-info";

    if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (!isAuthenticated && !inAuthGroup && !inOnboarding) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, segments]);

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
        {/* Auth screens cross-fade for a softer entrance. */}
        <Stack.Screen name="login" options={{ animation: "fade" }} />
        <Stack.Screen name="signup" options={{ animation: "fade" }} />
        <Stack.Screen name="verification" options={{ animation: "fade" }} />
        <Stack.Screen name="account-settings" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="location" />
        <Stack.Screen name="map-select" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="address-info" options={{ animation: "slide_from_bottom" }} />
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
        <Stack.Screen name="cart/[id]" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen name="order-details/[id]" />
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
