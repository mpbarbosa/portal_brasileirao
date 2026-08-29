import {
  clubMatches,
  coachOf,
  findClub,
  nextFixture,
  hymnUrl,
  recentForm,
  resultFor,
  scorersFor,
  standingFor,
  type FormResult,
} from "@/club-core";
import { lastRecordedRound } from "@/rank-history-core";
import { pointsPercentageLabel } from "@/standings-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { GLYPH, InstagramLink, WikipediaLink } from "@/src/components/ClubLinks";
import { BACK_LINK, LINK_UNDERLINE } from "@/src/components/interaction";
import { MatchList } from "@/src/components/MatchList";
import { FollowButton } from "@/src/components/MeuTime";
import { RankSparkline } from "@/src/components/RankSparkline";
import { Surface } from "@/src/components/Surface";
import type {
  Club,
  ClubCode,
  ClubRankHistory,
  Match,
  Scorer,
  StandingsRow,
} from "@/src/types";

interface ClubViewProps {
  /** Slug or code, straight from the URL. */
  clubKey: string;
  /** Whether the first load is still in flight. Without it an empty payload and
   *  an unknown club are indistinguishable, and the page picks the wrong one. */
  loading?: boolean;
  standings: StandingsRow[];
  matches: Match[];
  clubs?: Club[];
  scorers: Scorer[];
  onBack: () => void;
  /** Omit to render fixtures as plain text — the page stands on its own. */
  onSelectMatch?: (id: string) => void;
  /** Every club's campanha. Omit and the section is left out entirely. */
  rankHistory?: ClubRankHistory[];
  /**
   * Head coaches by club code, from `/api/coaches`. Omit — as every caller does
   * until that request lands — and the club's own frozen value stands in, which
   * is usually nothing. The line is left out rather than filled with a dash.
   */
  coaches?: Record<ClubCode, string>;
  /**
   * The club this reader follows, if any — **Meu time**.
   *
   * A code rather than a boolean, because the caller does not know which club
   * this page resolved to: the URL carries a slug or a code, and `findClub`
   * settles it here. Asking the caller to compute "is this the followed one"
   * would mean resolving the club twice, in two places, from two lists.
   */
  followedCode?: ClubCode;
  /**
   * Follow or unfollow. Omit and no control renders at all — which is what the
   * page does before preferences are wired in, and what it must keep doing if
   * they are ever switched off. A club page that only works for somebody with a
   * preference stored is not what this feature is for.
   */
  onToggleFollow?: (code: ClubCode) => void;
}

const FORM_CLASS: Record<FormResult, string> = {
  V: "bg-positive/20 text-primary",
  E: "bg-surface-container-high text-on-surface-variant",
  D: "bg-negative/20 text-error",
};

const FORM_TITLE: Record<FormResult, string> = {
  V: "Vitória",
  E: "Empate",
  D: "Derrota",
};

const stat = (label: string, value: string) => (
  <Surface key={label} filled className="px-3 py-2">
    <p className="text-body-small text-ink-faint">{label}</p>
    <p className="font-semibold tabular-nums">{value}</p>
  </Surface>
);

/**
 * The marks in the club's header.
 *
 * Drawn here rather than fetched, for the reason `CLAUDE.md` gives for the
 * broadcaster marks: no runtime dependency on a third party for an asset. These
 * three stay local because they have one call site each, the same way
 * `MatchPage` keeps `Campaign` and `Side`. The Wikipédia mark left for
 * `ClubLinks` when the match page became its second caller, and the Instagram
 * mark followed it when the player card did — that rule is what moved them, and
 * what keeps these here.
 *
 * All three are monochrome outlines — a plain globe for the club's own site, a
 * pair of quavers for the hymn rather than YouTube's play button, a pin for the
 * sede: each names the *thing* and not the host that happens to keep it. Their
 * shared attributes come from `GLYPH`, so a mark defined here cannot drift from
 * the one defined there.
 */

/** A globe: the club's own site, as distinct from a profile it keeps elsewhere. */
function SiteGlyph() {
  return (
    <svg {...GLYPH}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
    </svg>
  );
}

