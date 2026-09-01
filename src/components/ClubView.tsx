import {
  clubKey,
  clubMapUrl,
  clubMatches,
  coachOf,
  findClub,
  nextFixture,
  hymnUrl,
  recentForm,
  resultFor,
  scorersFor,
  standingFor,
} from "@/club-core";
import { formatRoute } from "@/route-core";
import { pointsPercentageLabel } from "@/standings-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { GLYPH, InstagramLink, MapPinGlyph, WikipediaLink } from "@/src/components/ClubLinks";
import { BACK_LINK, LINK_UNDERLINE, STATE_LAYER } from "@/src/components/interaction";
import { MatchList } from "@/src/components/MatchList";
import { FollowButton } from "@/src/components/MeuTime";
import { FormPill } from "@/src/components/FormPill";
import { Surface } from "@/src/components/Surface";
import type {
  Club,
  ClubCode,
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
   * Open the club's **Painel** — the season rodada a rodada. Omit and the row
   * offering it is left out entirely, the same way every optional affordance on
   * this page behaves: the club page stands on its own without it.
   */
  onOpenPanel?: (key: string) => void;
  /**
   * Follow or unfollow. Omit and no control renders at all — which is what the
   * page does before preferences are wired in, and what it must keep doing if
   * they are ever switched off. A club page that only works for somebody with a
   * preference stored is not what this feature is for.
   */
  onToggleFollow?: (code: ClubCode) => void;
}

/**
 * One figure in the row under the club's name.
 *
 * Exported because the **Painel** opens with the same row, and the repo's rule
 * is to extract at the second call site — the same move `StarGlyph` made when
 * the Classificação became its second caller. Two copies of a tile is how one
 * of them comes to be a step off the other in padding or in ink.
 */
export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Surface filled className="px-3 py-2">
      <p className="text-body-small text-ink-faint">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </Surface>
  );
}

/**
 * The marks in the club's header.
 *
 * Drawn here rather than fetched, for the reason `CLAUDE.md` gives for the
 * broadcaster marks: no runtime dependency on a third party for an asset. These
 * three stay local because they have one call site each, the same way
 * `MatchPage` keeps `Campaign` and `Side`. The Wikipédia mark left for
 * `ClubLinks` when the match page became its second caller, the Instagram mark
 * followed it when the player card did, and the **sede's pin** followed both the
 * day it became a link — that rule is what moved all three, and what keeps these
 * here.
 *
 * All three are monochrome outlines — a plain globe for the club's own site, a
 * pair of quavers for the hymn rather than YouTube's play button, three candles
 * for the **Painel**: each names the *thing* and not the host that happens to
 * keep it. Their shared attributes come from `GLYPH`, so a mark defined here
 * cannot drift from the one defined there.
 *
 * **The count in this paragraph is load-bearing and nothing checks it.** It read
 * "two" for the length of one rebase: #289 took the sede's pin out of this block
 * and #290 added the Painel's candles to it, in two branches that shared not one
 * conflicting line — so both comments emerged from a clean textual merge
 * describing a file neither of them had seen. `PanelGlyph`'s own "like the three
 * above it" broke in the mirror direction at the same instant. Recount before
 * trusting either.
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

/** Three candles: the **Painel**. It draws the mark the page it opens is made
 *  of, rather than a generic chart glyph — the row's whole promise is that
 *  particular drawing. Local, like the two above it, because it has one call
 *  site; the rule that moved the Wikipédia mark into `ClubLinks` is a second
 *  caller, not a hunch that there might be one. */
