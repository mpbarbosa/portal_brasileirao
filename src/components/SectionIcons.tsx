/**
 * One icon per section, for the navigation bar.
 *
 * Drawn here rather than pulled from an icon set. The app ships no UI
 * dependency and draws its own sparkline already; three 24px glyphs do not
 * justify a package, and a package would arrive with several hundred more.
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

/** Artilharia: a target. The word is artillery; the sense is who finds the goal. */
export function ScorersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
