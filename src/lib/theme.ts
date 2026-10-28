"use client";

import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "hc_theme_preference";

export function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (saved === "light" || saved === "dark" || saved === "system") {
      return saved;
    }
  } catch {
    // ignore
  }
  return "system";
}

export function applyTheme(mode: ThemeMode): "light" | "dark" {
  if (typeof window === "undefined") return "light";

  const resolved = mode === "system" ? getSystemTheme() : mode;
  const root = document.documentElement;

  if (resolved === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
    root.setAttribute("data-theme", "dark");
  } else {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    root.setAttribute("data-theme", "light");
  }

  return resolved;
}

export function setStoredTheme(mode: ThemeMode): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  applyTheme(mode);
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const [mounted, setMounted] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const currentMode = getStoredTheme();
    setThemeState(currentMode);
    const resolved = applyTheme(currentMode);
    setResolvedTheme(resolved);
    setMounted(true);

    // Listen to OS system color scheme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const savedMode = getStoredTheme();
      if (savedMode === "system") {
        const nextResolved = applyTheme("system");
        setResolvedTheme(nextResolved);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    // Sync across browser tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const nextMode = (e.newValue as ThemeMode) || "system";
        setThemeState(nextMode);
        setResolvedTheme(applyTheme(nextMode));
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    setStoredTheme(mode);
    const nextResolved = applyTheme(mode);
    setResolvedTheme(nextResolved);
  }, []);

  return {
    theme,
    resolvedTheme,
    setTheme,
    mounted,
  };
}
