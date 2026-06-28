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
  getGetEntryQueryKey,
  ApiError
} from "@workspace/api-client-react";
import { useTheme, THEMES, type ThemeId } from "./useTheme";
import { useWallpaper, WallpaperProvider, WALLPAPERS } from "./useWallpaper";

const queryClient = new QueryClient();

interface DragPos { x: number; y: number }

type StickyColor = "yellow" | "pink" | "blue" | "green";

interface StickySize { w: number; h: number }

interface StickyNoteData {
  id: string;
  content: string;
  position: DragPos;
  color: StickyColor;
  size?: StickySize;
}

const STICKY_DEFAULT_W = 220;
const STICKY_DEFAULT_H = 140;
const STICKY_MIN_W = 150;
const STICKY_MIN_H = 90;
const STICKY_MAX_W = 520;
const STICKY_MAX_H = 420;

const STICKY_COLORS: Record<StickyColor, { bg: string; titlebar: string; border: string; text: string }> = {
  yellow: { bg: "#FFFCE8", titlebar: "#D4A800", border: "#C8980000", text: "#3A2800" },
  pink:   { bg: "#FFF0F5", titlebar: "#D45C9E", border: "#C0408800", text: "#3A0020" },
  blue:   { bg: "#F0F5FF", titlebar: "#3A6AC8", border: "#2A54A800", text: "#001040" },
  green:  { bg: "#F0FFF2", titlebar: "#3A8A40", border: "#2A7030", text: "#002808" },
};

const STICKY_STORAGE_KEY = "journal-sticky-notes";

