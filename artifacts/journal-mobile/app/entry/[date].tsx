import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import {
  getListEntriesQueryKey,
  useCreateEntry,
  useDeleteEntry,
  useGetEntry,
  useUpdateEntry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDate(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${MONTH_NAMES[month]} ${day}, ${year}`;
}

export default function EntryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const initialized = useRef(false);

  const {
    data: entry,
    isLoading,
    isError,
  } = useGetEntry(date ?? "", {
    query: {
      enabled: !!date,
      retry: false,
    },
  });

  const isNew = !isLoading && !entry;

  useEffect(() => {
    if (!initialized.current && !isLoading) {
      if (entry) {
        setTitle(entry.title);
        setBody(entry.body);
      }
      initialized.current = true;
    }
  }, [entry, isLoading]);

  const createMutation = useCreateEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      },
    },
  });

  const updateMutation = useUpdateEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      },
    },
  });

  const deleteMutation = useDeleteEntry({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        router.back();
      },
    },
  });

  function handleSave() {
    if (!date) return;
    if (!title.trim()) {
      Alert.alert("Title required", "Please enter a title for your journal entry.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isNew) {
      createMutation.mutate({ date, title: title.trim(), body: body.trim() });
    } else {
      updateMutation.mutate({ date, data: { title: title.trim(), body: body.trim() } });
    }
  }

  function handleDelete() {
    if (!date || isNew) return;
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this journal entry?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMutation.mutate({ date }),
        },
      ]
    );
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const topInset = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.desktop, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0A246A", "#A6CAF0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.titleBar, { paddingTop: topInset + 4 }]}
      >
        <View style={styles.titleBarInner}>
          <Pressable
            testID="back-btn"
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={8}
          >
            <Feather name="chevron-left" size={16} color="#FFFFFF" />
          </Pressable>
          <Feather name="file-text" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.titleBarText} numberOfLines={1}>
            {date ? formatDate(date) : "Entry"}
          </Text>
          <View style={styles.titleBarControls}>
            {!isNew && !isLoading && (
              <Pressable
                testID="delete-btn"
                onPress={handleDelete}
                style={[styles.xpBtnClose]}
                hitSlop={8}
              >
                {isDeleting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Feather name="x" size={10} color="#FFFFFF" />
                }
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.window, { backgroundColor: colors.card }]}>
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : isError && !isNew ? (
          <View style={styles.centered}>
            <Feather name="alert-circle" size={32} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.mutedForeground }]}>
              Could not load entry
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.formContent}
          >
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Title:</Text>
              <TextInput
                testID="title-input"
                style={[styles.titleInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.input }]}
                value={title}
                onChangeText={(t) => { setTitle(t); setIsDirty(true); }}
                placeholder="Entry title..."
                placeholderTextColor={colors.mutedForeground}
                maxLength={100}
                returnKeyType="next"
                autoFocus={isNew}
              />
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Entry:</Text>
              <TextInput
                testID="body-input"
                style={[
                  styles.bodyInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.input,
                    borderTopColor: colors.border,
                    borderLeftColor: colors.border,
                  },
                ]}
                value={body}
                onChangeText={(t) => { setBody(t); setIsDirty(true); }}
                placeholder="Write your thoughts..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                textAlignVertical="top"
                scrollEnabled={false}
              />
            </View>
          </ScrollView>
        )}
      </View>

      <View
        style={[
          styles.windowFooter,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 8,
          },
        ]}
      >
        <Pressable
          testID="cancel-btn"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.xpBtn, pressed && styles.xpBtnPressed]}
        >
          <Text style={[styles.xpBtnText, { color: colors.foreground }]}>Cancel</Text>
        </Pressable>

        <Pressable
          testID="save-btn"
          onPress={handleSave}
          disabled={isSaving || isLoading}
          style={({ pressed }) => [
            styles.xpBtn,
            styles.xpBtnPrimary,
            pressed && styles.xpBtnPressed,
            (isSaving || isLoading) && styles.xpBtnDisabled,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={[styles.xpBtnText, { color: "#FFFFFF" }]}>
              {isNew ? "Create" : "Save"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktop: {
    flex: 1,
  },
  titleBar: {
    paddingBottom: 5,
    paddingHorizontal: 8,
  },
  titleBarInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    marginRight: 6,
    padding: 2,
  },
  titleBarText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    textShadow: "1px 1px 0px rgba(0,0,0,0.5)",
  },
  titleBarControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  xpBtnClose: {
    width: 21,
    height: 21,
    borderRadius: 3,
    backgroundColor: "#C42611",
    borderWidth: 1,
    borderTopColor: "#F8F7F6",
    borderLeftColor: "#F8F7F6",
    borderBottomColor: "#8B1A0A",
    borderRightColor: "#8B1A0A",
    alignItems: "center",
    justifyContent: "center",
  },
  window: {
    flex: 1,
    marginTop: 8,
    marginHorizontal: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomColor: "#848280",
    borderRightColor: "#848280",
    overflow: "hidden",
  },
  windowFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    marginHorizontal: 12,
    marginBottom: 12,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: 10,
    gap: 10,
    flexGrow: 1,
  },
  fieldGroup: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  titleInput: {
    borderWidth: 2,
    borderTopColor: "#848280",
    borderLeftColor: "#848280",
    borderBottomColor: "#FFFFFF",
    borderRightColor: "#FFFFFF",
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  bodyInput: {
    borderWidth: 2,
    borderTopColor: "#848280",
    borderLeftColor: "#848280",
    borderBottomColor: "#FFFFFF",
    borderRightColor: "#FFFFFF",
    paddingHorizontal: 6,
    paddingVertical: 6,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    minHeight: 240,
    lineHeight: 22,
  },
  xpBtn: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderWidth: 2,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
    borderBottomColor: "#848280",
    borderRightColor: "#848280",
    backgroundColor: "#ECE9D8",
    minWidth: 70,
    alignItems: "center",
  },
  xpBtnPrimary: {
    backgroundColor: "#0A246A",
    borderTopColor: "#5080C0",
    borderLeftColor: "#5080C0",
    borderBottomColor: "#020E36",
    borderRightColor: "#020E36",
  },
  xpBtnPressed: {
    borderTopColor: "#848280",
    borderLeftColor: "#848280",
    borderBottomColor: "#FFFFFF",
    borderRightColor: "#FFFFFF",
  },
  xpBtnDisabled: {
    opacity: 0.5,
  },
  xpBtnText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
