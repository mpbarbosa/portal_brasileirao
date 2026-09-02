import { formatRoute } from "@/route-core";
import { BroadcasterMark } from "@/src/components/BroadcasterMark";
import { CLUBS_BY_CODE } from "@/src/data/clubs";
import { FIXTURE_ROW, FixtureSides } from "@/src/components/FixtureSides";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { StatusChip } from "@/src/components/StatusChip";
import { Surface } from "@/src/components/Surface";
import type { Club, ClubCode, Match } from "@/src/types";

const kickoffLabel = (kickoff: string): string => {
  const parsed = new Date(kickoff);
  if (Number.isNaN(parsed.getTime())) return "Horário a definir";

  return parsed.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Resolve a club code to the club itself, or to nothing.
 *
 * A `Match` carries codes, never clubs, so every surface that renders a fixture
 * needs this — and it is exported rather than written twice because the
 * fallback chain *is* the logic: the payload's own club list first (which is
 * the only one that holds a club the seed snapshot has never heard of), and the
 * committed snapshot second.
 *
 * It stops there, and `clubNamer` below is what adds the bare code. That split
 * is the whole reason this exists separately: a **name** can always fall back
 * to the code, because a row reading `1783` is still a row; a **crest** cannot,
 * because there is no mark to draw for a club nothing knows about, and an
 * invented one would be a mark meaning nothing. Callers that want a crest get
 * `null` and leave the slot empty — the same absence `ClubCrest` already
 * renders for a crestless club.
 *
 * Deliberately *not* `clubsOf` from `match-core.ts`, which resolves both sides
 * of a match at once and consults **only** the list handed to it. That is right
 * for a page holding the payload it was rendered from; it is wrong here, where
 * the snapshot is what names a club during an outage.
 */
export const clubResolver = (clubs?: Club[]): ((code: ClubCode) => Club | null) => {
  const byCode = new Map(clubs?.map((club) => [club.code, club]));
  return (code) => byCode.get(code) ?? CLUBS_BY_CODE.get(code) ?? null;
};

/**
 * Resolve a club code to the name a fixture row should print.
 *
 * Built on `clubResolver` rather than repeating its two lookups, so the two
 * cannot come to disagree about which list wins — a second copy that stopped at
 * the snapshot would silently print `1783` for a promoted club. The bare code
 * is this function's own last resort, for the reason given above.
 */
export const clubNamer = (clubs?: Club[]): ((code: ClubCode) => string) => {
  const resolve = clubResolver(clubs);
  return (code) => resolve(code)?.shortName ?? code;
};

interface MatchListProps {
  matches: Match[];
  clubs?: Club[];
  /** Omit to render plain rows — the list stands on its own. */
  onSelectMatch?: (id: string) => void;
  /**
   * An extra line under the kickoff, computed per match — the **Ao vivo**
   * page's contagem regressiva. Return null to leave a row without one.
   *
   * A callback rather than a prepared string per row, because the caller ticks:
   * the countdown is recomputed on every render from the page's clock, and a
   * map keyed by match id would have to be rebuilt each tick anyway.
   */
  note?: (match: Match) => string | null;
  /** What to say when there is nothing to list. */
  emptyLabel?: string;
}

export function MatchList({
  matches,
  clubs,
  onSelectMatch,
  note,
  emptyLabel = "Nenhuma partida nesta rodada.",
}: MatchListProps) {
  if (matches.length === 0) {
    return <p className="text-body-medium text-ink-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-2">
      {matches.map((match) => (
        /**
         * Two columns on a tablet and up; stacked on a phone.
         *
         * `StatusChip` is `shrink-0` and the fixture line is what gives way, so
         * side by side the chip costs the club names 72px of a 343px row —
         * measured at 375dp, that put **12 of 24** names into an ellipsis once
         * each side gained a crest, against 2 of 24 before. Stacking returns
         * the whole width: 0 of 24 at 375dp, 4 at 320dp.
         *
         * So the marks were never what broke this; the column was. Shrinking
         * the crest or hiding it under `sm` would each have bought back about a
         * fifth of what the chip holds, and left the board reading `Botaf… 2 ×
         * 3 Athletic…` on the device it is read on most.
         *
         * **`items-start`, never `items-center`, on the stacked axis.** A flex
         * item's cross size stretches by default, and `inline-flex` on the chip
         * does not save it — as a flex item it is blockified. Confirmed by
         * forcing `align-items: stretch` in the page: the chip went 72px to
         * 309px and stopped reading as a chip at all.
         */
        <Surface
          as="li"
          filled
          key={match.id}
          className="flex flex-col items-start gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <div className="min-w-0 max-w-full">
            {onSelectMatch ? (
              <a
                href={formatRoute({ section: "partida", id: match.id })}
                onClick={(event) => {
                  if (
                    event.metaKey || event.ctrlKey || event.shiftKey ||
                    event.altKey || event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  onSelectMatch(match.id);
                }}
                className={`${FIXTURE_ROW} font-medium ${LINK_UNDERLINE}`}
              >
                <FixtureSides match={match} clubs={clubs} />
              </a>
            ) : (
              <p className={`${FIXTURE_ROW} font-medium`}>
                <FixtureSides match={match} clubs={clubs} />
              </p>
            )}
            <p className="mt-0.5 text-body-small text-ink-faint">{kickoffLabel(match.kickoff)}</p>
            {note?.(match) && (
              <p className="mt-0.5 text-body-small text-ink-muted">{note(match)}</p>
            )}
            {match.broadcasters && (
              <p className="mt-1 flex flex-wrap items-center gap-1">
                <span className="sr-only">Onde assistir: </span>
                {match.broadcasters.map((name) => (
                  <BroadcasterMark key={name} name={name} size="sm" />
                ))}
              </p>
            )}
          </div>
          {/* Above the fixture on a phone, beside it from `sm`. Stacked, it
              would otherwise land at the foot under the broadcaster marks,
              where a status reads as an afterthought rather than as the label
              for the card it belongs to. `order-first` is one utility and puts
              it where the eye starts; `StatusChip` already takes a className,
              so this needs no wrapper element around it. */}
          <StatusChip status={match.status} className="order-first sm:order-none" />
        </Surface>
      ))}
    </ul>
  );
}
