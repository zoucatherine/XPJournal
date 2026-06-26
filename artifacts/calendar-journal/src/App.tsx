import React, { useState, useEffect, useRef, useCallback } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek
} from "date-fns";
import {
  useListEntries,
  useGetEntry,
  useCreateEntry,
  useUpdateEntry,
  useDeleteEntry,
  useSearchEntries,
  getListEntriesQueryKey,
  getGetEntryQueryKey
} from "@workspace/api-client-react";
import { useTheme, THEMES, type ThemeId } from "./useTheme";
import { useWallpaper, WallpaperProvider, WALLPAPERS } from "./useWallpaper";

const queryClient = new QueryClient();

interface DragPos { x: number; y: number }

function useDraggable(storageKey?: string) {
  const windowRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef<DragPos>({ x: 0, y: 0 });

  const getStoredPos = (): DragPos | null => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as DragPos;
    } catch {}
    return null;
  };

  const [pos, setPos] = useState<DragPos | null>(getStoredPos);

  const onTitlebarMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".xp-btn-control") || target.closest(".xp-theme-dropdown") || target.tagName === "BUTTON") return;
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !windowRef.current) return;
      const el = windowRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const x = Math.max(0, Math.min(e.clientX - dragOffset.current.x, vw - el.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - dragOffset.current.y, vh - el.offsetHeight - 32));
      const newPos = { x, y };
      setPos(newPos);
      if (storageKey) {
        try { localStorage.setItem(storageKey, JSON.stringify(newPos)); } catch {}
      }
    };
    const onMouseUp = () => { isDragging.current = false; };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [storageKey]);

  const windowStyle: React.CSSProperties = pos
    ? { position: "absolute", left: pos.x, top: pos.y }
    : { position: "absolute", top: "5%", left: "50%", transform: "translateX(-50%)" };

  return { pos, windowRef, windowStyle, onTitlebarMouseDown };
}

function useDraggableFixed(initialCenter = true) {
  const windowRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef<DragPos>({ x: 0, y: 0 });
  const [pos, setPos] = useState<DragPos | null>(null);

  const onTitlebarMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".xp-btn-control") || target.tagName === "BUTTON") return;
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !windowRef.current) return;
      const el = windowRef.current;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const x = Math.max(0, Math.min(e.clientX - dragOffset.current.x, vw - el.offsetWidth));
      const y = Math.max(0, Math.min(e.clientY - dragOffset.current.y, vh - el.offsetHeight - 32));
      setPos({ x, y });
    };
    const onMouseUp = () => { isDragging.current = false; };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const windowStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y }
    : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return { windowRef, windowStyle, onTitlebarMouseDown };
}

