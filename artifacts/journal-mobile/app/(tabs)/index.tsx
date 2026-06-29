import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useListEntries } from "@workspace/api-client-react";
import { MobilePinSettings } from "@/components/MobilePinSettings";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function todayString(): string {
  const now = new Date();
  return toDateString(now.getFullYear(), now.getMonth(), now.getDate());
}

export default function CalendarScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const { data: entries, isLoading, isError, refetch } = useListEntries();
  const [showPinSettings, setShowPinSettings] = useState(false);

  const entryDates = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries ?? []) set.add(e.date);
    return set;
  }, [entries]);

  const today = todayString();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: null });
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, dateStr: toDateString(viewYear, viewMonth, d) });
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: null });
    return cells;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function onDayPress(dateStr: string) {
    Haptics.selectionAsync();
    router.push(`/entry/${dateStr}`);
  }

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
          <Feather name="book" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.titleBarText}>My Journal</Text>
        </View>
      </LinearGradient>

      <View style={[styles.window, { backgroundColor: colors.card }]}>
        <View style={styles.windowInner}>
          <View style={styles.monthNav}>
            <Pressable onPress={prevMonth} style={({ pressed }) => [styles.xpBtn, pressed && styles.xpBtnPressed]}>
              <Feather name="chevron-left" size={14} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.monthLabel, { color: colors.foreground }]}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={nextMonth} style={({ pressed }) => [styles.xpBtn, pressed && styles.xpBtnPressed]}>
              <Feather name="chevron-right" size={14} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {DAY_NAMES.map((d) => (
              <View key={d} style={[styles.weekdayCell, { backgroundColor: colors.card }]}>
                <Text style={[styles.weekdayText, { color: colors.mutedForeground }]}>{d}</Text>
              </View>
            ))}
          </View>

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Loading entries...</Text>
            </View>
          ) : isError ? (
            <View style={styles.centered}>
              <Feather name="alert-circle" size={32} color={colors.destructive} />
              <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Could not load entries</Text>
              <Pressable onPress={() => refetch()} style={({ pressed }) => [styles.xpBtn, styles.xpBtnWide, pressed && styles.xpBtnPressed]}>
                <Text style={[styles.xpBtnText, { color: colors.foreground }]}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.calendarGrid}>
              {calendarDays.map((cell, idx) => {
                const isToday = cell.dateStr === today;
                const hasEntry = cell.dateStr ? entryDates.has(cell.dateStr) : false;
                return (
                  <Pressable
                    key={idx}
                    testID={cell.dateStr ? `day-${cell.dateStr}` : undefined}
                    onPress={() => cell.dateStr && onDayPress(cell.dateStr)}
                    style={({ pressed }) => [
                      styles.dayCell,
                      { borderColor: colors.border, backgroundColor: "#FFFFFF" },
                      isToday && styles.dayCellToday,
                      !cell.day && styles.dayCellEmpty,
                      pressed && cell.day ? styles.dayCellPressed : {},
                    ]}
                    disabled={!cell.day}
                  >
                    {cell.day !== null && (
                      <>
                        <Text
                          style={[
                            styles.dayNumber,
                            { color: colors.foreground },
                            isToday && { fontWeight: "700" as const, color: colors.accent },
                          ]}
                        >
                          {cell.day}
                        </Text>
                        {hasEntry && (
                          <View style={[styles.entryDot, { backgroundColor: colors.accent }]} />
                        )}
                      </>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          <View style={[styles.statusBar, { borderTopColor: colors.border }]}>
            <Text style={[styles.statusBarText, { color: colors.mutedForeground }]}>
              {entryDates.size} {entryDates.size === 1 ? "entry" : "entries"} total
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.taskbar, { paddingBottom: Platform.OS === "web" ? 34 : insets.bottom, backgroundColor: "#1F3A9E" }]}>
        <Pressable
          testID="today-btn"
          onPress={() => {
            const n = new Date();
            setViewYear(n.getFullYear());
            setViewMonth(n.getMonth());
          }}
          style={styles.startBtn}
        >
          <Feather name="calendar" size={12} color="#FFFFFF" />
          <Text style={styles.startBtnText}>Today</Text>
        </Pressable>
        <Pressable
          testID="notes-btn"
          onPress={() => {
            Haptics.selectionAsync();
            router.push("/notes");
          }}
          style={styles.notesBtn}
        >
          <Text style={styles.notesBtnIcon}>📌</Text>
        </Pressable>
        <Pressable
          testID="pin-settings-btn"
          onPress={() => {
            Haptics.selectionAsync();
            setShowPinSettings(true);
          }}
          style={styles.notesBtn}
        >
          <Text style={styles.notesBtnIcon}>🔑</Text>
        </Pressable>
        <Pressable
          testID="new-entry-btn"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push(`/entry/${today}`);
          }}
          style={styles.newEntryBtn}
        >
          <Feather name="edit-3" size={14} color="#FFFFFF" />
        </Pressable>
      </View>

      <MobilePinSettings
        visible={showPinSettings}
        onClose={() => setShowPinSettings(false)}
      />
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
  windowInner: {
    flex: 1,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#848280",
    backgroundColor: "#ECE9D8",
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
  },
  xpBtn: {
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
    paddingLeft: 12,
    paddingTop: 5,
    paddingRight: 8,
    paddingBottom: 3,
  },
  xpBtnWide: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  xpBtnText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  weekdayRow: {
    flexDirection: "row",
    backgroundColor: "#ECE9D8",
    borderBottomWidth: 1,
    borderBottomColor: "#848280",
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  calendarGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%` as unknown as number,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
    paddingBottom: 4,
    minHeight: 44,
  },
  dayCellToday: {
    borderWidth: 2,
    borderColor: "#0055EA",
    backgroundColor: "#E3F2FD",
  },
  dayCellEmpty: {
    backgroundColor: "#F5F5F5",
  },
  dayCellPressed: {
    backgroundColor: "#EAF1FF",
    borderColor: "#0055EA",
  },
  dayNumber: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  entryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  statusText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  statusBar: {
    borderTopWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: "#ECE9D8",
  },
  statusBarText: {
    fontSize: 11,
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
  notesBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  notesBtnIcon: {
    fontSize: 16,
  },
  newEntryBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
});
