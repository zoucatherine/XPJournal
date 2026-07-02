import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { changeUsername, changePassword, ApiError } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  username: string | null;
  onClose: () => void;
  onUsernameChanged: (username: string) => void;
}

type Tab = "username" | "password";

function extractError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status !== 500) {
    const data = err.data as { error?: string } | null;
    if (data?.error) return data.error;
  }
  return fallback;
}

export function MobileAccountSettings({ visible, username, onClose, onUsernameChanged }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("username");

  const [newUsername, setNewUsername] = useState(username ?? "");
  const [usernamePassword, setUsernamePassword] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setNewUsername(username ?? "");
    setUsernamePassword("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTab("username");
  }, [username]);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleChangeUsername = async () => {
    const trimmed = newUsername.trim();
    if (trimmed.length < 3) {
      Alert.alert("Invalid Username", "Username must be at least 3 characters.");
      return;
    }
    if (!usernamePassword) {
      Alert.alert("Password Required", "Enter your current password to confirm this change.");
      return;
    }
    setLoading(true);
    try {
      const result = await changeUsername({ currentPassword: usernamePassword, newUsername: trimmed });
      onUsernameChanged(result.username);
      Alert.alert("Success", "Username changed successfully.");
      setUsernamePassword("");
    } catch (err) {
      Alert.alert("Error", extractError(err, "Failed to change username. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert("Invalid Password", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Password Mismatch", "New passwords do not match. Please try again.");
      setNewPassword("");
      setConfirmPassword("");
      return;
    }
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      Alert.alert("Success", "Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      Alert.alert("Error", extractError(err, "Failed to change password. Please try again."));
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
            👤 Account Settings
          </Text>
          <Pressable onPress={handleClose} style={styles.closeBtn}>
            <Text style={[styles.closeBtnText, { color: colors.accent }]}>Done</Text>
          </Pressable>
        </View>

        <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
          <Pressable
            style={[styles.tab, tab === "username" && styles.tabActive]}
            onPress={() => setTab("username")}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === "username" ? colors.accent : colors.mutedForeground },
              ]}
            >
              Username
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === "password" && styles.tabActive]}
            onPress={() => setTab("password")}
          >
            <Text
              style={[
                styles.tabText,
                { color: tab === "password" ? colors.accent : colors.mutedForeground },
              ]}
            >
              Password
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
          {tab === "username" && (
            <>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                New Username
              </Text>
              <TextInput
                style={inputStyle}
                value={newUsername}
                onChangeText={setNewUsername}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={32}
                placeholder="Username"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Current Password (to confirm)
              </Text>
              <TextInput
                style={inputStyle}
                value={usernamePassword}
                onChangeText={setUsernamePassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Current password"
                placeholderTextColor={colors.mutedForeground}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: colors.accent, opacity: pressed || loading ? 0.7 : 1 },
                ]}
                onPress={handleChangeUsername}
                disabled={loading}
              >
                <Text style={styles.btnText}>Save Username</Text>
              </Pressable>
            </>
          )}

          {tab === "password" && (
            <>
              <Text style={[styles.warning, { color: colors.mutedForeground }]}>
                You'll stay signed in on this device. Other devices you're signed in on will stay signed in too.
              </Text>

              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Current Password
              </Text>
              <TextInput
                style={inputStyle}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Current password"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                New Password
              </Text>
              <TextInput
                style={inputStyle}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="New password"
                placeholderTextColor={colors.mutedForeground}
              />

              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Confirm New Password
              </Text>
              <TextInput
                style={inputStyle}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
                placeholder="Confirm new password"
                placeholderTextColor={colors.mutedForeground}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.btn,
                  { backgroundColor: colors.accent, opacity: pressed || loading ? 0.7 : 1 },
                ]}
                onPress={handleChangePassword}
                disabled={loading}
              >
                <Text style={styles.btnText}>Change Password</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
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
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  btn: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 24,
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
});
