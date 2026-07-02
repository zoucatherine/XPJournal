import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getMe, setAuthTokenGetter } from "@workspace/api-client-react";

export type AuthPhase = "loading" | "unauthenticated" | "authenticated";

export interface AuthState {
  phase: AuthPhase;
  username: string | null;
}

export interface AuthContextValue {
  state: AuthState;
  onAuthenticated: (token: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (username: string) => void;
}

const AUTH_TOKEN_KEY = "journal_auth_token";

// expo-secure-store wraps the OS keychain/keystore on iOS/Android, so the
// bearer token never sits in plaintext-readable storage on-device. It has no
// native backing on web, so we fall back to AsyncStorage there (web has no
// keychain equivalent, and browser storage is the platform norm).
const isWeb = Platform.OS === "web";

let cachedToken: string | null | undefined;

async function getStoredToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  const token = isWeb
    ? await AsyncStorage.getItem(AUTH_TOKEN_KEY)
    : await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  cachedToken = token;
  return token;
}

async function setStoredToken(token: string) {
  cachedToken = token;
  if (isWeb) {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
  }
}

async function clearStoredToken() {
  cachedToken = null;
  if (isWeb) {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
  }
}

// Registered once at module load so every request carries the current
// bearer token (or none, if logged out).
setAuthTokenGetter(() => getStoredToken());

const AuthContext = createContext<AuthContextValue | null>(null);

// A single provider instance owns the auth state so that every consumer
// (the root AuthGate and any settings/logout screen) reads and mutates the
// same state. Without this, calling logout() from one screen would leave
// other useAuth() instances (e.g. the gate in _layout.tsx) unaware, and the
// app would not return to the login screen.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ phase: "loading", username: null });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await getStoredToken();
      if (!token) {
        if (!cancelled) setState({ phase: "unauthenticated", username: null });
        return;
      }
      try {
        const { username } = await getMe();
        if (!cancelled) setState({ phase: "authenticated", username });
      } catch {
        await clearStoredToken();
        if (!cancelled) setState({ phase: "unauthenticated", username: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onAuthenticated = useCallback(async (token: string, username: string) => {
    await setStoredToken(token);
    setState({ phase: "authenticated", username });
  }, []);

  const logout = useCallback(async () => {
    await clearStoredToken();
    setState({ phase: "unauthenticated", username: null });
  }, []);

  // Username changes don't rotate the session token, so we only need to
  // update the locally cached username, not the stored auth token.
  const updateUsername = useCallback((username: string) => {
    setState(prev => (prev.phase === "authenticated" ? { ...prev, username } : prev));
  }, []);

  return createElement(
    AuthContext.Provider,
    { value: { state, onAuthenticated, logout, updateUsername } },
    children,
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
