import {
  clubsOf,
  highlightsSearchUrl,
  highlights,
  hasHighlights,
  refereeRoleLabel,
} from "@/match-core";
import { goalLabel, goalsBySide } from "@/goals-core";
import { bySection, lineupFor } from "@/escalacao-core";
import { stadiumSlug, venueName } from "@/venue-core";
import { STADIUMS } from "@/src/data/stadiums";
import { BroadcasterMark } from "@/src/components/BroadcasterMark";
import { controlClasses } from "@/src/components/Button";
import { ClubCrest } from "@/src/components/ClubCrest";
import { WikipediaLink } from "@/src/components/ClubLinks";
import { clubKey } from "@/club-core";
import { BACK_LINK, STATE_LAYER, LINK_UNDERLINE } from "@/src/components/interaction";
import { lastRecordedRound } from "@/rank-history-core";
import type { CampaignPlotKind } from "@/campaign-plot-core";
import { CampaignPlotToggle } from "@/src/components/CampaignPlotToggle";
import { RankSparkline } from "@/src/components/RankSparkline";
import { formatRoute } from "@/route-core";
import { StatusChip } from "@/src/components/StatusChip";
import { Surface } from "@/src/components/Surface";
import type { Club, ClubRankHistory, Goal, Lineup, Match, RankAtRound } from "@/src/types";

interface MatchPageProps {
  match: Match | null;
  /** Whether the first load is still in flight. Without it a missing match and
   *  a payload that has not arrived look the same, and the page picks wrong. */
  loading?: boolean;
  clubs: Club[];
  onBack: () => void;
  onNavigate: (path: string) => void;
  /** Every club's campanha. Omit and the section is left out entirely. */
  rankHistory?: ClubRankHistory[];
  /**
   * Which mark both campanhas are drawn as, and the way to flip it — one choice
   * shared with the Classificação and the Clube page, owned by `App`. Omit and
   * the section draws lines with no control.
   */
  plotKind?: CampaignPlotKind;
  onTogglePlotKind?: () => void;
}

const kickoffLabel = (kickoff: string): string => {
  const parsed = new Date(kickoff);
  if (Number.isNaN(parsed.getTime())) return "Horário a definir";

  return parsed.toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * One club's campanha, stacked with its opponent's rather than drawn on shared
 * axes in two colours.
 *
 * Two lines in one box would compare better, but only by introducing a
 * categorical palette: this app has semantic tokens and no series colours, so a
 * second hue would need a CVD-safe pair, a legend, and a rule for which club
 * gets which — none of which exists yet, for one chart. Stacked small multiples
 * compare almost as well, because the two share one scale and their rounds line
 * up vertically, and they keep the mark identical to the Classificação and the
 * club page.
 */
function Campaign({
  club,
  code,
  entries,
  clubCount,
  lastRound,
  kind,
}: {
  club: Club | null;
  code: string;
  entries: RankAtRound[];
  clubCount: number;
  lastRound: number;
  kind: CampaignPlotKind;
}) {
  const first = entries[0];
  const last = entries[entries.length - 1];

  return (
    <div>
      <p className="mb-1 text-body-small font-medium">{club?.shortName ?? code}</p>
      <RankSparkline
        entries={entries}
        clubCount={clubCount}
        lastRound={lastRound}
        size="page"
        kind={kind}
      />
      <p className="mt-1 flex justify-between text-body-small tabular-nums text-ink-faint">
        <span>{first.position}º · 1ª rodada</span>
        <span>
          {last.position}º · {last.round}ª rodada
        </span>
      </p>
    </div>
  );
}

/**
 * A club's side of the scoreboard: crest, name, a link to its page, and its
 * article.
 *
 * The article is the one *external* link here, and it sits a type step below
 * the name deliberately. The scoreboard's job is the score; a second link at
 * the same weight as the club name would read as two equal destinations and
 * pull the eye off the middle of the card. The club's other three links stay on
 * the club page, one tap away through the name above — repeating all four
 * beside each side would put eight external links around a scoreline.
 */
function Side({ club, code, onNavigate }: { club: Club | null; code: string; onNavigate: (p: string) => void }) {
  const label = club?.shortName ?? code;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      {club && <ClubCrest club={club} size={56} />}
      {club ? (
        <a
          href={formatRoute({ section: "clube", key: clubKey(club) })}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
            event.preventDefault();
            onNavigate(formatRoute({ section: "clube", key: clubKey(club) }));
          }}
          className={`truncate font-semibold ${LINK_UNDERLINE}`}
        >
          {label}
        </a>
      ) : (
        <span className="truncate font-semibold">{label}</span>
      )}
      {club && <WikipediaLink title={club.wikipedia} subject="do clube" extra="text-body-small" />}
    </div>
  );
}

