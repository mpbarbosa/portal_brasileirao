import { useMemo } from "react";

import type { CampaignPlotKind } from "@/campaign-plot-core";
import { clubKey } from "@/club-core";
import { CampaignPlotToggle } from "@/src/components/CampaignPlotToggle";
import { ClubCrest } from "@/src/components/ClubCrest";
import { StarGlyph } from "@/src/components/MeuTime";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { lastRecordedRound } from "@/rank-history-core";
import { RankSparkline } from "@/src/components/RankSparkline";
import { formatRoute } from "@/route-core";
import { ZONE_DEPTH, ZONE_DEPTH_WORD, pointsPercentageLabel } from "@/standings-core";
import { Surface } from "@/src/components/Surface";
import type { ClubCode, ClubRankHistory, RankAtRound, StandingsRow } from "@/src/types";

/** The two rail colours, shared between the cell and the key so a change to
 *  either colour cannot leave the other describing the old one. */
const G4_RAIL = "border-l-2 border-l-positive";
const Z4_RAIL = "border-l-2 border-l-negative";

/** Libertadores places (G4) and the relegation zone (Z4) get a rail colour.
 *  It rides on the first cell, not the row: the row scrolls horizontally and
 *  would carry the rail away underneath the frozen columns. */
const zoneClass = (position: number, total: number): string => {
  if (position <= ZONE_DEPTH) return G4_RAIL;
  if (position > total - ZONE_DEPTH) return Z4_RAIL;
  return "border-l-2 border-l-transparent";
};

/**
 * The key to the rail.
 *
 * `where` is the load-bearing half, not a gloss on the term. The rail is a
 * border colour and nothing else, so **hue is its only channel**: it says
 * nothing to a red/green-colourblind reader, and nothing in a grayscale
 * capture. Naming which positions each zone covers moves the fact onto a
 * channel every reader already has — the position column — after which the
 * rail confirms what the key said rather than being the only place it is said.
 * That is the same bargain the club page's form pills strike by carrying a
 * letter beside the colour.
 *
 * It counts in from the ends of the table rather than naming 17º–20º, because
 * Z4 is derived from the row count (see `zoneClass`, and `CONTEXT.md`): a
 * division that changed size would leave hard-coded ordinals wrong on the page
 * with nothing to catch it.
 */
const ZONE_KEY = [
  {
    rail: G4_RAIL,
    term: "G4",
    zone: "Libertadores",
    where: `as ${ZONE_DEPTH_WORD} primeiras posições`,
  },
  {
    rail: Z4_RAIL,
    term: "Z4",
    zone: "Rebaixamento",
    where: `as ${ZONE_DEPTH_WORD} últimas posições`,
  },
];

/** The row separator. It lives on every cell because the table is
 *  `border-separate` (see below), and that model does not paint borders set on
 *  a `<tr>` at all. */
const ROW_LINE = "border-t border-outline-variant";

/** The two frozen columns. `#` is pinned flush left and given a fixed width so
 *  Clube can be offset by exactly that much — an auto-sized first column would
 *  put the second one a few pixels off, which reads as a rendering bug. Each
 *  carries its own background, since the cells that slide beneath them would
 *  otherwise show through. */
const STICKY_POSITION = "sticky left-0 z-10 w-12";

/** `w-0` does not make the column zero wide — it makes it *content* wide, and
 *  that is the whole point.
 *
 *  The table carries a `min-w` so the numbers keep room to breathe on a narrow
 *  screen, which means it is routinely wider than its content and auto layout
 *  has surplus to hand out. It hands it to the widest column, and the widest
 *  column is this one: Clube rendered 219px against 137px of content at 360dp,
 *  so 82px of empty space sat *inside a frozen column*, where it is subtracted
 *  from the viewport permanently rather than scrolling away. That left 59px of
 *  a 326px container for all seven data columns.
 *
 *  A specified width below the column's minimum is clamped up to it, so `w-0`
 *  says "take what you need and no more" and the surplus goes to the columns
 *  that scroll. It also needs no maintenance: a promoted club with a longer
 *  name widens the column by itself, where a hand-tuned `w-40` would clip it.
 *
 *  `whitespace-nowrap` is load-bearing rather than tidy-up. A table column's
 *  minimum is the widest *unbreakable* run, so without it the clamp lands far
 *  lower and the browser buys the difference by wrapping the state onto a
 *  second line — 12 of 20 rows went from 37px to 57px tall. That reads as a
 *  narrower column to anything measuring width alone, which is exactly how it
 *  survived the first round of measurements here. */
const STICKY_CLUB = "sticky left-12 z-10 w-0 whitespace-nowrap border-r border-outline-variant";

/** Clube is the only column whose padding is worth a breakpoint: it is frozen,
 *  so every pixel it takes is one the numbers never get back, and only a narrow
 *  screen is short of them. Desktop keeps `px-3` — though note the column does
 *  narrow there too (254px to 175px), because `w-0` above stops it absorbing
 *  surplus at every width, not just this one. */
const CLUB_PADDING = "px-2 sm:px-3";

