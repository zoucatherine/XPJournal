import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setPin, verifyPin, removePin } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
}

type Tab = "change" | "remove";

export function MobilePinSettings({ visible, onClose, onLogout }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("change");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [removePin2, setRemovePin2] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setRemovePin2("");
    setTab("change");
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleChangePin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      Alert.alert("Invalid PIN", "New PIN must be exactly 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert("PIN Mismatch", "New PINs do not match. Please try again.");
      setNewPin("");
      setConfirmPin("");
      return;
    }
    setLoading(true);
    try {
      const verify = await verifyPin({ pin: currentPin });
      if (!verify.ok) {
        Alert.alert("Incorrect PIN", "Current PIN is incorrect.");
        setCurrentPin("");
        return;
      }
      await setPin({ pin: newPin });
      Alert.alert("Success", "PIN changed successfully.", [
        { text: "OK", onPress: handleClose },
      ]);
    } catch {
      Alert.alert("Error", "Failed to change PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePin = async () => {
    setLoading(true);
    try {
      const verify = await verifyPin({ pin: removePin2 });
      if (!verify.ok) {
        Alert.alert("Incorrect PIN", "PIN is incorrect.");
        setRemovePin2("");
        return;
      }
      await removePin();
      Alert.alert("PIN Removed", "Your journal lock has been removed.", [
        { text: "OK", onPress: handleClose },
      ]);
    } catch {
      Alert.alert("Error", "Failed to remove PIN. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = [
    styles.input,
    { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top + 16 },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            🔑 Lock Settings
          </Text>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: colors.accent }]}>Done</Text>
          </Pressable>
        </View>

        <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
          <Pressable
            style={[styles.tab, tab === "change" && styles.tabActive]}
            onPress={() => setTab("change")}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === "change" ? colors.accent : colors.mutedForeground },
              ]}
            >
              Change PIN
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "remove" && styles.tabActive]}
            onPress={() => setTab("remove")}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === "remove" ? "#e74c3c" : colors.mutedForeground },
              ]}
            >
              Remove PIN
            </Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {tab === "change" && (
            <>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Current PIN
              </Text>
              <TextInput
                style={inputStyle}
                value={currentPin}
                onChangeText={(v) => setCurrentPin(v.replace(/\D/g, "").slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="••••"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                New PIN
              </Text>
              <TextInput
                style={inputStyle}
                value={newPin}
                onChangeText={(v) => setNewPin(v.replace(/\D/g, "").slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="••••"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Confirm New PIN
              </Text>
              <TextInput
                style={inputStyle}
                value={confirmPin}
                onChangeText={(v) => setConfirmPin(v.replace(/\D/g, "").slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="••••"
                placeholderTextColor={colors.mutedForeground}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: colors.accent, opacity: pressed || loading ? 0.7 : 1 },
                ]}
                onPress={handleChangePin}
                disabled={loading}
              >
                <Text style={styles.btnText}>Change PIN</Text>
              </Pressable>
            </>
          )}

          {tab === "remove" && (
            <>
              <Text style={[styles.warning, { color: colors.mutedForeground }]}>
                Enter your current PIN to remove the lock from your journal.
              </Text>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Current PIN
              </Text>
              <TextInput
                style={inputStyle}
                value={removePin2}
                onChangeText={(v) => setRemovePin2(v.replace(/\D/g, "").slice(0, 4))}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                placeholder="••••"
                placeholderTextColor={colors.mutedForeground}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: "#e74c3c", opacity: pressed || loading ? 0.7 : 1 },
                ]}
                onPress={handleRemovePin}
                disabled={loading}
              >
                <Text style={styles.btnText}>Remove PIN Lock</Text>
              </Pressable>
            </>
          )}
        </View>

        <View style={[styles.logoutSection, { borderTopColor: colors.border }]}>
          <Pressable
            style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
            onPress={() => {
              Alert.alert("Log Out", "Are you sure you want to log out?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Log Out",
                  style: "destructive",
                  onPress: () => {
                    handleClose();
                    onLogout();
                  },
                },
              ]);
            }}
          >
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  tabRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  body: {
    flex: 1,
    padding: 20,
    paddingTop: 24,
  },
  label: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    fontFamily: "Inter_400Regular",
    letterSpacing: 8,
  },
  btn: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 24,
  },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "white",
  },
  warning: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  logoutSection: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  logoutBtn: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    backgroundColor: "#e74c3c",
  },
  logoutBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: "white",
  },
});
