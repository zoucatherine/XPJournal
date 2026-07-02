import React, { useState, useCallback } from "react";
import { signup, login, ApiError } from "@workspace/api-client-react";

interface Props {
  onAuthenticated: (token: string, username: string) => void;
}

const XP_BTN: React.CSSProperties = {
  minWidth: 75,
  padding: "3px 10px",
  fontFamily: "Tahoma, sans-serif",
  fontSize: 12,
  cursor: "pointer",
  border: "2px outset #d4d0c8",
  background: "#ece9d8",
  color: "#000",
};

const LABEL: React.CSSProperties = {
  fontFamily: "Tahoma, sans-serif",
  fontSize: 12,
  color: "#000",
  marginBottom: 4,
};

const INPUT: React.CSSProperties = {
  fontFamily: "Tahoma, sans-serif",
  fontSize: 12,
  border: "2px inset #888",
  background: "#fff",
  padding: "4px 8px",
  width: "100%",
  boxSizing: "border-box",
};

type Mode = "login" | "signup";

export function AuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);

  const shake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }, []);

  const reset = () => {
    setError(null);
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Please fill in all fields.");
      shake();
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      shake();
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === "signup"
          ? await signup({ username: username.trim(), password })
          : await login({ username: username.trim(), password });
      onAuthenticated(result.token, result.username);
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { error?: string } | null;
        setError(data?.error ?? "Something went wrong. Please try again.");
      } else {
        setError("Could not reach the server. Please try again.");
      }
      shake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0055e5",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 340,
          background: "#ece9d8",
          border: "2px outset #d4d0c8",
          boxShadow: "4px 4px 12px rgba(0,0,0,0.6)",
          animation: shaking ? "xp-shake 0.5s" : undefined,
        }}
      >
        <style>{`
          @keyframes xp-shake {
            0%,100% { transform: translateX(0); }
            15% { transform: translateX(-8px); }
            30% { transform: translateX(8px); }
            45% { transform: translateX(-6px); }
            60% { transform: translateX(6px); }
            75% { transform: translateX(-3px); }
            90% { transform: translateX(3px); }
          }
        `}</style>

        <div
          style={{
            background: "linear-gradient(to right, #0a246a, #3a6ea5)",
            padding: "4px 6px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            userSelect: "none",
          }}
        >
          <span style={{ fontSize: 14 }}>📓</span>
          <span
            style={{
              color: "white",
              fontFamily: "Tahoma, sans-serif",
              fontSize: 12,
              fontWeight: "bold",
              textShadow: "1px 1px rgba(0,0,0,0.5)",
            }}
          >
            {mode === "login" ? "Log In to My Journal" : "Create Your Journal Account"}
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: "16px 18px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>🔐</span>
            <div
              style={{
                fontFamily: "Tahoma, sans-serif",
                fontSize: 12,
                color: "#000",
                lineHeight: 1.4,
              }}
            >
              {mode === "login"
                ? "Sign in to see your journal on this device."
                : "Set up an account so you can log into your journal from any device."}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={LABEL}>Username:</div>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              style={INPUT}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={LABEL}>Password:</div>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              style={INPUT}
            />
          </div>

          {mode === "signup" && (
            <div style={{ marginBottom: 12 }}>
              <div style={LABEL}>Confirm Password:</div>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                style={INPUT}
              />
            </div>
          )}

          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "#fff0f0",
                border: "1px solid #c00",
                padding: "4px 8px",
                marginBottom: 10,
                fontFamily: "Tahoma, sans-serif",
                fontSize: 11,
                color: "#c00",
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 12,
              borderTop: "1px solid #aaa",
              paddingTop: 10,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                reset();
              }}
              style={{
                background: "none",
                border: "none",
                color: "#0a246a",
                textDecoration: "underline",
                fontFamily: "Tahoma, sans-serif",
                fontSize: 11,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </button>
            <button type="submit" disabled={loading} style={{ ...XP_BTN, opacity: loading ? 0.6 : 1 }}>
              {mode === "login" ? "Log In" : "Sign Up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