/** The campanha column, which takes its content width and no more.
 *
 *  Auto layout hands a table's surplus width to its widest column, and with
 *  Clube pinned by `w-0` above, the widest column is this one. At 1280px it
 *  rendered 164px around a 72px mark, so some 90px of blank sat between the end
 *  of the sparkline and the J column — a hole in the middle of the row rather
 *  than spacing, since nothing in the cell grows to fill it.
 *
 *  `w-0` clamps up to the column's minimum, exactly as it does for Clube: the
 *  column takes the 72px mark (the header word is unbreakable but narrower, at
 *  70px) and the surplus goes to the tallies, which share it evenly.
 *
 *  The mark itself stays 72px. Stretching it to fill the column is the other
 *  way to close the gap and it is the wrong one — `RankSparkline` keeps one
 *  geometry across the table and the club page so a reader recognises the same
 *  shape in both, and a width that followed the viewport would not. */
const CAMPAIGN_COLUMN = "w-0 px-3";

interface StandingsTableProps {
  rows: StandingsRow[];
  /** Receives the club's URL key (slug, or code as a fallback). Omit to render
   *  plain text — the table stays useful without a drill-down. */
  onSelectClub?: (key: string) => void;
  /** Each club's position after every round. Omit and the campanha column is
   *  left out entirely — the table predates it and still stands without it. */
  rankHistory?: ClubRankHistory[];
  /**
   * The club this reader follows, if any — **Meu time**.
   *
   * Marks one row rather than colouring it. A background would have to be set
   * on every cell including the two frozen ones, which carry their own
   * `bg-surface` precisely so the rows underneath do not show through while
   * scrolling; and it would put text on a container the contrast gate has never
   * measured, since that gate checks `canvas`, `surface` and `raised` and
   * nothing else. A glyph in the club cell costs neither.
   */
  followedCode?: ClubCode;
  /**
   * Which mark the campanha column draws, and the way to flip it.
   *
   * Owned by `App` and not by this table, even though this is where the control
   * renders, because the Clube and Partida pages draw the same campanha and
   * follow the same choice. A hook called independently in each of the three
   * would give each its own copy of one preference — they agree today only
   * because a route change unmounts the others, which is a property of the
   * router rather than a decision anybody made. Same shape as `useTheme`, which
   * `App` owns and `NavBar` renders the control for.
   *
   * Omit and the column draws the line it always drew, with no control — the
   * table stands without the choice, as it does without the campanha itself.
   */
  plotKind?: CampaignPlotKind;
  onTogglePlotKind?: () => void;
}