function loadStickyNotes(): StickyNoteData[] {
  try {
    const raw = localStorage.getItem(STICKY_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StickyNoteData[];
  } catch {}
  return [];
}

function saveStickyNotes(notes: StickyNoteData[]) {
  try { localStorage.setItem(STICKY_STORAGE_KEY, JSON.stringify(notes)); } catch {}
}

function useStickyNotes() {
  const [notes, setNotes] = useState<StickyNoteData[]>(loadStickyNotes);

  const addNote = useCallback(() => {
    const id = `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const offset = Math.floor(Math.random() * 80) - 40;
    const colors: StickyColor[] = ["yellow", "pink", "blue", "green"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const newNote: StickyNoteData = {
      id,
      content: "",
      position: {
        x: Math.max(40, window.innerWidth / 2 - 110 + offset),
        y: Math.max(40, window.innerHeight / 2 - 120 + offset),
      },
      color,
    };
    setNotes(prev => {
      const next = [...prev, newNote];
      saveStickyNotes(next);
      return next;
    });
  }, []);

  const updateContent = useCallback((id: string, content: string) => {
    setNotes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, content } : n);
      saveStickyNotes(next);
      return next;
    });
  }, []);

  const updatePosition = useCallback((id: string, position: DragPos) => {
    setNotes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, position } : n);
      saveStickyNotes(next);
      return next;
    });
  }, []);

  const updateColor = useCallback((id: string, color: StickyColor) => {
    setNotes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, color } : n);
      saveStickyNotes(next);
      return next;
    });
  }, []);

  const updateSize = useCallback((id: string, size: StickySize) => {
    setNotes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, size } : n);
      saveStickyNotes(next);
      return next;
    });
  }, []);

  const removeNote = useCallback((id: string) => {
    setNotes(prev => {
      const next = prev.filter(n => n.id !== id);
      saveStickyNotes(next);
      return next;
    });
  }, []);

  return { notes, addNote, updateContent, updatePosition, updateColor, updateSize, removeNote };
}

const SNAP_THRESHOLD = 30;
const SNAP_TRANSITION = "left 0.12s ease, top 0.12s ease";

function applySnap(x: number, y: number, elWidth: number, elHeight: number, vw: number, vh: number, taskbarH = 32): DragPos {
  let sx = x;
  let sy = y;
  if (x <= SNAP_THRESHOLD) sx = 0;
  if (x + elWidth >= vw - SNAP_THRESHOLD) sx = vw - elWidth;
  if (y <= SNAP_THRESHOLD) sy = 0;
  if (y + elHeight >= vh - taskbarH - SNAP_THRESHOLD) sy = vh - elHeight - taskbarH;
  return { x: sx, y: sy };
}

function useDraggable(storageKey?: string) {
  const windowRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef<DragPos>({ x: 0, y: 0 });
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getStoredPos = (): DragPos | null => {
    if (!storageKey) return null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as DragPos;
    } catch {}
    return null;
  };

  const [pos, setPos] = useState<DragPos | null>(getStoredPos);
  const [isSnapping, setIsSnapping] = useState(false);

  const onTitlebarMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".xp-btn-control") || target.closest(".xp-theme-dropdown") || target.tagName === "BUTTON") return;
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsSnapping(false);
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
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
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const el = windowRef.current;
      if (!el) return;
      setPos(prev => {
        if (!prev) return prev;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const snapped = applySnap(prev.x, prev.y, el.offsetWidth, el.offsetHeight, vw, vh);
        const didSnap = snapped.x !== prev.x || snapped.y !== prev.y;
        if (didSnap) {
          setIsSnapping(true);
          if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
          snapTimerRef.current = setTimeout(() => setIsSnapping(false), 200);
          if (storageKey) {
            try { localStorage.setItem(storageKey, JSON.stringify(snapped)); } catch {}
          }
          return snapped;
        }
        return prev;
      });
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [storageKey]);

  const windowStyle: React.CSSProperties = pos
    ? { position: "absolute", left: pos.x, top: pos.y, ...(isSnapping ? { transition: SNAP_TRANSITION } : {}) }
    : { position: "absolute", top: "5%", left: "50%", transform: "translateX(-50%)" };

  return { pos, windowRef, windowStyle, onTitlebarMouseDown };
}

function useDraggableFixed(initialCenter = true) {
  const windowRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef<DragPos>({ x: 0, y: 0 });
  const [pos, setPos] = useState<DragPos | null>(null);
  const [isSnapping, setIsSnapping] = useState(false);
  const snapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTitlebarMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".xp-btn-control") || target.tagName === "BUTTON") return;
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setIsSnapping(false);
    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
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
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      const el = windowRef.current;
      if (!el) return;
      setPos(prev => {
        if (!prev) return prev;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const snapped = applySnap(prev.x, prev.y, el.offsetWidth, el.offsetHeight, vw, vh);
        const didSnap = snapped.x !== prev.x || snapped.y !== prev.y;
        if (didSnap) {
          setIsSnapping(true);
          if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
          snapTimerRef.current = setTimeout(() => setIsSnapping(false), 200);
          return snapped;
        }
        return prev;
      });
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const windowStyle: React.CSSProperties = pos
    ? { position: "fixed", left: pos.x, top: pos.y, ...(isSnapping ? { transition: SNAP_TRANSITION } : {}) }
    : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return { windowRef, windowStyle, onTitlebarMouseDown };
}

function MenuRow({
  icon,
  label,
  hasArrow,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  hasArrow?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const highlight = active || hovered;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "7px 14px",
        cursor: "pointer",
        borderBottom: "1px solid var(--xp-separator)",
        background: highlight ? "var(--xp-accent)" : "transparent",
        color: highlight ? "white" : "var(--xp-window-text)",
        userSelect: "none",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, fontFamily: "Tahoma, sans-serif" }}>{label}</span>
      {hasArrow && (
        <span style={{ fontSize: 9, opacity: 0.75 }}>{active ? "▼" : "▶"}</span>
      )}
    </div>
  );
}

function StartMenu({
  onClose,
  onOpenSearch,
  onNewNote,
}: {
  onClose: () => void;
  onOpenSearch: () => void;
  onNewNote: () => void;
}) {
  const { theme, setTheme } = useTheme();
  const { wallpaperId, customImage, setWallpaper, setCustomImage, clearCustomImage } = useWallpaper();
  const [expanded, setExpanded] = useState<"theme" | "wallpaper" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert("Please choose an image under 3MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomImage(ev.target?.result as string);
      onClose();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const toggle = (panel: "theme" | "wallpaper") =>
    setExpanded(prev => (prev === panel ? null : panel));

  const subRowStyle = (selected: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 14px 5px 42px",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "Tahoma, sans-serif",
    background: selected ? "var(--xp-accent)" : "transparent",
    color: selected ? "white" : "var(--xp-window-text)",
    userSelect: "none",
  });

  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        bottom: 30,
        left: 0,
        width: 260,
        background: "var(--xp-window-bg)",
        border: "2px outset var(--xp-border-light)",
        borderRightColor: "var(--xp-border-dark)",
        borderBottomColor: "var(--xp-border-dark)",
        boxShadow: "3px -3px 10px rgba(0,0,0,0.5)",
        zIndex: 2000,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "linear-gradient(to right, var(--xp-titlebar-from) 0%, var(--xp-titlebar-to) 100%)",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "2px solid var(--xp-accent-dark)",
        }}
      >
        <span style={{ fontSize: 26, lineHeight: 1 }}>📓</span>
        <div>
          <div
            style={{
              color: "white",
              fontWeight: "bold",
              fontSize: 13,
              fontFamily: "Tahoma, sans-serif",
              textShadow: "1px 1px var(--xp-titlebar-shadow)",
            }}
          >
            My Journal
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 10,
              fontFamily: "Tahoma, sans-serif",
            }}
          >
            Personal diary
          </div>
        </div>
      </div>

      <MenuRow icon="🔍" label="Search Entries" onClick={() => { onOpenSearch(); onClose(); }} />
      <MenuRow icon="📌" label="New Sticky Note" onClick={() => { onNewNote(); onClose(); }} />

      <MenuRow
        icon="🎨"
        label="Change Theme"
        hasArrow
        active={expanded === "theme"}
        onClick={() => toggle("theme")}
      />
      {expanded === "theme" && (
        <div style={{ borderBottom: "1px solid var(--xp-separator)" }}>
          {THEMES.map(t => (
            <div
              key={t.id}
              style={subRowStyle(theme === t.id)}
              onClick={() => setTheme(t.id as ThemeId)}
              onMouseEnter={e => {
                if (theme !== t.id)
                  (e.currentTarget as HTMLDivElement).style.background = "var(--xp-calendar-hover)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background =
                  theme === t.id ? "var(--xp-accent)" : "transparent";
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 13,
                  height: 13,
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

      <MenuRow
        icon="🖼️"
        label="Change Wallpaper"
        hasArrow
        active={expanded === "wallpaper"}
        onClick={() => toggle("wallpaper")}
      />
      {expanded === "wallpaper" && (
        <div style={{ borderBottom: "1px solid var(--xp-separator)" }}>
          {WALLPAPERS.filter(w => w.id !== "custom").map(w => (
            <div
              key={w.id}
              style={subRowStyle(wallpaperId === w.id)}
              onClick={() => { setWallpaper(w.id); onClose(); }}
              onMouseEnter={e => {
                if (wallpaperId !== w.id)
                  (e.currentTarget as HTMLDivElement).style.background = "var(--xp-calendar-hover)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.background =
                  wallpaperId === w.id ? "var(--xp-accent)" : "transparent";
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 13,
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
            style={subRowStyle(wallpaperId === "custom" && !!customImage)}
            onClick={() => fileInputRef.current?.click()}
            onMouseEnter={e => {
              if (!(wallpaperId === "custom" && customImage))
                (e.currentTarget as HTMLDivElement).style.background = "var(--xp-calendar-hover)";
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
              style={subRowStyle(false)}
              onClick={() => { clearCustomImage(); onClose(); }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "var(--xp-calendar-hover)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>✕</span>
              Remove Custom Image
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
        </div>
      )}

      <div
        style={{
          borderTop: "2px solid var(--xp-separator)",
          padding: "6px 14px",
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        <div
          onClick={onClose}
          style={{
            fontSize: 11,
            fontFamily: "Tahoma, sans-serif",
            color: "var(--xp-window-text)",
            cursor: "pointer",
            opacity: 0.6,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = "0.6"; }}
        >
          Close ✕
        </div>
      </div>
    </div>
  );
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

interface ContextMenuState {
  day: Date;
  x: number;
  y: number;
}

function ContextMenu({
  menu,
  entryExists,
  onNewEntry,
  onOpenEntry,
  onCopyDate,
  onClose,
}: {
  menu: ContextMenuState;
  entryExists: boolean;
  onNewEntry: () => void;
  onOpenEntry: () => void;
  onCopyDate: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    left: menu.x,
    top: menu.y,
    zIndex: 9999,
    backgroundColor: "#d4d0c8",
    border: "2px solid",
    borderColor: "#ffffff #808080 #808080 #ffffff",
    boxShadow: "2px 2px 4px rgba(0,0,0,0.5)",
    minWidth: 140,
    padding: "2px 0",
    fontFamily: "Tahoma, sans-serif",
    fontSize: 12,
  };

  const itemBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 20px 4px 24px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    userSelect: "none",
  };

  return (
    <div ref={menuRef} style={menuStyle} onContextMenu={e => e.preventDefault()}>
      <ContextMenuItem
        label="📝 New Entry"
        style={itemBase}
        onClick={() => { onClose(); onNewEntry(); }}
      />
      <ContextMenuItem
        label="📖 Open Entry"
        style={itemBase}
        disabled={!entryExists}
        onClick={() => { if (entryExists) { onClose(); onOpenEntry(); } }}
      />
      <div style={{ borderTop: "1px solid #808080", borderBottom: "1px solid #ffffff", margin: "2px 0" }} />
      <ContextMenuItem
        label="📋 Copy Date"
        style={itemBase}
        onClick={() => { onClose(); onCopyDate(); }}
      />
    </div>
  );
}

function ContextMenuItem({
  label,
  style,
  disabled,
  onClick,
}: {
  label: string;
  style: React.CSSProperties;
  disabled?: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        ...style,
        background: hovered && !disabled ? "#0a246a" : "transparent",
        color: disabled ? "#808080" : hovered ? "#ffffff" : "#000000",
        cursor: disabled ? "default" : "pointer",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {label}
    </div>
  );
}

function StickyNote({
  note,
  onClose,
  onContentChange,
  onPositionChange,
  onColorChange,
  onSizeChange,
}: {
  note: StickyNoteData;
  onClose: (id: string) => void;
  onContentChange: (id: string, content: string) => void;
  onPositionChange: (id: string, pos: DragPos) => void;
  onColorChange: (id: string, color: StickyColor) => void;
  onSizeChange: (id: string, size: StickySize) => void;
}) {
  const noteRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOffset = useRef<DragPos>({ x: 0, y: 0 });
  const posRef = useRef<DragPos>(note.position);
  const [localPos, setLocalPos] = useState<DragPos>(note.position);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const isResizing = useRef(false);
  const resizeStart = useRef<{ mx: number; my: number; w: number; h: number }>({ mx: 0, my: 0, w: 0, h: 0 });
  const sizeRef = useRef<StickySize>(note.size ?? { w: STICKY_DEFAULT_W, h: STICKY_DEFAULT_H });
  const [localSize, setLocalSize] = useState<StickySize>(note.size ?? { w: STICKY_DEFAULT_W, h: STICKY_DEFAULT_H });

  const colors = STICKY_COLORS[note.color];

  const onTitlebarMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".sticky-close") || target.closest(".sticky-color-pick")) return;
    const el = noteRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  }, []);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeStart.current = {
      mx: e.clientX,
      my: e.clientY,
      w: sizeRef.current.w,
      h: sizeRef.current.h,
    };
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current && noteRef.current) {
        const el = noteRef.current;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const x = Math.max(0, Math.min(e.clientX - dragOffset.current.x, vw - el.offsetWidth));
        const y = Math.max(0, Math.min(e.clientY - dragOffset.current.y, vh - el.offsetHeight - 32));
        posRef.current = { x, y };
        setLocalPos({ x, y });
      } else if (isResizing.current) {
        const dx = e.clientX - resizeStart.current.mx;
        const dy = e.clientY - resizeStart.current.my;
        const w = Math.min(STICKY_MAX_W, Math.max(STICKY_MIN_W, resizeStart.current.w + dx));
        const h = Math.min(STICKY_MAX_H, Math.max(STICKY_MIN_H, resizeStart.current.h + dy));
        sizeRef.current = { w, h };
        setLocalSize({ w, h });
      }
    };
    const onMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        onPositionChange(note.id, posRef.current);
      }
      if (isResizing.current) {
        isResizing.current = false;
        onSizeChange(note.id, sizeRef.current);
      }
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [note.id, onPositionChange, onSizeChange]);

  const colorOptions: StickyColor[] = ["yellow", "pink", "blue", "green"];

  return (
    <div
      ref={noteRef}
      className="xp-window"
      style={{
        position: "absolute",
        left: localPos.x,
        top: localPos.y,
        width: localSize.w,
        zIndex: 500,
        backgroundColor: colors.bg,
        boxShadow: "3px 3px 10px rgba(0,0,0,0.45)",
      }}
    >
      <div
        className="xp-titlebar"
        onMouseDown={onTitlebarMouseDown}
        style={{
          background: colors.titlebar,
          cursor: "default",
          userSelect: "none",
          padding: "3px 5px",
          minHeight: 26,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <span style={{ fontSize: 13 }}>📌</span>
          <span style={{ fontSize: 11, fontFamily: "Tahoma, sans-serif", opacity: 0.9, flex: 1 }}>
            Sticky Note
          </span>
          <div style={{ position: "relative" }}>
            <button
              className="sticky-color-pick"
              title="Change color"
              onClick={() => setShowColorPicker(v => !v)}
              style={{
                background: "rgba(255,255,255,0.25)",
                border: "1px solid rgba(255,255,255,0.5)",
                borderRadius: 3,
                cursor: "pointer",
                padding: "1px 5px",
                fontSize: 10,
                color: "white",
                fontFamily: "Tahoma, sans-serif",
              }}
            >
              🎨
            </button>
            {showColorPicker && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  background: "var(--xp-window-bg)",
                  border: "2px outset var(--xp-border-light)",
                  borderRightColor: "var(--xp-border-dark)",
                  borderBottomColor: "var(--xp-border-dark)",
                  boxShadow: "2px 2px 6px rgba(0,0,0,0.4)",
                  zIndex: 600,
                  padding: "6px",
                  display: "flex",
                  gap: 5,
                }}
              >
                {colorOptions.map(c => (
                  <div
                    key={c}
                    title={c}
                    onClick={() => { onColorChange(note.id, c); setShowColorPicker(false); }}
                    style={{
                      width: 18,
                      height: 18,
                      background: STICKY_COLORS[c].titlebar,
                      border: note.color === c ? "2px solid white" : "2px solid rgba(0,0,0,0.3)",
                      borderRadius: 2,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="xp-titlebar-controls" style={{ marginLeft: 4 }}>
          <div
            className="xp-btn-control xp-btn-close sticky-close"
            onClick={() => onClose(note.id)}
          />
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <textarea
          value={note.content}
          onChange={e => onContentChange(note.id, e.target.value)}
          placeholder="Type a note…"
          style={{
            width: "100%",
            height: localSize.h,
            resize: "none",
            border: "none",
            outline: "none",
            background: colors.bg,
            color: colors.text,
            fontFamily: "var(--app-font-sans, Tahoma, sans-serif)",
            fontSize: 13,
            padding: "8px 10px",
            lineHeight: 1.5,
            boxSizing: "border-box",
            display: "block",
          }}
        />
        <div
          onMouseDown={onResizeMouseDown}
          title="Drag to resize"
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: 16,
            height: 16,
            cursor: "nwse-resize",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "flex-end",
            padding: "2px",
            userSelect: "none",
            zIndex: 10,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ opacity: 0.4, pointerEvents: "none" }}>
            <line x1="10" y1="2" x2="2" y2="10" stroke={colors.text} strokeWidth="1.5" strokeLinecap="round" />
            <line x1="10" y1="6" x2="6" y2="10" stroke={colors.text} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Desktop() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [now, setNow] = useState(new Date());
  const [showSearch, setShowSearch] = useState(false);
  const [showStartMenu, setShowStartMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const { notes, addNote, updateContent, updatePosition, updateColor, updateSize, removeNote } = useStickyNotes();

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
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ day, x: e.clientX, y: e.clientY });
                  }}
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

      {/* Right-click Context Menu */}
      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          entryExists={hasEntry(contextMenu.day)}
          onNewEntry={() => setSelectedDate(contextMenu.day)}
          onOpenEntry={() => setSelectedDate(contextMenu.day)}
          onCopyDate={() => {
            const label = format(contextMenu.day, "MMMM d, yyyy");
            navigator.clipboard.writeText(label).then(() => {
              setCopyToast(true);
              setTimeout(() => setCopyToast(false), 2000);
            });
          }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Copy Date Toast */}
      {copyToast && (
        <div
          style={{
            position: "fixed",
            bottom: 48,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10000,
            backgroundColor: "#d4d0c8",
            border: "2px solid",
            borderColor: "#ffffff #808080 #808080 #ffffff",
            padding: "6px 16px",
            fontFamily: "Tahoma, sans-serif",
            fontSize: 12,
            boxShadow: "2px 2px 4px rgba(0,0,0,0.4)",
            whiteSpace: "nowrap",
          }}
        >
          📋 Date copied to clipboard
        </div>
      )}

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

      {/* Sticky Notes */}
      {notes.map(note => (
        <StickyNote
          key={note.id}
          note={note}
          onClose={removeNote}
          onContentChange={updateContent}
          onPositionChange={updatePosition}
          onColorChange={updateColor}
          onSizeChange={updateSize}
        />
      ))}

      {/* Start Menu */}
      {showStartMenu && (
        <StartMenu
          onClose={() => setShowStartMenu(false)}
          onOpenSearch={() => { setShowSearch(true); setShowStartMenu(false); }}
          onNewNote={() => { addNote(); setShowStartMenu(false); }}
        />
      )}

      {/* Taskbar */}
      <div className="xp-taskbar">
        <div className="flex h-full">
          <div
            className="xp-start-btn"
            onClick={() => setShowStartMenu(v => !v)}
            style={{ cursor: "pointer" }}
          >
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
      queryKey: getGetEntryQueryKey(dateStr),
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status === 404) && failureCount < 3,
      throwOnError: (error) =>
        !(error instanceof ApiError && error.status === 404)
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
                <div
                  style={{
                    borderTop: "1px solid var(--xp-border-dark)",
                    borderLeft: "1px solid var(--xp-border-dark)",
                    borderBottom: "1px solid var(--xp-border-light)",
                    borderRight: "1px solid var(--xp-border-light)",
                    background: "var(--xp-window-bg)",
                    padding: "2px 6px",
                    textAlign: "right",
                    fontSize: "11px",
                    fontFamily: "Tahoma, sans-serif",
                    color: "var(--xp-window-text)",
                    userSelect: "none",
                  }}
                >
                  {body.trim() === "" ? 0 : body.trim().split(/\s+/).length} words
                </div>
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
