"use client";

import * as React from "react";
import {
  THEME_STORAGE_KEY,
  themeSchema,
  type Theme,
} from "@/validation/theme-schema";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function resolveIsDark(theme: Theme): boolean {
  return (
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

// --- localStorage-backed store (read via useSyncExternalStore, per React
// guidance for external systems; avoids setState-in-effect) ---
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored && themeSchema.safeParse(stored).success
    ? themeSchema.parse(stored)
    : "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

function setStoredTheme(next: Theme): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, next);
  for (const listener of listeners) listener();
}

/**
 * Native theming (research.md D4): values light|dark|system, default system,
 * persisted to localStorage["focustodo-theme"]; the pre-hydration inline
 * script in the root layout applies the class so there is no wrong-theme
 * flash (FR-010, SC-004).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", resolveIsDark(theme));
    if (theme !== "system") return;
    // Follow OS changes while on "system".
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () =>
      document.documentElement.classList.toggle("dark", media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    setStoredTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