export function StandingsTable({
  rows,
  onSelectClub,
  rankHistory,
  followedCode,
  plotKind = "line",
  onTogglePlotKind,
}: StandingsTableProps) {
  const campaigns = useMemo(
    () => new Map<ClubCode, RankAtRound[]>((rankHistory ?? []).map((c) => [c.clubCode, c.entries])),
    [rankHistory],
  );

  /** One x domain for the whole table — see `lastRecordedRound`. */
  const lastRound = useMemo(() => lastRecordedRound(rankHistory ?? []), [rankHistory]);

  // Nothing to draw before the fixtures land. Rendering the column empty would
  // read as twenty broken cells rather than as data still in flight.
  const showCampaign = lastRound > 0;

  return (
    <>
      {/* Above the table and **outside the `Surface` below**, for the reason the
          zone key sits below and outside it: that Surface is the horizontal
          scroll container, and Campanha is one of the columns that scrolls — so
          a control placed within it slides away on exactly the narrow screen
          where the reader would reach for it, and never on the desktop where
          this would be checked.

          Not in the column header either, which is where it looks like it
          belongs. `CAMPAIGN_COLUMN` is `w-0` so the column measures its 72px
          mark and no more; a control in that `<th>` would become the column's
          widest content and take the table's surplus straight back — the exact
          regression the "no wider than the mark it holds" spec was written
          for. */}
      {showCampaign && onTogglePlotKind && (
        <div className="mb-2 flex justify-end">
          <CampaignPlotToggle kind={plotKind} onToggle={onTogglePlotKind} />
        </div>
      )}

      <Surface className="overflow-x-auto">
        {/* `border-separate` rather than the default collapse: in the collapsed
            model a cell's borders belong to the table, so they scroll out from
            under a sticky cell and the zone rail vanishes mid-scroll.

            Both `min-w` values grew by 3rem when the % column arrived, which is
            less than the column measures (66px at 360dp): the balance comes off
            the tallies, which take 50px for a two-digit number and have it to
            spare. The frozen pair is unaffected either way — `w-0` pins Clube to
            its content, so the proportion the narrow-screen spec measures does
            not move with this number. */}
        <table
          className={`w-full border-separate border-spacing-0 text-body-medium ${
            showCampaign ? "min-w-[43rem]" : "min-w-[37rem]"
          }`}
        >
          <caption className="sr-only">Classificação do Campeonato Brasileiro Série A</caption>
          <thead className="bg-surface-container-low text-label-medium uppercase text-ink-muted">
            <tr>
              <th scope="col" className={`${STICKY_POSITION} bg-surface-container-low px-3 py-2 text-left`}>#</th>
              <th scope="col" className={`${STICKY_CLUB} ${CLUB_PADDING} bg-surface-container-low py-2 text-left`}>Clube</th>
              <th scope="col" className="px-2 py-2 text-right">P</th>
              {/* Beside the points rather than after SG: the campanha is read
                  against the total, and a narrow screen scrolls the tallies away
                  from it rather than it away from the tallies. */}
              {showCampaign && <th scope="col" className={`${CAMPAIGN_COLUMN} py-2 text-left`}>Campanha</th>}
              <th scope="col" className="px-2 py-2 text-right">J</th>
              <th scope="col" className="px-2 py-2 text-right">V</th>
              <th scope="col" className="px-2 py-2 text-right">E</th>
              <th scope="col" className="px-2 py-2 text-right">D</th>
              <th scope="col" className="px-2 py-2 text-right">SG</th>
              {/* Last, where every Brazilian table puts it — the column the
                  header list P J V E D SG stops one short of. */}
              <th scope="col" className="px-2 py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.club.code}>
                <td
                  className={`${ROW_LINE} ${STICKY_POSITION} ${zoneClass(row.position, rows.length)} bg-surface px-3 py-2 tabular-nums text-ink-muted`}
                >
                  {row.position}
                </td>
                <td className={`${ROW_LINE} ${STICKY_CLUB} ${CLUB_PADDING} bg-surface py-2 font-medium`}>
                  <span className="mr-2 inline-flex align-middle">
                    <ClubCrest club={row.club} size={18} />
                  </span>
                  {row.club.code === followedCode && (
                    <>
                      <StarGlyph filled className="mr-1 inline-block h-[1em] w-[1em] align-[-0.125em] text-primary" />
                      {/* The star says which row to a reader who can see it and
                          nothing at all to one who cannot, so the fact is carried
                          in text as well. */}
                      <span className="sr-only">Meu time: </span>
                    </>
                  )}
                  {/* Name and state are separate elements: they are distinct data,
                      and running them together reads as one string to assistive
                      tech and to any text-based assertion. */}
                  {onSelectClub ? (
                    <a
                      href={formatRoute({ section: "clube", key: clubKey(row.club) })}
                      onClick={(event) => {
                        // Let modified clicks open a new tab, as any link should.
                        if (
                          event.metaKey || event.ctrlKey || event.shiftKey ||
                          event.altKey || event.button !== 0
                        ) {
                          return;
                        }
                        event.preventDefault();
                        onSelectClub(clubKey(row.club));
                      }}
                      className={`rounded-x-small ${LINK_UNDERLINE}`}
                    >
                      {row.club.shortName}
                    </a>
                  ) : (
                    <span>{row.club.shortName}</span>
                  )}
                  {row.club.state && (
                    <span className="ml-2 text-body-small text-ink-faint">{row.club.state}</span>
                  )}
                </td>
                <td className={`${ROW_LINE} px-2 py-2 text-right font-semibold tabular-nums`}>{row.points}</td>
                {showCampaign && (
                  <td className={`${ROW_LINE} ${CAMPAIGN_COLUMN} py-2`}>
                    <RankSparkline
                      entries={campaigns.get(row.club.code) ?? []}
                      clubCount={rows.length}
                      lastRound={lastRound}
                      kind={plotKind}
                    />
                  </td>
                )}
                <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>{row.played}</td>
                <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>{row.wins}</td>
                <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>{row.draws}</td>
                <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>{row.losses}</td>
                <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>
                  {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                </td>
                {/* An em dash rather than `0%` before a club has played: taking
                    nothing from five matches is 0% and having played none is an
                    absence, and only one of those is a claim about the club. */}
                <td className={`${ROW_LINE} px-2 py-2 text-right tabular-nums text-ink-muted`}>
                  {pointsPercentageLabel(row) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>

      {/* Outside the Surface above, deliberately: that Surface *is* the scroll
          container, so a key placed within it slides off to the left the moment
          the table is scrolled — on exactly the narrow screen where the reader
          most needs it, and never on the desktop where this would be checked.
          It lives in this component rather than at the call site because it
          describes `zoneClass`, which lives here; a key one file away from the
          rule it explains is a key that goes stale unnoticed.

          Nothing to explain before the rows land: with no rows there is no
          rail, and a key to marks that are not on the page reads as a fault. */}
      {rows.length > 0 && (
        <ul
          aria-label="Legenda das zonas da classificação"
          className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-body-small text-ink-muted"
        >
          {ZONE_KEY.map((zone) => (
            <li key={zone.term} className="flex items-center gap-2">
              {/* The swatch repeats the rail's own utilities rather than
                  restating its colour, so the reader matches one mark to the
                  other. Hidden from assistive tech for the reason the crests
                  carry an empty `alt`: it says exactly what the text beside it
                  says, and naming it would announce each zone twice. */}
              <span aria-hidden="true" className={`${zone.rail} inline-block h-4`} />
              <span>
                <span className="font-semibold text-on-surface-variant">{zone.term}</span> {zone.zone} —{" "}
                {zone.where}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
