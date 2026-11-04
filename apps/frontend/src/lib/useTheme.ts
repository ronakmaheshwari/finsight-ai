import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "finsight-theme";

const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme !== "system") root.classList.add(theme);
};

/**
 * Theme follows the OS by default; picking light or dark pins it and survives a
 * reload. The `.light` / `.dark` classes are what the token layer keys off.
 */
export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "light" || stored === "dark" ? stored : "system";
    } catch {
      return "system";
    }
  });

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Private mode: the theme simply does not persist.
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = current === "dark" || (current === "system" && prefersDark);
      return isDark ? "light" : "dark";
    });
  }, []);

  return { theme, toggle };
};