/** A map pin: the club's sede. The one mark in this header that is not a link —
 *  the app holds no map, and an address is not an address bar, so the pin says
 *  "this is a place" and stops there. */
function SedeGlyph() {
  return (
    <svg {...GLYPH}>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/** A pair of quavers: the club's hymn. The link's own words say where it plays,
 *  so the mark is the song rather than the platform. */
function HymnGlyph() {
  return (
    <svg {...GLYPH}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

export function ClubView({
  clubKey: key,
  loading = false,
  standings,
  matches,
  clubs,
  scorers,
  onBack,
  onSelectMatch,
  rankHistory,
  coaches,
  followedCode,
  onToggleFollow,
}: ClubViewProps) {
  // The URL may name the club by slug or by code, and the club itself may only
  // appear in one of the two lists, so search both before giving up.
  const club =
    findClub(standings.map((entry) => entry.club), key) ?? findClub(clubs ?? [], key);

  if (!club) {
    return (
      <>
        <button type="button" onClick={onBack} className={BACK_LINK}>
          ← Voltar
        </button>
        <p className="mt-4 text-body-medium text-ink-muted" role={loading ? "status" : undefined}>
          {loading ? "Carregando página…" : "Clube não encontrado."}
        </p>
      </>
    );
  }

  const code = club.code;
  const row = standingFor(standings, code);
  const fixtures = clubMatches(matches, code);
  const form = recentForm(matches, code);
  const next = nextFixture(matches, code);
  // Most recent first: on a club page the latest result is the headline, which
  // is the opposite of the round view's chronological order.
  const played = fixtures.filter((match) => resultFor(match, code) !== null).reverse();
  const clubScorers = scorersFor(scorers, code);
  const hymn = hymnUrl(club.hymn);
  const coach = coachOf(club, coaches);

  // Same domains as the Classificação, so the shape a reader recognises in the
  // table is the shape they find here — only the box is bigger. `clubCount`
  // comes from the table rather than from the history, because the y axis is
  // the size of the division, not the number of clubs that happen to have a
  // campanha recorded.
  const campaign = rankHistory?.find((entry) => entry.clubCode === code)?.entries ?? [];
  const lastRound = lastRecordedRound(rankHistory ?? []);
  const clubCount = standings.length || rankHistory?.length || 0;

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className={BACK_LINK}
      >
        ← Voltar
      </button>

      <header className="mt-3 flex items-center gap-3">
        <ClubCrest club={club} size={44} />
        {/* `min-w-0` on the growing half, so the truncating lines inside it
            shorten instead of pushing the control off the row. */}
        <div className="min-w-0 grow">
          <h2 className="truncate text-title-large font-bold">{club.shortName}</h2>
          <p className="truncate text-body-medium text-ink-muted">
            {club.name}
            {club.state ? ` · ${club.state}` : ""}
          </p>
          {/* Identity, not a statistic: who the club is under, printed beside
              its name rather than in a tile with the tallies. The label is what
              recedes and the name is what is read, which is why the two carry
              different inks — a técnico nobody reports simply has no line, the
              same rule every optional fact on this page follows.

              Above the sede, and the two are a descending ladder rather than a
              pair: the club's name, then who it plays under, then where it
              keeps its office — each step a little fainter than the last. */}
          {coach && (
            <p className="truncate text-body-medium text-ink-muted">
              Técnico: <span className="font-medium text-on-surface">{coach}</span>
            </p>
          )}
          {/* The one line here that is allowed to wrap. Truncating an address
              cuts from the right, which is where the city and the state are —
              the half a reader who is not going there actually wants. */}
          {club.address && (
            <p data-sede className="mt-0.5 text-body-small text-ink-faint">
              <SedeGlyph />
              {/* The mark is aria-hidden, so without this the address is read
                  out as a bare string with nothing saying what it is. */}
              <span className="sr-only">Sede: </span>
              {club.address}
            </p>
          )}
          {/* Each link reads as the thing itself — a bare host, a bare handle,
              a name — rather than a full URL, which is what a reader recognises
              and what keeps the row from wrapping. */}
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-body-medium">
            {club.website && (
              <a
                href={club.website}
                target="_blank"
                rel="noopener noreferrer"
                className={`truncate ${LINK_UNDERLINE}`}
              >
                <SiteGlyph />
                {club.website.replace(/^https:\/\//, "").replace(/\/$/, "")}
                <span className="sr-only"> — site oficial (abre em nova aba)</span>
              </a>
            )}
            <InstagramLink handle={club.instagram} subject="oficial do clube" />
            {/* Named for what it is rather than for its address: a video id is
                nothing a reader recognises, unlike a host or a handle. The same
                holds for an article title, below. */}
            {hymn && (
              <a
                href={hymn}
                target="_blank"
                rel="noopener noreferrer"
                className={`truncate ${LINK_UNDERLINE}`}
              >
                <HymnGlyph />
                Hino do clube
                <span className="sr-only"> — no YouTube (abre em nova aba)</span>
              </a>
            )}
            <WikipediaLink title={club.wikipedia} subject="do clube" />
          </div>
        </div>
        {/* Last in the row and outside the growing half, so it keeps its size
            while the club's name and address truncate around it. */}
        {onToggleFollow && (
          <FollowButton
            club={club}
            following={club.code === followedCode}
            onToggle={() => onToggleFollow(club.code)}
          />
        )}
      </header>

      {row && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {stat("Posição", `${row.position}º`)}
          {stat("Pontos", String(row.points))}
          {stat("Jogos", String(row.played))}
          {stat("Saldo", row.goalDifference > 0 ? `+${row.goalDifference}` : String(row.goalDifference))}
          {/* Last of the five, reading left to right as the sentence a reader
              would say: it is where the club sits, what it took, out of how
              many, and how much of what was available that is. The em dash is
              the same absence the table's % column renders — a club yet to play
              has no aproveitamento, where 0% is a club that has taken nothing. */}
          {stat("Aproveitamento", pointsPercentageLabel(row) ?? "—")}
        </div>
      )}

      {campaign.length > 0 && lastRound > 0 && (
        <section className="mt-6">
          {/* Sits directly under the Posição tile, which it explains: the tile
              says where the club is, this says how it got there. */}
          <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Campanha</h3>
          <Surface filled className="px-3 py-3">
            <RankSparkline
              entries={campaign}
              clubCount={clubCount}
              lastRound={lastRound}
              size="page"
            />
            {/* The drawing carries no axis, so the ends are named in text —
                which is also the only version a screen reader gets. */}
            <p className="mt-2 flex justify-between text-body-small tabular-nums text-ink-faint">
              <span>{campaign[0].position}º · 1ª rodada</span>
              <span>
                {campaign[campaign.length - 1].position}º · {lastRound}ª rodada
              </span>
            </p>
          </Surface>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Últimos resultados</h3>
        {form.length === 0 ? (
          <p className="text-body-medium text-ink-muted">Nenhum jogo disputado ainda.</p>
        ) : (
          <ul className="flex gap-1.5">
            {form.map((result, index) => (
              <li
                key={index}
                title={FORM_TITLE[result]}
                className={`flex h-7 w-7 items-center justify-center rounded-x-small text-body-small font-bold ${FORM_CLASS[result]}`}
              >
                {result}
              </li>
            ))}
          </ul>
        )}
      </section>

      {next && (
        <section className="mt-6">
          <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Próximo jogo</h3>
          <MatchList matches={[next]} clubs={clubs} onSelectMatch={onSelectMatch} />
        </section>
      )}

      {clubScorers.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-body-medium font-medium text-ink-muted">
            Artilheiros do clube
          </h3>
          <ul className="space-y-1">
            {clubScorers.map((scorer) => (
              <Surface
                as="li"
                filled
                key={scorer.playerId}
                className="flex items-center justify-between px-3 py-2 text-body-medium"
              >
                <span>{scorer.playerName}</span>
                <span className="tabular-nums text-ink-muted">
                  {scorer.goals} {scorer.goals === 1 ? "gol" : "gols"}
                </span>
              </Surface>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Jogos disputados</h3>
        <MatchList matches={played} clubs={clubs} onSelectMatch={onSelectMatch} />
      </section>
    </>
  );
}
