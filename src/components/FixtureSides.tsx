import { hasScore } from "@/matches-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { clubNamer, clubResolver } from "@/src/components/MatchList";
import type { Club, Match } from "@/src/types";

/**
 * The scoreline that has to be the same string everywhere it appears.
 *
 * `×` before the match is played, the two goal counts once it has been —
 * remembering that `0` is a real score and only `null` means unplayed, which is
 * why the test is `hasScore` and never a truthiness check.
 *
 * Exported because the **Meu time** strip needs the same string *outside* this
 * fragment: its link's accessible name is a sentence that states the score, and
 * a second copy of the null check is how a screen reader comes to hear `0 × 0`
 * for a match nobody has played.
 */
export const fixtureScore = (match: Match): string =>
  hasScore(match) ? `${match.homeGoals} × ${match.awayGoals}` : "×";

/**
 * Both clubs of a fixture: name, crest, the scoreline, crest, name.
 *
 * **The two sides are mirrored, and that asymmetry is the whole of the
 * arrangement.** The home crest follows its name and the away crest precedes
 * its own, so the two marks meet either side of the scoreline instead of both
 * sitting to the left of the club they belong to. Reading outward from the `×`
 * the row is then symmetric about it — mark, mark, and each name on the far
 * side of its own — where the previous order put the away crest between the
 * home name and the score, which reads as belonging to whichever club the eye
 * reached first.
 *
 * **The home name now precedes a fixed-width mark rather than following one**,
 * which is only safe because `ClubCrest` is `shrink-0` in all three of its
 * branches — the image, the monogram and the brand mark. Without that, a flex
 * row under pressure would take the space out of whichever item yields, and the
 * mark sitting between a truncating name and the scoreline is exactly the item
 * a reader would not notice losing.
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
      <span className="truncate">{clubName(match.homeCode)}</span>
      {home && <ClubCrest club={home} size={crestSize} />}
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
 *
 * **The gap is 4px below `sm` and 6px from there up, and the 8px that buys is
 * two thirds of a real deficit rather than tidying.** Measured at 375dp on
 * production at `fe95911`: the row's content box is **309px** and the
 * division's widest pair needs **320** — `Vasco da Gama` 112.25, two 20px
 * marks, `0 × 0` 34.83, `Clube do Remo` 108.77 and four 6px gaps — so round
 * 30's own opening fixture lost 5px off one name and 6px off the other. The
 * other 8px is the card's padding, in `MatchList`, and the two are owed to
 * each other: neither closes 11px alone, and the next-worst pair in the
 * division (`Vasco da Gama` × `Chapecoense`) fits today by **0.3px**, so any
 * round pairing the top two reproduced it.
 *
 * **Chrome gave way rather than content, which is the half worth keeping.**
 * Shrinking the marks to 18px is 4px and leaves 1px of headroom — not a fix
 * anybody can stand behind — and 16px takes the monogram's type to 7px, below
 * the 8px floor `ClubCrest`'s own comment records as checked. Dropping the
 * names a type step is 28px and gives up the one thing the row is for. The
 * gap and the padding are the only levers that remove nothing, and together
 * they leave **5.1px** at the widest pair the division can field.
 *
 * It is scoped below `sm` because that is where the deficit is: from `sm` up
 * the row is beside its chip on a wide line and has never been short. That
 * also keeps all twenty-four desktop captures out of it, which is a
 * consequence rather than the reason.
 */
export const FIXTURE_ROW = "flex items-center gap-1 sm:gap-1.5";
