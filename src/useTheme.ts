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
 * Class stamped on `<html>` for the single frame the palette changes in.
 *
 * The CSS behind it is in `src/index.css`, beside the motion tokens the rest of
 * the transition behaviour comes from.
 */
const SWAPPING = "theme-swapping";

/**
 * Apply a theme without leaving half the page painted in the old one.
 *
 * **On some Chromium versions, a transition on a colour that comes from a
 * custom property does not re-resolve when that property changes.** The element
 * keeps its old computed colour indefinitely — not mid-fade, frozen — while the
 * token underneath it has already flipped. Measured across four consecutive
 * toggles: `--color-ink-soft` alternated correctly every time while the theme
 * control's own colour never moved.
 *
 * What it is *not*, each ruled out by measurement rather than reasoning:
 *
 * - **Not about the control that was clicked**, which is how it was first
 *   reported. Setting `data-theme` directly — no click, no React update
 *   anywhere — reproduces it exactly.
 * - **Not about the element type.** A `button`, an `a` and a `span` carrying
 *   the same classes all froze together, while an otherwise identical element
 *   **without** `transition` updated correctly beside them. The transition is
 *   the whole cause, and every element carrying `STATE_LAYER`, `LINK_UNDERLINE`
 *   or `BACK_LINK` carries one.
 * - **Not "keeps the previous theme's colour".** It keeps whatever it happened
 *   to hold, which lands on the previous theme's value only because that is
 *   usually what that was.
 * - **Not curable by touching the element.** Changing its `background-color`,
 *   reading `offsetHeight` on it, and blurring it all leave it frozen.
 *
 * **It is engine-version-specific, which is why nothing caught it.** Verified
 * on Chrome 148.0.7778.280, at desktop and under mobile emulation; **not**
 * reproducible on the Chromium 151.0.7922.34 that `@playwright/test` bundles,
 * by real mouse click, scripted click or keyboard. So the e2e suite runs on an
 * engine where the bug does not exist — see the note in `tests/e2e/theme.spec.ts`
 * on why the spec there passes either way, and why this fix ships without one.
 *
 * Suppressing transitions for the swap beats narrowing what each constant
 * transitions: the affected set is every themed property — colour, decoration
 * colour, border and background — and pruning them one at a time would cost the
 * hover feedback those constants exist to provide. The reflow between is
 * load-bearing; without it the browser coalesces both style changes and the
 * suppression never takes effect.
 *
 * No crossfade is being given up. The behaviour this replaces is not a page
 * that fades between themes, it is a page that changes theme *except* for
 * whichever elements happen to be transitioning.
 */
const applyTheme = (theme: Theme): void => {
  const root = document.documentElement;

  root.classList.add(SWAPPING);
  root.dataset.theme = theme;
  // Read a layout property to force the style recalculation to happen *now*,
  // while transitions are still off.
  void root.offsetHeight;
  root.classList.remove(SWAPPING);
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
    applyTheme(theme);
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
