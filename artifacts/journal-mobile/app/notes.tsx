import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  useListNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  type StickyNoteRecord,
} from "@workspace/api-client-react";
import React, { useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const NOTE_COLORS: Record<string, { bg: string; titlebar: string; text: string }> = {
  yellow: { bg: "#FFFCE8", titlebar: "#D4A800", text: "#3A2800" },
  pink:   { bg: "#FFF0F5", titlebar: "#D45C9E", text: "#3A0020" },
  blue:   { bg: "#F0F5FF", titlebar: "#3A6AC8", text: "#001040" },
  green:  { bg: "#F0FFF2", titlebar: "#3A8A40", text: "#002808" },
};

const COLOR_KEYS = ["yellow", "pink", "blue", "green"] as const;
type NoteColor = (typeof COLOR_KEYS)[number];

function resolveColor(color: string): NoteColor {
  return (COLOR_KEYS as readonly string[]).includes(color) ? (color as NoteColor) : "yellow";
}

function NoteCard({
  note,
  onUpdate,
  onDelete,
}: {
  note: StickyNoteRecord;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const color = resolveColor(note.color);
  const palette = NOTE_COLORS[color];
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);

  function handleSave() {
    setEditing(false);
    if (content !== note.content) {
      onUpdate(note.id, content);
    }
  }

  function handleDelete() {
    Alert.alert("Delete note?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(note.id) },
    ]);
  }

  return (
    <View style={[styles.card, { backgroundColor: palette.bg }]}>
      <View style={[styles.cardTitlebar, { backgroundColor: palette.titlebar }]}>
        <Text style={styles.cardTitlebarText}>📌 Sticky Note</Text>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <View style={styles.cardCloseBtn}>
            <Text style={styles.cardCloseBtnText}>✕</Text>
          </View>
        </Pressable>
      </View>
      {editing ? (
        <TextInput
          style={[styles.cardTextInput, { color: palette.text }]}
          value={content}
          onChangeText={setContent}
          multiline
          autoFocus
          placeholder="Type a note…"
          placeholderTextColor={palette.text + "80"}
          onBlur={handleSave}
          returnKeyType="done"
        />
      ) : (
        <Pressable
          style={styles.cardContentArea}
          onPress={() => { Haptics.selectionAsync(); setEditing(true); }}
        >
          {content.trim() ? (
            <Text style={[styles.cardText, { color: palette.text }]}>{content}</Text>
          ) : (
            <Text style={[styles.cardPlaceholder, { color: palette.text + "80" }]}>
              Tap to add a note…
            </Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

export default function NotesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const { data: notes = [], isLoading, isError, refetch } = useListNotes();
  const createMutation = useCreateNote();
  const updateMutation = useUpdateNote();
  const deleteMutation = useDeleteNote();

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  const handleAddNote = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const color = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];
    createMutation.mutate({ id, content: "", color, posX: 200, posY: 200 });
  }, [createMutation]);

  const handleUpdate = useCallback((id: string, content: string) => {
    updateMutation.mutate({ id, input: { content } });
  }, [updateMutation]);

  const handleDelete = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  return (
    <View style={[styles.desktop, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={["#0A246A", "#A6CAF0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.titleBar, { paddingTop: topInset + 4 }]}
      >
        <View style={styles.titleBarInner}>
          <Text style={styles.titleBarIcon}>📌</Text>
          <Text style={styles.titleBarText}>Sticky Notes</Text>
        </View>
      </LinearGradient>

      <View style={[styles.window, { backgroundColor: colors.card }]}>
        <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
          <Text style={[styles.toolbarLabel, { color: colors.mutedForeground }]}>
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.xpBtn, pressed && styles.xpBtnPressed]}
            onPress={handleAddNote}
          >
            <Feather name="plus" size={13} color={colors.foreground} style={{ marginRight: 4 }} />
            <Text style={styles.xpBtnText}>New Note</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : isError ? (
          <View style={styles.centered}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>
              Failed to load notes.
            </Text>
            <Pressable
              style={({ pressed }) => [styles.xpBtn, pressed && styles.xpBtnPressed, { marginTop: 10 }]}
              onPress={() => refetch()}
            >
              <Text style={styles.xpBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : notes.length === 0 ? (
          <View style={styles.centered}>
            <Text style={{ fontSize: 32 }}>📌</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No sticky notes yet</Text>
            <Pressable
              style={({ pressed }) => [styles.xpBtn, styles.xpBtnWide, pressed && styles.xpBtnPressed]}
              onPress={handleAddNote}
            >
              <Text style={styles.xpBtnText}>Create your first note</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={notes}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <NoteCard
                note={item}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            )}
          />
        )}
      </View>

      <View style={[styles.taskbar, { backgroundColor: colors.primary, paddingBottom: insets.bottom }]}>
        <Pressable
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          style={styles.startBtn}
        >
          <Text style={styles.startBtnText}>⬅ Back</Text>
        </Pressable>
        <Pressable
          onPress={handleAddNote}
          style={styles.newEntryBtn}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
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
  titleBarIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  titleBarText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  window: {
    flex: 1,
    margin: 12,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
    borderBottomColor: "#848280",
    borderRightColor: "#848280",
    overflow: "hidden",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    backgroundColor: "#ECE9D8",
  },
  toolbarLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  list: {
    padding: 10,
    gap: 10,
  },
  card: {
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
    borderBottomColor: "#848280",
    borderRightColor: "#848280",
    overflow: "hidden",
    minHeight: 120,
  },
  cardTitlebar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  cardTitlebarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textShadowColor: "rgba(0,0,0,0.4)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
  },
  cardCloseBtn: {
    width: 18,
    height: 18,
    backgroundColor: "#C42611",
    alignItems: "center",
    justifyContent: "center",
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: "rgba(255,255,255,0.5)",
    borderLeftColor: "rgba(255,255,255,0.5)",
  },
  cardCloseBtnText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700" as const,
    lineHeight: 14,
  },
  cardContentArea: {
    flex: 1,
    padding: 10,
    minHeight: 80,
  },
  cardText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  cardPlaceholder: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  cardTextInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    padding: 10,
    minHeight: 80,
    textAlignVertical: "top",
    lineHeight: 20,
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
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  taskbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingHorizontal: 8,
    height: Platform.OS === "web" ? 88 : 54,
    borderTopWidth: 2,
    borderTopColor: "#A6CAF0",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#3C8B3C",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: "rgba(255,255,255,0.4)",
    borderLeftColor: "rgba(255,255,255,0.4)",
  },
  startBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700" as const,
    fontStyle: "italic",
    fontFamily: "Inter_700Bold",
  },
  newEntryBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  xpBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderTopColor: "#FFFFFF",
    borderLeftColor: "#FFFFFF",
    borderBottomColor: "#848280",
    borderRightColor: "#848280",
    backgroundColor: "#ECE9D8",
  },
  xpBtnPressed: {
    borderTopColor: "#848280",
    borderLeftColor: "#848280",
    borderBottomColor: "#FFFFFF",
    borderRightColor: "#FFFFFF",
  },
  xpBtnWide: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  xpBtnText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
});
