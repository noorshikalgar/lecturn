export const THEMES = [
  { key: "light", label: "Light" },
  { key: "midnight", label: "Midnight" },
  { key: "graphite", label: "Graphite" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];

const STORAGE_KEY = "lecturn:theme";

export function loadTheme(): ThemeKey {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return THEMES.find((t) => t.key === stored)?.key ?? "light";
  } catch {
    return "light";
  }
}

export function applyTheme(key: ThemeKey) {
  document.documentElement.dataset.theme = key;
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // best-effort — a private window or blocked storage just means the
    // choice doesn't survive a reload, not worth surfacing to the user.
  }
}
