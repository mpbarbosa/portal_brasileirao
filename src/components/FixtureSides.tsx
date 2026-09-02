import { ClubCrest } from "@/src/components/ClubCrest";
import { clubNamer, clubResolver } from "@/src/components/MatchList";
import type { Club, Match } from "@/src/types";

/**
 * The scoreline that has to be the same string everywhere it appears.
 *
 * `×` before the match is played, the two goal counts once it has been —
 * remembering that `0` is a real score and only `null` means unplayed, which is
 * the trap `countsTowardStandings` records for a 0-0.
 *
 * Exported because the **Meu time** strip needs the same string *outside* this
 * fragment: its link's accessible name is a sentence that states the score, and
 * a second copy of the null check is how a screen reader comes to hear `0 × 0`
 * for a match nobody has played.
 */
export const fixtureScore = (match: Match): string =>
  match.homeGoals === null || match.awayGoals === null
    ? "×"
    : `${match.homeGoals} × ${match.awayGoals}`;

/**
 * Both clubs of a fixture: crest, name, the scoreline, crest, name.
 *
 * Extracted at its **fourth** copy, not its second — the two branches of a
 * `MatchList` row had it twice over, and the **Meu time** strip a third time.
 * Three copies is how one surface comes to draw a crest the others do not,
 * which is exactly the state this app was in an hour ago: the strip named its
 * club with a mark, the row beside it named the same club without one.
 *
 * **It renders a fragment and owns no element**, so the caller decides what the
 * row *is* — a `MatchList` row is an `<a>` covering the whole line, the strip's
 * is a `<span>` inside a larger link, and neither can be nested in the other.
 * That is `Surface`'s rule one level down: the chrome is shared, the layout
 * belongs to the caller. `FIXTURE_ROW` is the layout the two do agree on, and
 * it is a constant beside this rather than a wrapper element for the same
 * reason.
 *
 * Two decisions inside the fragment:
 *
 * - **A crest is omitted, never substituted.** `clubResolver` answers null for
 *   a club neither the payload nor the snapshot holds, and the slot then stays
 *   empty while the name falls back to the bare code. There is no mark to draw
 *   for a club nothing knows about, and `ClubCrest` already renders exactly
 *   this absence for a club with no crest.
 * - **Both names truncate; the score never does.** `shrink-0` on the scoreline
 *   is what keeps a narrow screen losing the tails of two club names rather
 *   than the result of the match, which is the one part of the row a reader
 *   came for.
 */
export function FixtureSides({
  match,
  clubs,
  crestSize = 20,
}: {
  match: Match;
  /** Whatever club list is at hand; `clubResolver` falls back to the snapshot. */
  clubs?: Club[];
  /**
   * The mark's size in px.
   *
   * A prop rather than a constant because the two callers sit at different type
   * sizes, and `ClubCrest`'s monogram fallback is scaled from this — its own
   * comment records which sizes that was checked at, and 20 is one of them.
   */
  crestSize?: number;
}) {
  const clubName = clubNamer(clubs);
  const clubOf = clubResolver(clubs);
  const home = clubOf(match.homeCode);
  const away = clubOf(match.awayCode);

  return (
    <>
      {home && <ClubCrest club={home} size={crestSize} />}
      <span className="truncate">{clubName(match.homeCode)}</span>
      <span className="shrink-0 font-semibold tabular-nums text-on-surface-variant">
        {fixtureScore(match)}
      </span>
      {away && <ClubCrest club={away} size={crestSize} />}
      <span className="truncate">{clubName(match.awayCode)}</span>
    </>
  );
}

/**
 * The layout `FixtureSides` expects around it.
 *
 * A flex row rather than a sentence with images dropped into it, for two
 * reasons a run of inline marks gets wrong. An `<img>` sits on the text
 * baseline, so a 20px crest beside a 16px word rides low and grows the line
 * box; `items-center` is what puts the marks and the words on one optical line.
 * And a row shrinks *both* names under pressure, where truncating one string
 * loses the away side and the scoreline together.
 *
 * A constant rather than a wrapper element because the caller's element is
 * load-bearing in a way a wrapper cannot be: in a `MatchList` row the flex
 * container **is** the `<a>`, so the whole line is the target.
 */
export const FIXTURE_ROW = "flex items-center gap-1.5";