function PanelGlyph() {
  return (
    <svg {...GLYPH}>
      <path d="M6 4v16M12 4v16M18 4v16" />
      <path d="M4 9h4v7H4zM10 6h4v6h-4zM16 11h4v6h-4z" />
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
  coaches,
  onOpenPanel,
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
  const mapUrl = clubMapUrl(club.address);

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
              the half a reader who is not going there actually wants.

              Guarded on the URL rather than on the address, and the two are the
              same question: `clubMapUrl` returns null exactly where
              `clubAddress` does, so there is no state in which the club has a
              sede worth printing and no link to put under it. Guarding on both
              would add a branch nothing can reach.

              The **whole line** is the link, mark and address together, where
              the estádio pin on the match page is icon-only. That is not two
              house styles: there the name already leads somewhere else — this
              app's page for the ground — so a reader clicking it has to be
              asked which of the two they meant. Here the address leads nowhere
              else, so there is nothing to disambiguate and no reason to hand a
              wrapping line's worth of target back. */}
          {mapUrl && (
            <p data-sede className="mt-0.5 text-body-small text-ink-faint">
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={LINK_UNDERLINE}
                data-sede-map
              >
                <MapPinGlyph />
                {/* The mark is aria-hidden, so without this the address is read
                    out as a bare string with nothing saying what it is — and as
                    part of the link's accessible name, it is also what says
                    where the line goes. */}
                <span className="sr-only">Sede: </span>
                {club.address}
                <span className="sr-only"> — no Google Maps (abre em nova aba)</span>
              </a>
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
          <StatTile label="Posição" value={`${row.position}º`} />
          <StatTile label="Pontos" value={String(row.points)} />
          <StatTile label="Jogos" value={String(row.played)} />
          <StatTile
            label="Saldo"
            value={row.goalDifference > 0 ? `+${row.goalDifference}` : String(row.goalDifference)}
          />
          {/* Last of the five, reading left to right as the sentence a reader
              would say: it is where the club sits, what it took, out of how
              many, and how much of what was available that is. The em dash is
              the same absence the table's % column renders — a club yet to play
              has no aproveitamento, where 0% is a club that has taken nothing. */}
          <StatTile label="Aproveitamento" value={pointsPercentageLabel(row) ?? "—"} />
        </div>
      )}

      {/* The whole of this page's campanha is now one door rather than a
          drawing plus a door beneath it. The mark and the candles were the same
          subject at two grains — where each round ended, and what happened
          inside it — and reading them apart meant reading them on two pages.
          Both live on the **Painel** now, so this row is what the club page
          says about a campanha. It renders whether or not there is one yet: a
          page that hides the door until the season has started is a page
          nobody finds in March.

          **The whole row is the link**, with a chevron closing it, for the
          reason the Meu time strip is: a 96px phrase inside a 736px band leaves
          most of the largest control on the page inert. `min-h-12` is the touch
          floor, which applies here and not to the club names in the table
          below — this is a standalone control on its own line rather than a
          link inside content. */}
      {onOpenPanel && (
        <Surface
          as="a"
          filled
          href={formatRoute({ section: "painel", key: clubKey(club) })}
          onClick={(event: React.MouseEvent) => {
            // Let modified clicks open a new tab, as any link should.
            if (
              event.metaKey || event.ctrlKey || event.shiftKey ||
              event.altKey || event.button !== 0
            ) {
              return;
            }
            event.preventDefault();
            onOpenPanel(clubKey(club));
          }}
          className={`mt-4 flex min-h-12 items-center gap-2 px-3 py-2 ${STATE_LAYER}`}
          data-panel-link={club.code}
        >
          <PanelGlyph />
          <span className="min-w-0 grow">
            <span className="block font-medium text-on-surface">Painel do clube</span>
            {/* Names the whole campanha rather than only the velas, since the
                line moved there too: this row is now the only thing the club
                page says about it, and a description of the lower half sends a
                reader looking for the upper one somewhere else. */}
            <span className="block text-body-small text-ink-muted">
              A campanha inteira: onde cada rodada terminou e o que houve dentro dela
            </span>
          </span>
          <svg {...GLYPH} className="ml-auto h-5 w-5 shrink-0 text-ink-muted">
            <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
          </svg>
        </Surface>
      )}

      <section className="mt-6">
        <h3 className="mb-2 text-body-medium font-medium text-ink-muted">Últimos resultados</h3>
        {form.length === 0 ? (
          <p className="text-body-medium text-ink-muted">Nenhum jogo disputado ainda.</p>
        ) : (
          /* The direction is named on the list rather than left to the
             heading. "Últimos resultados" says which matches these are and
             not which end is now — and which end is now is the whole of what
             a form guide is read for. Sighted readers infer it from the
             fixture list further down the page; nothing carried it in text. */
          <ul
            aria-label="Últimos resultados, do mais antigo para o mais recente"
            className="flex gap-1.5"
          >
            {form.map((result, index) => (
              <FormPill key={index} result={result} />
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
