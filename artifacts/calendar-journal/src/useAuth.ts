import { useState, useEffect, useCallback } from "react";
import { getMe, setAuthTokenGetter } from "@workspace/api-client-react";

export type AuthPhase = "loading" | "unauthenticated" | "authenticated";

export interface AuthState {
  phase: AuthPhase;
  username: string | null;
}

const AUTH_TOKEN_KEY = "journal_auth_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string) {
  try {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch {}
}

function clearStoredToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {}
}

// Registered once at module load so every request carries the current
// bearer token (or none, if logged out).
setAuthTokenGetter(() => getStoredToken());

export function useAuth() {
  const [state, setState] = useState<AuthState>({ phase: "loading", username: null });

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setState({ phase: "unauthenticated", username: null });
      return;
    }
    getMe()
      .then(({ username }) => setState({ phase: "authenticated", username }))
      .catch(() => {
        clearStoredToken();
        setState({ phase: "unauthenticated", username: null });
      });
  }, []);

  const onAuthenticated = useCallback((token: string, username: string) => {
    setStoredToken(token);
    setState({ phase: "authenticated", username });
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setState({ phase: "unauthenticated", username: null });
  }, []);

  return { state, onAuthenticated, logout };
}