/**
 * One club's scorers, under its half of the scoreboard.
 *
 * The club is named only for a screen reader. Sighted readers have the crest
 * and the name directly above, and repeating it would put the club's name twice
 * in eight vertical pixels — but a list of bare surnames read aloud, with no
 * indication of which side scored them, says nothing at all. Same reasoning as
 * the `Meu time: ` prefix in the classificação: announced beside the value
 * rather than replacing it.
 *
 * An empty side still renders its (empty) column, so the two stay aligned under
 * the two crests rather than one sliding across to fill the row.
 */
/**
 * One club's team sheet: the eleven, then the bench.
 *
 * Shirt numbers are `tabular-nums` and right-aligned in their own column so the
 * names start on one edge — a lineup is scanned down the numbers, and a ragged
 * left margin is what makes a list of 23 names hard to read.
 */
function LineupColumn({ lineup, name }: { lineup: Lineup; name: string }) {
  const { starters, bench } = bySection(lineup);
  const row = (player: { name: string; shirt: string; keeper?: true }) => (
    <li key={`${player.shirt}-${player.name}`} className="flex gap-2">
      <span className="w-6 shrink-0 text-right tabular-nums text-ink-faint">{player.shirt}</span>
      <span className="truncate">
        {player.name}
        {/* The keeper is the one position a team sheet always marks, and it is
            the only one CBF reports. Naming the rest would mean guessing. */}
        {player.keeper && <span className="ml-1 text-ink-faint">(GOL)</span>}
      </span>
    </li>
  );
  return (
    <div data-lineup={lineup.clubCode}>
      <h4 className="mb-1 text-body-small font-semibold">{name}</h4>
      <ul className="space-y-0.5 text-body-small text-on-surface-variant">
        {starters.map(row)}
      </ul>
      {bench.length > 0 && (
        <>
          <p className="mt-2 mb-1 text-body-small text-ink-faint">Reservas</p>
          <ul className="space-y-0.5 text-body-small text-on-surface-variant" data-bench>
            {bench.map(row)}
          </ul>
        </>
      )}
    </div>
  );
}

