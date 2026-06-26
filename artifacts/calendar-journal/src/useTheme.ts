import { useState, useEffect } from "react";

export type ThemeId = "xp-blue" | "win98" | "luna" | "zune" | "kawaii";

export interface Theme {
  id: ThemeId;
  label: string;
  preview: string;
}

export const THEMES: Theme[] = [
  { id: "xp-blue", label: "XP Blue", preview: "#0A246A" },
  { id: "win98", label: "Win98 Classic", preview: "#000080" },
  { id: "luna", label: "Luna Green", preview: "#2D5016" },
  { id: "zune", label: "Zune Dark", preview: "#2D1B4E" },
  { id: "kawaii", label: "Kawaii Pink", preview: "#d45c9e" },
];

const STORAGE_KEY = "journal-theme";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    return stored && THEMES.some(t => t.id === stored) ? stored : "xp-blue";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
    const initial = stored && THEMES.some(t => t.id === stored) ? stored : "xp-blue";
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const setTheme = (id: ThemeId) => {
    localStorage.setItem(STORAGE_KEY, id);
    setThemeState(id);
  };

  return { theme, setTheme, themes: THEMES };
}
