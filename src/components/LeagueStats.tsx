import { bestAttacks, bestDefences, leagueSummary } from "@/league-stats-core";
import { clubKey } from "@/club-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { formatRoute } from "@/route-core";
import { Surface } from "@/src/components/Surface";
import type { Match, StandingsRow } from "@/src/types";

/**
 * **Números da temporada** — the figures the Classificação implies and does not
 * state, beneath the table they summarise.
 *
 * **Not a sixth `NAV_ITEMS` entry, and that is the design decision here rather
 * than a placement preference.** MD3's navigation bar carries three to five
 * destinations, there are five, and the fifth one's padding had to be measured
 * at 320/360/375dp to fit at all — a sixth breaks nothing, reddens nothing and
 * is off-spec, which is exactly why refusing it has to be written down. If this
 * ever genuinely wants to be a destination, that is the MD3 navigation *drawer*
 * conversation and should be opened as one.
 *
 * Every figure is a reduction over data the client already holds, so the panel
 * costs no request — the same argument the campanha makes for deriving itself
 * from `/api/matches`.
 */

/** One figure: the number large, its name beneath, as the club page's tiles do. */
function Figure({
  name,
  label,
  value,
  hint,
}: {
  /** A stable handle for the specs, so they need not regex rendered prose —
   *  the same reason `BroadcasterMark` keeps `data-mark`. */
  name: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Surface filled data-figure={name} className="px-3 py-2">
      <p className="text-body-small text-ink-faint">{label}</p>
      <p data-value className="font-semibold tabular-nums">{value}</p>
      {hint && <p data-hint className="text-body-small text-ink-faint">{hint}</p>}
    </Surface>
  );
}

function Leaderboard({
  title,
  rows,
  value,
  onSelectClub,
}: {
  title: string;
  rows: StandingsRow[];
  value: (row: StandingsRow) => string;
  onSelectClub?: (key: string) => void;
}) {
  return (
    <Surface filled className="px-3 py-2">
      <h4 className="mb-1 text-body-small text-ink-faint">{title}</h4>
      <ol className="space-y-1">
        {rows.map((row) => (
          <li key={row.club.code} className="flex items-center gap-2 text-body-medium">
            <ClubCrest club={row.club} size={18} />
            {onSelectClub ? (
              <a
                href={formatRoute({ section: "clube", key: clubKey(row.club) })}
                onClick={(event) => {
                  if (
                    event.metaKey || event.ctrlKey || event.shiftKey ||
                    event.altKey || event.button !== 0
                  ) {
                    return;
                  }
                  event.preventDefault();
                  onSelectClub(clubKey(row.club));
                }}
                className={`min-w-0 truncate rounded-x-small ${LINK_UNDERLINE}`}
              >
                {row.club.shortName}
              </a>
            ) : (
              <span className="min-w-0 truncate">{row.club.shortName}</span>
            )}
            <span className="ml-auto font-semibold tabular-nums">{value(row)}</span>
          </li>
        ))}
      </ol>
    </Surface>
  );
}

export function LeagueStats({
  rows,
  matches,
  onSelectClub,
}: {
  rows: StandingsRow[];
  matches: Match[];
  onSelectClub?: (key: string) => void;
}) {
  const summary = leagueSummary(matches);

  // Nothing has been played. Rendering zeros would claim the season is
  // producing no goals, where the truth is that it has not started — so the
  // panel is absent rather than empty, the same answer `showCampaign` gives.
  if (summary.played === 0) return null;

  const attacks = bestAttacks(rows);
  const defences = bestDefences(rows);

  return (
    <section className="mt-6" data-league-stats>
      <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Números da temporada</h3>

      <div className="grid gap-2 sm:grid-cols-3">
        <Figure
          name="gols"
          label="Gols"
          value={String(summary.goals)}
          hint={`em ${summary.played} ${summary.played === 1 ? "jogo" : "jogos"}`}
        />
        {/* One decimal, because the second is noise at this scale and the first
            is the whole of what separates a tight season from an open one. */}
        <Figure name="gols-por-jogo" label="Gols por jogo" value={summary.goalsPerMatch!.toFixed(1).replace(".", ",")} />
        {/* "Vitórias do mandante", never "aproveitamento dos mandantes" — which
            is what the proposal called it. **Aproveitamento** is a defined term
            in CONTEXT.md meaning points taken over points available, and reusing
            it for a share of matches would give one word two meanings on one
            screen. The glossary exists for exactly this. */}
        <Figure
          name="vitorias-do-mandante"
          label="Vitórias do mandante"
          value={`${Math.round(summary.homeWinShare!)}%`}
          hint={`${summary.homeWins} de ${summary.played}`}
        />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <Leaderboard
          title="Melhores ataques"
          rows={attacks}
          value={(row) => `${row.goalsFor}`}
          onSelectClub={onSelectClub}
        />
        <Leaderboard
          title="Melhores defesas"
          rows={defences}
          value={(row) => `${row.goalsAgainst}`}
          onSelectClub={onSelectClub}
        />
      </div>
    </section>
  );
}
