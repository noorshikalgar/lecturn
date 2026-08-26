import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ThemePalette = "console" | "japan";

const MODE_KEY = "lecturn-theme-mode";
const PALETTE_KEY = "lecturn-theme-palette";

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const stored = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  return (allowed as readonly string[]).includes(stored ?? "") ? (stored as T) : fallback;
}

function resolveDark(mode: ThemeMode): boolean {
  if (mode === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches;
  return mode === "dark";
}

function applyTheme(mode: ThemeMode, palette: ThemePalette) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolveDark(mode));
  root.dataset.palette = palette;
}

interface ThemeContextValue {
  mode: ThemeMode;
  palette: ThemePalette;
  setMode: (mode: ThemeMode) => void;
  setPalette: (palette: ThemePalette) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStored(MODE_KEY, ["light", "dark", "system"], "dark"));
  const [palette, setPaletteState] = useState<ThemePalette>(() => readStored(PALETTE_KEY, ["console", "japan"], "console"));

  useEffect(() => {
    applyTheme(mode, palette);
  }, [mode, palette]);

  // "system" mode should react live if the OS theme changes while open.
  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(mode, palette);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode, palette]);

  function setMode(next: ThemeMode) {
    window.localStorage.setItem(MODE_KEY, next);
    setModeState(next);
  }

  function setPalette(next: ThemePalette) {
    window.localStorage.setItem(PALETTE_KEY, next);
    setPaletteState(next);
  }

  return <ThemeContext.Provider value={{ mode, palette, setMode, setPalette }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
