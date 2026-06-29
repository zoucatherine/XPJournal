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
import React, { useEffect, useRef, useState, useCallback } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PinLockScreen } from "@/app/pin-lock";

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const IDLE_TIMEOUT_MS = 30_000;

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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    getPinStatus()
      .then(({ configured }) => {
        setPhase(configured ? "locked" : "unlocked");
      })
      .catch(() => setPhase("locked"));
  }, []);

  useEffect(() => {
    if (phase !== "loading") {
      SplashScreen.hideAsync();
    }
  }, [phase]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;

        if (
          prev === "active" &&
          (nextState === "inactive" || nextState === "background")
        ) {
          backgroundedAt.current = Date.now();
        } else if (
          (prev === "inactive" || prev === "background") &&
          nextState === "active"
        ) {
          const bg = backgroundedAt.current;
          backgroundedAt.current = null;

          if (bg !== null && Date.now() - bg >= IDLE_TIMEOUT_MS) {
            getPinStatus()
              .then(({ configured }) => {
                if (configured) {
                  setPhase(prev => prev === "unlocked" ? "locked" : prev);
                }
              })
              .catch(() => {});
          }
        }
      }
    );

    return () => subscription.remove();
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
