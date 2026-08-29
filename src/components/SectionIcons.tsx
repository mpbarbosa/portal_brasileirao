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

import type { WeatherKind } from "@/src/types";

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

/**
 * Jogadores: a shirt. The elenco is read as a list of names, and a shirt is
 * what a name is worn on — the other candidate, a person glyph, is what every
 * account menu on the web already means.
 */
export function PlayersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 3 5 5 3.5 9l2.5 1v10h12V10l2.5-1L19 5l-4-2" />
      <path d="M9 3a3 3 0 0 0 6 0" />
    </svg>
  );
}

/*
 * The two below are not sections, and they live here anyway.
 *
 * `base` is the reason: it is the one place this app's stroke weight, cap and
 * join are written down, and a glyph defined beside its call site drifts from
 * it — which is exactly the drift `GLYPH` in `ClubLinks.tsx` was extracted to
 * stop. So the rule this file follows is "hand-drawn 24px glyphs share one
 * attribute bag", and `NAV_ITEMS` reaching only for the five above is a fact
 * about that list rather than about this module.
 */

/**
 * The theme toggle, showing the theme it switches **to**.
 *
 * They replace `☀` and `☽`, which were text glyphs, and the failure was not
 * theoretical: a font decides a character's size and weight, and these two are
 * decided by different parts of the font. Measured in the shipped bundle at
 * 900dp, the sun drew as a thin asterisk and the crescent as a hairline barely
 * a third the height of the 24px icons beside it — two states of one control
 * rendering at two optical sizes, in a bar whose whole trailing group had just
 * been levelled to the pixel. A `☀` is also emoji-presentation on several
 * platforms, which would put a colour glyph in a monochrome bar.
 */
export function SunIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
    </svg>
  );
}

/** The other half of the pair; see `SunIcon`. */
export function MoonIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1" />
    </svg>
  );
}

/**
 * The line kind of the **Campanha** mark, for the column's plot-kind toggle.
 *
 * Here rather than beside the toggle for the reason `SunIcon` is: this file
 * holds the one `base` attribute bag the app's glyphs share, and a glyph defined
 * at its call site drifts from it. Neither of these is a section either.
 *
 * It draws a rising trace because that is what the mark it names looks like,
 * not a generic chart frame with axes — the toggle offers a choice between two
 * pictures, so each glyph has to be a small copy of its own picture.
 */
export function LinePlotIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 17l5-5 4 3 6-8" />
      <circle cx="18" cy="7" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The bars kind; the other half of the pair, see `LinePlotIcon`. */
export function BarsPlotIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 19v-5M10 19v-9M15 19v-4M20 19v-13" />
    </svg>
  );
}

/**
 * The six skies `weather-core.ts` names, drawn rather than spelled.
 *
 * They live here despite not being sections, for the reason `SunIcon` and
 * `MoonIcon` do: this file holds the one `base` attribute bag the app's glyphs
 * share, and a mark defined beside its call site drifts from it. And they are
 * drawn at all rather than written as `☀`/`☁`/`☂` because those are
 * Extended_Pictographic — the same trap the theme toggle records, where a font
 * decides the size and several platforms decide the colour.
 *
 * `clear` is the one that changes after dark, because it is the only sky whose
 * picture is the light source itself. Everything else looks the same at night.
 */
export function WeatherIcon({
  kind,
  day = true,
  className,
}: IconProps & { kind: WeatherKind; day?: boolean }) {
  if (kind === "clear") {
    return day ? <SunIcon className={className} /> : <MoonIcon className={className} />;
  }
  return (
    <svg {...base} className={className}>
      {/* Every remaining sky is a cloud plus what falls out of it. */}
      <path d="M7 16h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.5-1A3.5 3.5 0 0 0 7 16Z" />
      {kind === "rain" && <path d="M9 19l-1 2M13 19l-1 2M17 19l-1 2" />}
      {kind === "storm" && <path d="M13 18l-3 4h4l-3 4" />}
      {kind === "snow" && <path d="M9 20h.01M13 20h.01M17 20h.01M11 22h.01M15 22h.01" />}
      {kind === "fog" && <path d="M5 19h14M7 22h10" />}
    </svg>
  );
}