function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        title="Change theme"
        onClick={() => setOpen(v => !v)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 6px",
          fontSize: "15px",
          color: "white",
          display: "flex",
          alignItems: "center",
          height: "21px",
          opacity: 0.9,
        }}
      >
        🎨
      </button>
      {open && (
        <div className="xp-theme-dropdown">
          {THEMES.map(t => (
            <div
              key={t.id}
              className={`xp-theme-option${theme === t.id ? " selected" : ""}`}
              onClick={() => { setTheme(t.id as ThemeId); setOpen(false); }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  background: t.preview,
                  border: "1px solid #888",
                  flexShrink: 0,
                }}
              />
              {t.label}
              {theme === t.id && " ✓"}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WallpaperPicker() {
  const { wallpaperId, customImage, setWallpaper, setCustomImage, clearCustomImage } = useWallpaper();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert("Please choose an image under 3MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCustomImage(dataUrl);
      setOpen(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        title="Change wallpaper"
        onClick={() => setOpen(v => !v)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 6px",
          fontSize: "15px",
          color: "white",
          display: "flex",
          alignItems: "center",
          height: "21px",
          opacity: 0.9,
        }}
      >
        🖼️
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 2px)",
            right: 0,
            background: "var(--xp-window-bg)",
            border: "2px outset var(--xp-border-light)",
            borderRightColor: "var(--xp-border-dark)",
            borderBottomColor: "var(--xp-border-dark)",
            zIndex: 200,
            minWidth: 190,
            boxShadow: "2px 2px 6px rgba(0,0,0,0.4)",
            padding: "4px 0",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "Tahoma, sans-serif",
              color: "var(--xp-window-text)",
              padding: "2px 10px 6px",
              opacity: 0.6,
              borderBottom: "1px solid var(--xp-separator)",
              marginBottom: 4,
            }}
          >
            Desktop Wallpaper
          </div>
          {WALLPAPERS.filter(w => w.id !== "custom").map(w => (
            <div
              key={w.id}
              onClick={() => { setWallpaper(w.id); setOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 10px",
                cursor: "pointer",
                fontSize: 12,
                color: "var(--xp-window-text)",
                fontFamily: "Tahoma, sans-serif",
                whiteSpace: "nowrap",
                background: wallpaperId === w.id ? "var(--xp-accent)" : "transparent",
                color: wallpaperId === w.id ? "white" : "var(--xp-window-text)",
              } as React.CSSProperties}
              onMouseEnter={e => {
                if (wallpaperId !== w.id) {
                  (e.currentTarget as HTMLDivElement).style.background = "var(--xp-calendar-hover)";
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background =
                  wallpaperId === w.id ? "var(--xp-accent)" : "transparent";
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 20,
                  height: 14,
                  background: w.preview,
                  border: "1px solid #888",
                  flexShrink: 0,
                }}
              />
              {w.label}
              {wallpaperId === w.id && " ✓"}
            </div>
          ))}
          <div
            style={{
              borderTop: "1px solid var(--xp-separator)",
              marginTop: 4,
              paddingTop: 4,
            }}
          >
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 10px",
                cursor: "pointer",
                fontSize: 12,
                color: "var(--xp-window-text)",
                fontFamily: "Tahoma, sans-serif",
                whiteSpace: "nowrap",
                background: wallpaperId === "custom" && customImage ? "var(--xp-accent)" : "transparent",
                color: wallpaperId === "custom" && customImage ? "white" : "var(--xp-window-text)",
              } as React.CSSProperties}
              onMouseEnter={e => {
                if (!(wallpaperId === "custom" && customImage)) {
                  (e.currentTarget as HTMLDivElement).style.background = "var(--xp-calendar-hover)";
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background =
                  wallpaperId === "custom" && customImage ? "var(--xp-accent)" : "transparent";
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>📁</span>
              Browse…{wallpaperId === "custom" && customImage ? " ✓" : ""}
            </div>
            {wallpaperId === "custom" && customImage && (
              <div
                onClick={() => { clearCustomImage(); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--xp-window-text)",
                  fontFamily: "Tahoma, sans-serif",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLDivElement).style.background = "var(--xp-calendar-hover)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>✕</span>
                Remove Custom Image
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
        </div>
      )}
    </div>
  );
}

function SearchWindow({
  onClose,
  onSelectDate,
}: {
  onClose: () => void;
  onSelectDate: (date: Date) => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const { windowRef, windowStyle, onTitlebarMouseDown } = useDraggableFixed();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results, isFetching } = useSearchEntries(
    { q: debouncedQuery },
    { query: { enabled: debouncedQuery.length > 0 } }
  );

  const getSnippet = (body: string, q: string) => {
    const idx = body.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return body.slice(0, 80);
    const start = Math.max(0, idx - 30);
    const end = Math.min(body.length, idx + q.length + 50);
    return (start > 0 ? "…" : "") + body.slice(start, end) + (end < body.length ? "…" : "");
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div
        ref={windowRef}
        className="w-full max-w-[520px] xp-window shadow-2xl z-50"
        style={windowStyle}
      >
        <div
          className="xp-titlebar"
          onMouseDown={onTitlebarMouseDown}
          style={{ cursor: "default", userSelect: "none" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-4 h-4 inline-block border opacity-80"
              style={{
                backgroundColor: "var(--xp-border-light)",
                borderColor: "var(--xp-accent-dark)",
              }}
            />
            Search Journal
          </div>
          <div className="xp-titlebar-controls">
            <div className="xp-btn-control xp-btn-close" onClick={onClose} />
          </div>
        </div>

        <div className="xp-body flex flex-col gap-3" style={{ minHeight: 220 }}>
          <div className="flex gap-2 items-center">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="xp-inset xp-input flex-1"
              placeholder="Type to search entries…"
            />
            {isFetching && (
              <span className="text-xs font-sans" style={{ color: "var(--xp-window-text)", opacity: 0.6 }}>
                …
              </span>
            )}
          </div>

          <div
            className="xp-inset flex-1 overflow-y-auto"
            style={{ minHeight: 140, maxHeight: 340 }}
          >
            {!debouncedQuery && (
              <div className="p-4 text-center text-sm font-sans" style={{ color: "var(--xp-window-text)", opacity: 0.6 }}>
                Enter a keyword to search your entries
              </div>
            )}
            {debouncedQuery && results && results.length === 0 && !isFetching && (
              <div className="p-4 text-center text-sm font-sans" style={{ color: "var(--xp-window-text)", opacity: 0.6 }}>
                No entries found for "{debouncedQuery}"
              </div>
            )}
            {results && results.length > 0 && (
              <div>
                {results.map((entry) => (
                  <div
                    key={entry.date}
                    onClick={() => {
                      const [year, month, day] = entry.date.split("-").map(Number);
                      onSelectDate(new Date(year, month - 1, day));
                      onClose();
                    }}
                    style={{
                      borderBottom: "1px solid var(--xp-separator)",
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                    className="search-result-row"
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-xs font-sans font-bold"
                        style={{ color: "var(--xp-text-accent)", whiteSpace: "nowrap" }}
                      >
                        {entry.date}
                      </span>
                      <span
                        className="text-sm font-sans font-bold truncate"
                        style={{ color: "var(--xp-window-text)" }}
                      >
                        {entry.title || "(untitled)"}
                      </span>
                    </div>
                    {entry.body && (
                      <div
                        className="text-xs font-sans mt-1"
                        style={{ color: "var(--xp-window-text)", opacity: 0.75, lineHeight: 1.4 }}
                      >
                        {getSnippet(entry.body, debouncedQuery)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button className="xp-button min-w-[80px]" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Desktop() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [showSearch, setShowSearch] = useState(false);

  const { windowRef, windowStyle, onTitlebarMouseDown } = useDraggable("journal-main-window-pos");
  const { getDesktopStyle } = useWallpaper();

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: entries } = useListEntries();

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const dateFormat = "yyyy-MM-dd";
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const hasEntry = (date: Date) => {
    if (!entries) return false;
    return entries.some(e => e.date === format(date, dateFormat));
  };

  const getEntryPreview = (date: Date) => {
    if (!entries) return null;
    const entry = entries.find(e => e.date === format(date, dateFormat));
    return entry ? entry.title || "Entry" : null;
  };

  const getEntryMood = (date: Date) => {
    if (!entries) return null;
    const entry = entries.find(e => e.date === format(date, dateFormat));
    return entry?.mood ?? null;
  };

  const desktopStyle = getDesktopStyle();

  return (
    <div className="min-h-screen w-full relative pb-[30px] overflow-hidden" style={desktopStyle as React.CSSProperties}>
      {/* Main Calendar Window */}
      <div
        ref={windowRef}
        className="w-full max-w-[800px] xp-window shadow-xl"
        style={windowStyle}
      >
        <div
          className="xp-titlebar"
          onMouseDown={onTitlebarMouseDown}
          style={{ cursor: "default", userSelect: "none" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-4 h-4 inline-block border border-white opacity-50"
              style={{ backgroundColor: "var(--xp-titlebar-from)" }}
            />
            My Journal
          </div>
          <div className="xp-titlebar-controls">
            <button
              title="Search entries"
              onClick={() => setShowSearch(true)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0 6px",
                fontSize: "14px",
                color: "white",
                display: "flex",
                alignItems: "center",
                height: "21px",
                opacity: 0.9,
              }}
            >
              🔍
            </button>
            <WallpaperPicker />
            <ThemePicker />
            <div className="xp-btn-control xp-btn-min" />
            <div className="xp-btn-control xp-btn-max" />
            <div className="xp-btn-control xp-btn-close" />
          </div>
        </div>

        <div className="xp-body">
          <div className="flex justify-between items-center mb-4">
            <button className="xp-button" onClick={prevMonth}>&lt; Prev</button>
            <h2 className="text-xl font-bold font-sans" style={{ color: "var(--xp-window-text)" }}>
              {format(currentDate, "MMMM yyyy")}
            </h2>
            <button className="xp-button" onClick={nextMonth}>Next &gt;</button>
          </div>

          <div
            className="grid grid-cols-7 gap-[2px] p-[2px]"
            style={{
              backgroundColor: "var(--xp-grid-bg)",
              border: `2px solid var(--xp-border-dark)`,
              borderLeftColor: "var(--xp-border-dark)",
              borderTopColor: "var(--xp-border-dark)",
              borderRightColor: "var(--xp-border-light)",
              borderBottomColor: "var(--xp-border-light)",
            }}
          >
            {weekDays.map(day => (
              <div
                key={day}
                className="text-center font-bold text-sm py-1"
                style={{
                  backgroundColor: "var(--xp-weekday-bg)",
                  color: "var(--xp-window-text)",
                  border: `1px solid var(--xp-border-light)`,
                  borderRightColor: "var(--xp-border-dark)",
                  borderBottomColor: "var(--xp-border-dark)",
                }}
              >
                {day}
              </div>
            ))}

            {days.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, monthStart);
              const isDayToday = isToday(day);
              const entryExists = hasEntry(day);
              const mood = getEntryMood(day);

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    xp-calendar-day h-24 p-1 flex flex-col
                    ${!isCurrentMonth ? "other-month" : ""}
                    ${isDayToday ? "today" : ""}
                  `}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-sm">{format(day, "d")}</span>
                    {entryExists && !mood && (
                      <div
                        className="w-3 h-3 shadow-sm mt-1 mr-1"
                        style={{
                          backgroundColor: "var(--xp-accent)",
                          border: `1px solid var(--xp-accent-dark)`,
                        }}
                        title="Entry exists"
                      />
                    )}
                    {mood && (
                      <span className="text-base leading-none mt-0.5 mr-0.5" title={`Mood: ${mood}`}>
                        {mood}
                      </span>
                    )}
                  </div>
                  {entryExists && (
                    <div
                      className="mt-1 text-xs truncate px-1"
                      style={{ color: "var(--xp-text-accent)" }}
                    >
                      {getEntryPreview(day)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Search Window */}
      {showSearch && (
        <SearchWindow
          onClose={() => setShowSearch(false)}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setCurrentDate(date);
          }}
        />
      )}

      {/* Entry Editor Modal Window */}
      {selectedDate && (
        <EntryEditor
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}

      {/* Taskbar */}
      <div className="xp-taskbar">
        <div className="flex h-full">
          <div className="xp-start-btn">
            <span className="text-lg italic tracking-tighter">start</span>
          </div>
          <div className="xp-tray">
            <div className="xp-tray-item active">
              My Journal
            </div>
          </div>
        </div>
        <div className="xp-clock-area">
          {format(now, "h:mm a")}
        </div>
      </div>
    </div>
  );
}

function EntryEditor({ date, onClose }: { date: Date; onClose: () => void }) {
  const dateStr = format(date, "yyyy-MM-dd");
  const { windowRef, windowStyle, onTitlebarMouseDown } = useDraggableFixed();

  const { data: entry, isLoading } = useGetEntry(dateStr, {
    query: {
      enabled: !!dateStr,
      queryKey: getGetEntryQueryKey(dateStr)
    }
  });

  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const deleteEntry = useDeleteEntry();

  const MOODS = ["😊", "😄", "😍", "😎", "🥳", "😌", "😐", "😔", "😢", "😠", "😴", "🤒", "🎉", "💪", "🙏"];

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const initRef = useRef<string | null>(null);

  useEffect(() => {
    if (entry && initRef.current !== dateStr) {
      setTitle(entry.title);
      setBody(entry.body);
      setMood(entry.mood ?? null);
      initRef.current = dateStr;
    } else if (!entry && !isLoading && initRef.current !== dateStr) {
      setTitle("");
      setBody("");
      setMood(null);
      initRef.current = dateStr;
    }
  }, [entry, isLoading, dateStr]);

  const handleSave = () => {
    setSaveStatus("Saving...");
    if (entry) {
      updateEntry.mutate(
        { date: dateStr, data: { title, body, mood } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(dateStr) });
            setSaveStatus("Saved!");
            setTimeout(() => setSaveStatus(null), 2000);
          }
        }
      );
    } else {
      createEntry.mutate(
        { data: { date: dateStr, title, body, mood } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(dateStr) });
            setSaveStatus("Saved!");
            setTimeout(() => setSaveStatus(null), 2000);
          }
        }
      );
    }
  };

  const handleDelete = () => {
    if (!entry) return;
    if (window.confirm("Delete this entry?")) {
      deleteEntry.mutate(
        { date: dateStr },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListEntriesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetEntryQueryKey(dateStr) });
            onClose();
          }
        }
      );
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* Window */}
      <div
        ref={windowRef}
        className="w-full max-w-[600px] xp-window shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200"
        style={windowStyle}
      >
        <div
          className="xp-titlebar"
          onMouseDown={onTitlebarMouseDown}
          style={{ cursor: "default", userSelect: "none" }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-4 h-4 inline-block border opacity-80"
              style={{
                backgroundColor: "var(--xp-border-light)",
                borderColor: "var(--xp-accent-dark)",
              }}
            />
            Journal &mdash; {format(date, "MMMM d, yyyy")}
          </div>
          <div className="xp-titlebar-controls">
            <div className="xp-btn-control xp-btn-min" />
            <div className="xp-btn-control xp-btn-max" />
            <div className="xp-btn-control xp-btn-close" onClick={onClose} />
          </div>
        </div>

        <div className="xp-body">
          {isLoading ? (
            <div className="p-8 text-center text-sm font-sans">Loading...</div>
          ) : (
            <div className="flex flex-col gap-4 h-[490px]">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-sans" style={{ color: "var(--xp-window-text)" }}>Title:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="xp-inset xp-input w-full"
                  placeholder="Untitled Entry"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-sans" style={{ color: "var(--xp-window-text)" }}>
                  Mood: {mood ? <span className="ml-1">{mood}</span> : <span className="ml-1 opacity-50">none</span>}
                </label>
                <div
                  className="xp-inset flex flex-wrap gap-1 p-1"
                  style={{ minHeight: "36px" }}
                >
                  {MOODS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setMood(mood === emoji ? null : emoji)}
                      title={emoji}
                      style={{
                        fontSize: "18px",
                        lineHeight: 1,
                        padding: "2px 4px",
                        cursor: "pointer",
                        background: mood === emoji ? "var(--xp-accent)" : "transparent",
                        border: mood === emoji ? "2px solid var(--xp-accent-dark)" : "2px solid transparent",
                        borderRadius: "3px",
                        opacity: mood && mood !== emoji ? 0.5 : 1,
                        transition: "opacity 0.1s, border-color 0.1s",
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1 flex-1 min-h-0">
                <label className="text-sm font-sans" style={{ color: "var(--xp-window-text)" }}>Entry:</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="xp-inset xp-textarea w-full flex-1"
                  placeholder="Dear diary..."
                />
              </div>

              <div
                className="flex justify-between items-center mt-2 pt-3"
                style={{
                  borderTop: `1px solid var(--xp-separator)`,
                  boxShadow: `0 -1px 0 0 var(--xp-separator-light)`,
                }}
              >
                <div className="flex gap-2">
                  <button className="xp-button font-bold min-w-[80px]" onClick={handleSave}>
                    Save
                  </button>
                  {entry && (
                    <button className="xp-button min-w-[80px]" onClick={handleDelete}>
                      Delete
                    </button>
                  )}
                </div>
                <div className="text-sm font-sans flex items-center gap-4">
                  {saveStatus && (
                    <span style={{ color: "var(--xp-text-accent)" }}>{saveStatus}</span>
                  )}
                  <button className="xp-button min-w-[80px]" onClick={onClose}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function AppInner() {
  useTheme();
  return (
    <WallpaperProvider>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Switch>
          <Route path="/" component={Desktop} />
        </Switch>
      </WouterRouter>
    </WallpaperProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}

export default App;
