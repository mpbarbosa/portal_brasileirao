import { useCallback, useEffect, useState } from "react";

import {
  oppositeTheme,
  parsePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/theme-core";

const systemPrefersLight = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-color-scheme: light)").matches;

const read = (): Theme => {
  try {
    return resolveTheme(
      parsePreference(localStorage.getItem(THEME_STORAGE_KEY)),
      systemPrefersLight(),
    );
  } catch {
    // Storage can throw in private mode; the inline script fell back the same way.
    return resolveTheme(null, systemPrefersLight());
  }
};

/**
 * The active theme, and a way to flip it.
 *
 * Initial state is read from the DOM rather than recomputed: the inline script
 * in index.html has already resolved and stamped it, and disagreeing here would
 * repaint on mount — the flash that script exists to prevent.
 *
 * Flipping records an explicit choice, which from then on wins over the system
 * setting. Someone who has never chosen keeps following their system, including
 * when it changes mid-session.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || read(),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      // Only follow the system while no explicit choice has been made.
      if (!parsePreference(stored)) setTheme(resolveTheme(null, media.matches));
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = oppositeTheme(current);
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* the theme still applies for this session */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
