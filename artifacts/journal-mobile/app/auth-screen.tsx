import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signup, login, ApiError } from "@workspace/api-client-react";

interface Props {
  onAuthenticated: (token: string, username: string) => void;
}

type Mode = "login" | "signup";

export function AuthScreen({ onAuthenticated }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const shakeAnim = React.useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  const handleSubmit = async () => {
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.inner, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.icon}>📓</Text>
        <Text style={styles.title}>{mode === "login" ? "Welcome Back" : "Create Your Account"}</Text>
        <Text style={styles.subtitle}>
          {mode === "login"
            ? "Log in to see your journal on this device."
            : "Set up an account so you can log in from any device."}
        </Text>

        <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(v) => { setUsername(v); setError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="username"
            placeholderTextColor="#8080b0"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            secureTextEntry
            placeholder="password"
            placeholderTextColor="#8080b0"
          />

          {mode === "signup" && (
            <>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); setError(null); }}
                secureTextEntry
                placeholder="confirm password"
                placeholderTextColor="#8080b0"
              />
            </>
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [styles.submitBtn, (pressed || loading) && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitBtnText}>{mode === "login" ? "Log In" : "Sign Up"}</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(null);
              setPassword("");
              setConfirmPassword("");
            }}
            style={styles.switchBtn}
          >
            <Text style={styles.switchBtnText}>
              {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
  },
  inner: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
  },
  icon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#e0e0f0",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#8080b0",
    marginBottom: 32,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  form: {
    width: "100%",
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#a0a0d0",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#4040a0",
    backgroundColor: "#2a2a4e",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: "#e0e0f0",
  },
  error: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#ff8080",
    marginTop: 14,
    textAlign: "center",
  },
  submitBtn: {
    backgroundColor: "#a0a0ff",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 24,
  },
  submitBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "#1a1a2e",
  },
  switchBtn: {
    marginTop: 16,
    alignItems: "center",
  },
  switchBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#a0a0ff",
  },
});
