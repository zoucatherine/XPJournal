import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Vibration,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setPin, verifyPin } from "@workspace/api-client-react";

interface PinLockScreenProps {
  mode: "setup" | "unlock";
  onSuccess: () => void;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
];

export function PinLockScreen({ mode, onSuccess }: PinLockScreenProps) {
  const insets = useSafeAreaInsets();
  const [pin, setPin1] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [phase, setPhase] = useState<"enter" | "confirm">("enter");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
    if (Platform.OS !== "web") {
      Vibration.vibrate(300);
    }
  }, [shakeAnim]);

  const currentPin = phase === "confirm" ? confirmPin : pin;
  const setCurrentPin = phase === "confirm" ? setConfirmPin : setPin1;

  const handleKey = useCallback(
    async (key: string) => {
      if (loading) return;

      if (key === "⌫") {
        setCurrentPin((p) => p.slice(0, -1));
        setError(null);
        return;
      }

      const next = currentPin + key;
      setCurrentPin(next);
      setError(null);

      if (next.length < 4) return;

      if (mode === "setup") {
        if (phase === "enter") {
          setPhase("confirm");
          return;
        }
        if (next !== pin) {
          setError("PINs don't match. Try again.");
          shake();
          setPin1("");
          setConfirmPin("");
          setPhase("enter");
          return;
        }
        setLoading(true);
        try {
          await setPin({ pin });
          onSuccess();
        } catch {
          setError("Failed to save PIN. Try again.");
          shake();
          setPin1("");
          setConfirmPin("");
          setPhase("enter");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(true);
        try {
          const result = await verifyPin({ pin: next });
          if (result.ok) {
            onSuccess();
          } else {
            setError("Incorrect PIN. Try again.");
            shake();
            setPin1("");
          }
        } catch {
          setError("Could not verify. Try again.");
          shake();
          setPin1("");
        } finally {
          setLoading(false);
        }
      }
    },
    [currentPin, pin, phase, mode, loading, onSuccess, shake]
  );

  const displayPin = phase === "confirm" ? confirmPin : pin;

  const title =
    mode === "setup"
      ? phase === "enter"
        ? "Choose a 4-digit PIN"
        : "Confirm your PIN"
      : "Enter PIN";

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
      ]}
    >
      <View style={styles.inner}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.title}>{title}</Text>

        <Animated.View
          style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
        >
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[styles.dot, i < displayPin.length && styles.dotFilled]}
            />
          ))}
        </Animated.View>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <Text style={styles.hint}>
            {mode === "setup" && phase === "confirm"
              ? "Re-enter to confirm"
              : mode === "setup"
              ? "Your journal will be protected by this PIN"
              : "My Journal"}
          </Text>
        )}

        <View style={styles.keypad}>
          {KEYS.map((row, ri) => (
            <View key={ri} style={styles.keyRow}>
              {row.map((key, ki) => (
                <Pressable
                  key={ki}
                  onPress={() => key && handleKey(key)}
                  style={({ pressed }) => [
                    styles.key,
                    !key && styles.keyEmpty,
                    pressed && key && styles.keyPressed,
                  ]}
                  disabled={!key || loading}
                >
                  <Text style={[styles.keyText, !key && styles.keyTextEmpty]}>
                    {key}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a2e",
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    alignItems: "center",
    width: "100%",
    maxWidth: 340,
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: "#e0e0f0",
    marginBottom: 24,
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#6060a0",
    backgroundColor: "transparent",
  },
  dotFilled: {
    backgroundColor: "#a0a0ff",
    borderColor: "#a0a0ff",
  },
  hint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#8080b0",
    marginBottom: 32,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  error: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "#ff8080",
    marginBottom: 32,
    textAlign: "center",
  },
  keypad: {
    width: "100%",
    paddingHorizontal: 24,
    gap: 12,
  },
  keyRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
  },
  key: {
    width: 80,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#2a2a4e",
    borderWidth: 1,
    borderColor: "#4040a0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  keyEmpty: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    shadowOpacity: 0,
    elevation: 0,
  },
  keyPressed: {
    backgroundColor: "#4040a0",
  },
  keyText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 24,
    color: "#e0e0f0",
  },
  keyTextEmpty: {
    color: "transparent",
  },
});
