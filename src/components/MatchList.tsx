import { formatRoute } from "@/route-core";
import { BroadcasterMark } from "@/src/components/BroadcasterMark";
import { CLUBS_BY_CODE } from "@/src/data/clubs";
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

const score = (match: Match): string =>
  match.homeGoals === null || match.awayGoals === null
    ? "×"
    : `${match.homeGoals} × ${match.awayGoals}`;

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

  const clubName = clubNamer(clubs);

  return (
    <ul className="space-y-2">
      {matches.map((match) => (
        <Surface
          as="li"
          filled
          key={match.id}
          className="flex items-center justify-between gap-4 px-4 py-3"
        >
          <div className="min-w-0">
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
                className={`block truncate font-medium ${LINK_UNDERLINE}`}
              >
                {clubName(match.homeCode)}{" "}
                <span className="font-semibold tabular-nums text-on-surface-variant">{score(match)}</span>{" "}
                {clubName(match.awayCode)}
              </a>
            ) : (
              <p className="truncate font-medium">
                {clubName(match.homeCode)}{" "}
                <span className="font-semibold tabular-nums text-on-surface-variant">{score(match)}</span>{" "}
                {clubName(match.awayCode)}
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
          <StatusChip status={match.status} />
        </Surface>
      ))}
    </ul>
  );
}