function GoalColumn({
  goals,
  club,
  code,
  side,
}: {
  goals: Goal[];
  club: Club | null;
  code: string;
  side: "home" | "away";
}) {
  // Still a column, so the two sides stay under the two crests rather than one
  // sliding across to fill the row. `data-goals` rides on the wrapper either
  // way, so a spec can assert a side scored nothing.
  if (goals.length === 0) return <div data-goals={side} />;

  return (
    <div data-goals={side}>
      <p className="sr-only">Gols do {club?.shortName ?? code}</p>
      <ul className="space-y-0.5 text-center text-body-small text-ink-muted">
        {goals.map((goal, index) => (
          <li key={`${goal.scorer}-${index}`} data-goal className="truncate">
            {goalLabel(goal)}
            {/* The minute sits *after* the name and a space, in a fainter ink,
                because the scorer is what a reader is looking for and the
                minute is what they read next. `tabular-nums` so a column of
                them lines up rather than shimmying by a pixel per digit.
                Absent for a goal whose súmula was not read — no dash, no
                placeholder, the rule the rest of this page follows. */}
            {goal.minute && (
              <span className="ml-1 tabular-nums text-ink-faint">{goal.minute}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * One fixture in full: scoreboard, kickoff, venue, and either where to watch it
 * or where to find its goals.
 *
 * Every field beyond the score is optional — the provider supplies no venue and
 * no broadcast data, both arriving from the CBF sync — so each section renders
 * only when its data exists rather than showing an empty row.
 */
export function MatchPage({
  match,
  loading = false,
  clubs,
  onBack,
  onNavigate,
  rankHistory,
  plotKind = "line",
  onTogglePlotKind,
}: MatchPageProps) {
  if (!match) {
    return (
      <>
        <button type="button" onClick={onBack} className={BACK_LINK}>
          ← Voltar
        </button>
        <p className="mt-4 text-body-medium text-ink-muted" role={loading ? "status" : undefined}>
          {loading ? "Carregando página…" : "Partida não encontrada."}
        </p>
      </>
    );
  }

  const { home, away } = clubsOf(match, clubs);
  const campaignOf = (code: string) =>
    rankHistory?.find((entry) => entry.clubCode === code)?.entries ?? [];
  const homeCampaign = campaignOf(match.homeCode);
  const awayCampaign = campaignOf(match.awayCode);
  const lastRound = lastRecordedRound(rankHistory ?? []);
  // Both or neither: one club's season drawn beside a gap invites the reading
  // that the other has not played, rather than that we lack its history.
  const showCampaigns =
    lastRound > 0 && homeCampaign.length > 0 && awayCampaign.length > 0;
  const venue = match.venue;
  // Absent and empty are the same thing to a reader, and both render nothing —
  // the player card's rule. Upstream names nobody for 223 of the season's 380
  // fixtures, so that is the common case rather than the edge one.
  const officials = match.referees ?? [];
  const videos = highlights(match);
  const played = match.homeGoals !== null && match.awayGoals !== null;
  // Absent means "not synced", never "goalless" — so a 0-0 and an unsynced
  // match both render nothing here, and the scoreline above is what tells a
  // reader which of the two they are looking at.
  const scorers = goalsBySide(match);
  // **Gated on `played`, not merely on having goals**, and the reason is the
  // seed/live split rather than defensiveness in the abstract. `goals.ts` is
  // synced against the live provider while `src/data/matches.ts` is a frozen
  // snapshot, so a fixture played after the snapshot was taken carries scorers
  // while the committed record still calls it SCHEDULED with no score. Two of
  // round 25's fixtures were in exactly that state the day this landed.
  //
  // **`withGoals` now drops such a list at the edge**, on the stronger test of
  // whether it reconciles with the scoreline at all — so for anything served by
  // `/api/matches` this gate can no longer fire, since goals only survive that
  // merge where both scores are present. It is kept because this is a pure
  // component: a `Match` handed to it directly, by a test or by any future
  // caller that does not go through the merge, has passed no such check.
  const hasScorers = played && scorers.home.length + scorers.away.length > 0;
  // Both sides or neither: `lineupsReconcile` refuses to record half a fixture,
  // so a page never shows one team sheet next to an empty column.
  const homeLineup = lineupFor(match, match.homeCode);
  const awayLineup = lineupFor(match, match.awayCode);

  return (
    <>
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Voltar
      </button>

      {/* `as="article"` on purpose: this is the page's main card, and rendering
          it as a bare div would change the document outline. */}
      <Surface as="article" filled className="mt-3 p-5">
        <div className="flex items-center justify-between gap-2 text-body-small text-ink-faint">
          <span>{match.round}ª rodada</span>
          <StatusChip status={match.status} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Side club={home} code={match.homeCode} onNavigate={onNavigate} />

          {/* The one number the whole page exists for, in a tray of its own.
              It was distinguished by weight alone, on the same background as
              everything else in the card.

              **`surface-container-lowest`, not `surface-dim`** — and that was
              measured rather than chosen. MD3's role for a step *below* a card
              is `surface-dim`, which is what this item was written against; it
              was emitted at MD3's own tones and the contrast gate refused the
              palette, because on light every ink has to clear a surface darker
              than `surface-container` and this one is already at its limit
              there (`ink-faint` clears it by 0.09). Tried tone by tone: at 93,
              the darkest that came close, the faintest ink still measured 4.49
              against a 4.5 floor and the tray had faded to 1.08 against the
              card. **There is no tone this palette can carry that also reads as
              a tray.**

              Elevation is the way through, and it is MD3's own model rather
              than a workaround: the tray is *lower* than the card, and a lower
              surface is darker on dark and brighter on light. So on dark it is
              genuinely inset (tone 4 against the card's 10) and on light it
              reads as a well (100 against 96) — which is the light-theme
              convention anyway. Every ink is **better** on it than on the card
              in both themes (3.75 vs 3.39 light, 4.30 vs 3.81 dark), so unlike
              `surface-dim` it cannot introduce a failure.

              `rounded-small` because it is a panel, not because it is nested —
              the shape rule in `src/index.css` says a step is chosen by what a
              thing is, and warns against reading depth into it. */}
          <div className="shrink-0 rounded-small bg-surface-container-lowest px-4 py-2 text-center" data-placar>
            {played ? (
              <p className="text-headline-medium font-bold tabular-nums">
                {match.homeGoals} <span className="text-ink-ghost">×</span> {match.awayGoals}
              </p>
            ) : (
              <p className="text-headline-small font-bold text-ink-ghost">×</p>
            )}
          </div>

          <Side club={away} code={match.awayCode} onNavigate={onNavigate} />
        </div>

        {/* Inside the scoreboard card rather than in a section of its own: these
            names are what the numbers above are made of, and a heading between
            them would read as a separate topic. */}
        {hasScorers && (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-outline-variant pt-3">
            <GoalColumn goals={scorers.home} club={home} code={match.homeCode} side="home" />
            <GoalColumn goals={scorers.away} club={away} code={match.awayCode} side="away" />
          </div>
        )}
      </Surface>

      <dl className="mt-4 space-y-3 text-body-medium">
        <div>
          <dt className="text-body-small text-ink-faint">Data e hora</dt>
          <dd className="font-medium first-letter:uppercase">{kickoffLabel(match.kickoff)}</dd>
        </div>

        {venue && (
          <div>
            <dt className="text-body-small text-ink-faint">Estádio</dt>
            {/* Only the ground is a link; the city and state stay text, because
                they describe the ground rather than leading anywhere of their
                own. The name comes from `venueName` so it matches the heading
                of the page it opens — CBF writes "ARENA MRV". */}
            <dd className="font-medium">
              <a
                href={formatRoute({ section: "estadio", key: stadiumSlug(venue.stadium) })}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  onNavigate(formatRoute({ section: "estadio", key: stadiumSlug(venue.stadium) }));
                }}
                className={LINK_UNDERLINE}
              >
                {venueName(venue, STADIUMS)}
              </a>
              {` · ${venue.city} – ${venue.state}`}
            </dd>
          </div>
        )}

        {/* One row per official, labelled by role rather than gathered under a
            single "Arbitragem" heading: the provider sends exactly one entry
            per match today, so the specific word is the honest one and the list
            extends by itself if assistants ever arrive. */}
        {officials.map((official) => (
          <div key={`${official.role}-${official.name}`}>
            <dt className="text-body-small text-ink-faint">
              {refereeRoleLabel(official.role)}
            </dt>
            <dd className="font-medium">{official.name}</dd>
          </div>
        ))}

        {match.broadcasters && (
          <div>
            <dt className="text-body-small text-ink-faint">Onde assistir</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-1.5">
              {match.broadcasters.map((name) => (
                <BroadcasterMark key={name} name={name} />
              ))}
            </dd>
          </div>
        )}
      </dl>

      {homeLineup && awayLineup && (
        <section className="mt-6">
          {/* Closed by default, and the reason is the same one PlayersView
              gives for its clubs: 46 names rendered open would push the
              campanhas and the melhores momentos off the bottom of the page,
              and those are what the rest of this view is about. Collapsed it
              costs one row.

              A native `<details>` rather than a button and a piece of state —
              disclosure semantics, keyboard behaviour and `aria-expanded` for
              free. The summary must NOT be `display: flex` or Chrome drops the
              marker, which is what pushes people toward drawing a chevron by
              hand; `PlayersView` records the whole trap. */}
          <details>
            <summary
              className={`cursor-pointer rounded-small px-3 py-3 text-on-surface marker:text-ink-muted ${STATE_LAYER}`}
            >
              <h3 className="inline align-middle text-body-medium font-medium text-ink-muted">
                Escalações
              </h3>
            </summary>
            <div className="mt-3 grid gap-6 px-3 sm:grid-cols-2">
              <LineupColumn lineup={homeLineup} name={home?.shortName ?? match.homeCode} />
              <LineupColumn lineup={awayLineup} name={away?.shortName ?? match.awayCode} />
            </div>
          </details>
        </section>
      )}

      {showCampaigns && (
        <section className="mt-6">
          {/* One control for the section, not one per club: the two campanhas
              are read against each other, and a page that could draw one as a
              line and the other as bars would be comparing two pictures rather
              than two clubs. */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-body-medium font-medium text-ink-muted">Campanha</h3>
            {onTogglePlotKind && (
              <CampaignPlotToggle kind={plotKind} onToggle={onTogglePlotKind} />
            )}
          </div>
          {/* Stacked, not side by side: the rounds line up vertically, so "who
              was above whom in round 12" is read by looking straight down. */}
          <Surface filled className="space-y-4 px-3 py-3">
            <Campaign
              club={home}
              code={match.homeCode}
              entries={homeCampaign}
              clubCount={rankHistory?.length ?? 0}
              lastRound={lastRound}
              kind={plotKind}
            />
            <Campaign
              club={away}
              code={match.awayCode}
              entries={awayCampaign}
              clubCount={rankHistory?.length ?? 0}
              lastRound={lastRound}
              kind={plotKind}
            />
          </Surface>
        </section>
      )}

      {hasHighlights(match) && (
        <section className="mt-6">
          <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Melhores momentos</h3>

          {/* Curated links beat the search: they point at the rights holders'
              own packages rather than whatever a query happens to surface.
              Several broadcasters cover the same match, so all are offered and
              labelled by channel — the reader picks. */}
          {videos.length > 0 ? (
            <>
              <ul className="flex flex-wrap gap-2">
                {videos.map((video) => (
                  <li key={video.url}>
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      // Tonal: this is a curated link to the actual video, and
                      // it sits beside a fallback that only guesses. They read
                      // identically before M4 despite the comment above saying
                      // they are not the same kind of answer.
                      className={controlClasses("md", "inline-flex items-center gap-2", "tonal")}
                    >
                      <span aria-hidden="true">▶</span>
                      {/* The publisher is a broadcaster like any other, so it
                          wears the same mark it wears under "Onde assistir".
                          The mark carries the channel name as its alt, so the
                          link still reads aloud as "ge tv". */}
                      <BroadcasterMark name={video.channel} size="sm" decorative />
                      <span className="sr-only">
                        {video.channel} — melhores momentos no YouTube (abre em nova
                        aba)
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-body-small text-ink-faint">
                {videos.length === 1
                  ? "Melhores momentos no YouTube."
                  : "Melhores momentos no YouTube, por emissora."}
              </p>
            </>
          ) : (
            <>
              <a
                href={highlightsSearchUrl(
                  home?.shortName ?? match.homeCode,
                  away?.shortName ?? match.awayCode,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className={controlClasses("md", "inline-flex items-center gap-2")}
              >
                <span aria-hidden="true">▶</span>
                Procurar melhores momentos no YouTube
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
              {/* Honest about what this is: without a curated link we do not
                  know the official video, so this opens a search and says so. */}
              <p className="mt-2 text-body-small text-ink-faint">
                Abre uma busca no YouTube — não é um vídeo oficial escolhido por nós.
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}
