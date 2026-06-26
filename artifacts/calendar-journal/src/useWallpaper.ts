import { useState, useEffect, createContext, useContext, createElement } from "react";
import type { ReactNode } from "react";

export type WallpaperId =
  | "default"
  | "bliss"
  | "azul"
  | "purple"
  | "clouds"
  | "checkers"
  | "bricks"
  | "custom";

export interface WallpaperPreset {
  id: WallpaperId;
  label: string;
  preview: string;
  style: Record<string, string>;
}

const CHECKERS_SVG = `url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 16 16' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='8' height='8' fill='%23888'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23888'/%3E%3Crect x='8' y='0' width='8' height='8' fill='%23aaa'/%3E%3Crect x='0' y='8' width='8' height='8' fill='%23aaa'/%3E%3C/svg%3E")`;

const BRICKS_SVG = `url("data:image/svg+xml,%3Csvg width='40' height='20' viewBox='0 0 40 20' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='40' height='20' fill='%23b05030'/%3E%3Crect x='1' y='1' width='17' height='8' fill='%23c8603a'/%3E%3Crect x='21' y='1' width='18' height='8' fill='%23c8603a'/%3E%3Crect x='1' y='11' width='9' height='8' fill='%23c8603a'/%3E%3Crect x='13' y='11' width='14' height='8' fill='%23c8603a'/%3E%3Crect x='30' y='11' width='9' height='8' fill='%23c8603a'/%3E%3C/svg%3E")`;

export const WALLPAPERS: WallpaperPreset[] = [
  {
    id: "default",
    label: "Default",
    preview: "linear-gradient(135deg, #3a7a5a 0%, #87ceeb 100%)",
    style: {},
  },
  {
    id: "bliss",
    label: "Bliss",
    preview: "linear-gradient(to bottom, #4a9fe8 40%, #5cb85c 60%)",
    style: {
      backgroundImage:
        "linear-gradient(to bottom, #4a9fe8 0%, #87ceeb 38%, #98d474 58%, #4a8e2a 100%)",
    },
  },
  {
    id: "azul",
    label: "Azul",
    preview: "linear-gradient(135deg, #0a246a 0%, #87ceeb 100%)",
    style: {
      backgroundImage:
        "linear-gradient(135deg, #0a246a 0%, #1e5fb5 50%, #87ceeb 100%)",
    },
  },
  {
    id: "purple",
    label: "Purple Haze",
    preview: "linear-gradient(135deg, #2d1b4e 0%, #9b4acb 100%)",
    style: {
      backgroundImage:
        "linear-gradient(135deg, #2d1b4e 0%, #7b4aab 50%, #c084fc 100%)",
    },
  },
  {
    id: "clouds",
    label: "Clouds",
    preview: "linear-gradient(to bottom, #87ceeb 0%, #e0f4ff 100%)",
    style: {
      backgroundImage:
        "linear-gradient(to bottom, #87ceeb 0%, #c8e8f8 50%, #e8f4ff 100%)",
    },
  },
  {
    id: "checkers",
    label: "Checkers",
    preview: "repeating-conic-gradient(#888 0% 25%, #aaa 0% 50%) 0 0 / 16px 16px",
    style: {
      backgroundImage: CHECKERS_SVG,
      backgroundRepeat: "repeat",
      backgroundSize: "16px 16px",
    },
  },
  {
    id: "bricks",
    label: "Bricks",
    preview: "linear-gradient(135deg, #b05030 0%, #c8603a 100%)",
    style: {
      backgroundImage: BRICKS_SVG,
      backgroundRepeat: "repeat",
      backgroundSize: "40px 20px",
    },
  },
];

const STORAGE_KEY = "journal-wallpaper";
const CUSTOM_IMAGE_KEY = "journal-wallpaper-custom-image";

interface WallpaperContextValue {
  wallpaperId: WallpaperId;
  customImage: string | null;
  wallpapers: WallpaperPreset[];
  setWallpaper: (id: WallpaperId) => void;
  setCustomImage: (dataUrl: string) => void;
  clearCustomImage: () => void;
  getDesktopStyle: () => Record<string, string>;
}

const WallpaperContext = createContext<WallpaperContextValue | null>(null);

export function WallpaperProvider({ children }: { children: ReactNode }) {
  const [wallpaperId, setWallpaperIdState] = useState<WallpaperId>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as WallpaperId | null;
    const valid = [...WALLPAPERS.map(w => w.id), "custom"] as string[];
    return stored && valid.includes(stored) ? (stored as WallpaperId) : "default";
  });

  const [customImage, setCustomImageState] = useState<string | null>(() => {
    return localStorage.getItem(CUSTOM_IMAGE_KEY);
  });

  const setWallpaper = (id: WallpaperId) => {
    localStorage.setItem(STORAGE_KEY, id);
    setWallpaperIdState(id);
  };

  const setCustomImage = (dataUrl: string) => {
    try {
      localStorage.setItem(CUSTOM_IMAGE_KEY, dataUrl);
      setCustomImageState(dataUrl);
      setWallpaperIdState("custom");
      localStorage.setItem(STORAGE_KEY, "custom");
    } catch {
      alert("Image is too large to save. Please choose a smaller image (under 3MB).");
    }
  };

  const clearCustomImage = () => {
    localStorage.removeItem(CUSTOM_IMAGE_KEY);
    setCustomImageState(null);
    setWallpaper("default");
  };

  const getDesktopStyle = (): Record<string, string> => {
    if (wallpaperId === "custom" && customImage) {
      return {
        backgroundImage: `url(${customImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      };
    }
    const preset = WALLPAPERS.find(w => w.id === wallpaperId);
    return preset?.style ?? {};
  };

  const value: WallpaperContextValue = {
    wallpaperId,
    customImage,
    wallpapers: WALLPAPERS,
    setWallpaper,
    setCustomImage,
    clearCustomImage,
    getDesktopStyle,
  };

  return createElement(WallpaperContext.Provider, { value }, children);
}

export function useWallpaper(): WallpaperContextValue {
  const ctx = useContext(WallpaperContext);
  if (!ctx) throw new Error("useWallpaper must be used inside WallpaperProvider");
  return ctx;
}
