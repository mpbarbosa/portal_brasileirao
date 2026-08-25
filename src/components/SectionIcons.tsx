/**
 * One icon per section, for the navigation bar.
 *
 * Drawn here rather than pulled from an icon set. The app ships no UI
 * dependency and draws its own sparkline already; a handful of 24px glyphs do
 * not justify a package, and a package would arrive with several hundred more.
 *
 * Stroke rather than fill, in `currentColor`, so a single element re-themes and
 * takes its colour from the nav item's own state — the same trick
 * `RankSparkline` uses. `aria-hidden` on every one: the label beside the icon is
 * the accessible name, and announcing both would read the section twice.
 *
 * They are referenced from `NAV_ITEMS` rather than mapped by id inside `NavBar`,
 * deliberately. `CLAUDE.md` promises that adding a section means an entry in
 * that list plus a case in `App`'s switch, and that `NavBar` needs no change —
 * an icon lookup living in `NavBar` would quietly break that promise the next
 * time someone adds a section.
 */

interface IconProps {
  /** Tailwind classes for size and colour; the paths inherit `currentColor`. */
  className?: string;
}

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** Classificação: an ordered list — rank marks against rows. */
export function StandingsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h1M4 12h1M4 18h1" />
      <path d="M9 6h11M9 12h11M9 18h11" />
    </svg>
  );
}

/** Jogos: a calendar — fixtures are read by round, which is to say by date. */
export function MatchesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

/**
 * Ao vivo: a broadcast — a point with signal arcs leaving it.
 *
 * Not a red dot, which is the other convention: the dot only reads as "live"
 * once it is red, and colour is not something a nav glyph gets to rely on here.
 * The page's own cards carry the pulsing mark, where a label sits beside it.
 */
export function LiveIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="2" />
      <path d="M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6" />
      <path d="M5.3 18.7a9.5 9.5 0 0 1 0-13.4M18.7 5.3a9.5 9.5 0 0 1 0 13.4" />
    </svg>
  );
}

/** Artilharia: a target. The word is artillery; the sense is who finds the goal. */
export function ScorersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
