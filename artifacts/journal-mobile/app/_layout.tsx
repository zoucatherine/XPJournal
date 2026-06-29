import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl, getPinStatus } from "@workspace/api-client-react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PinLockScreen } from "@/app/pin-lock";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

type PinPhase = "loading" | "setup" | "locked" | "unlocked";

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="entry/[date]" options={{ headerShown: false }} />
      <Stack.Screen name="notes" options={{ headerShown: false }} />
    </Stack>
  );
}

function PinGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<PinPhase>("loading");

  useEffect(() => {
    getPinStatus()
      .then(({ configured }) => {
        setPhase(configured ? "locked" : "unlocked");
      })
      .catch(() => setPhase("locked"));
  }, []);

  const onSuccess = useCallback(() => setPhase("unlocked"), []);

  if (phase === "loading") return null;

  if (phase === "setup") {
    return <PinLockScreen mode="setup" onSuccess={onSuccess} />;
  }

  if (phase === "locked") {
    return <PinLockScreen mode="unlock" onSuccess={onSuccess} />;
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <PinGate>
                <RootLayoutNav />
              </PinGate>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
