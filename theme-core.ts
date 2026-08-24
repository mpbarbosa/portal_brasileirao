/**
 * Pure theme resolution. No DOM, no storage — inputs in, theme out
 * (tests/theme-core.test.ts).
 */

export type Theme = "light" | "dark";
/** What the reader chose. `null` means they have not chosen: follow the system. */
export type ThemePreference = Theme | null;

export const THEME_STORAGE_KEY = "portal-brasileirao:theme";

/** Narrow an unknown stored value to a preference, tolerating junk in storage. */
export const parsePreference = (value: string | null | undefined): ThemePreference =>
  value === "light" || value === "dark" ? value : null;

/**
 * The theme to render.
 *
 * An explicit choice always wins. Without one, follow the system — and where
 * the system expresses nothing, fall back to dark, which is what the app looked
 * like before it had a light theme at all.
 */
export const resolveTheme = (
  preference: ThemePreference,
  systemPrefersLight: boolean,
): Theme => preference ?? (systemPrefersLight ? "light" : "dark");

export const oppositeTheme = (theme: Theme): Theme => (theme === "light" ? "dark" : "light");

/** pt-BR label for the control that switches *to* the other theme. */
export const themeToggleLabel = (current: Theme): string =>
  current === "light" ? "Ativar tema escuro" : "Ativar tema claro";
