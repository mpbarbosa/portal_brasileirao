import { useEffect, useMemo, useRef, useState } from "react";

import {
  fetchCoaches,
  fetchHealth,
  fetchMatches,
  fetchScorers,
  fetchSquads,
  fetchStandings,
  type HealthReading,
  type MatchesPayload,
} from "@/src/api";
import { ClubDashboard } from "@/src/components/ClubDashboard";
import { ClubView } from "@/src/components/ClubView";
import { Footer } from "@/src/components/Footer";
import { LiveView } from "@/src/components/LiveView";
import { AccountButton, AccountView, SignInView } from "@/src/components/AccountView";
import { PrivacyView } from "@/src/components/PrivacyView";
import { MeuTimeStrip } from "@/src/components/MeuTime";
import { MatchPage } from "@/src/components/MatchPage";
import { NavBar } from "@/src/components/NavBar";
import { PlayerOverlayCard } from "@/src/components/PlayerOverlayCard";
import { PlayersView } from "@/src/components/PlayersView";
import { RoundBrowser } from "@/src/components/RoundBrowser";
import { ScorersTable } from "@/src/components/ScorersTable";
import { StadiumView } from "@/src/components/StadiumView";
import { LeagueStats } from "@/src/components/LeagueStats";
import { StandingsTable } from "@/src/components/StandingsTable";
import { hasLiveMatch } from "@/live-core";
import { findMatch } from "@/match-core";
import { isAwaitingResult } from "@/matches-core";
import { computeRankHistory } from "@/rank-history-core";
import { buildStadiums } from "@/venue-core";
import { STADIUMS } from "@/src/data/stadiums";
import { followState, landingRoute } from "@/preferences-core";
import { parseRoute } from "@/route-core";
import { usePageMeta } from "@/src/usePageMeta";
import { useAccount } from "@/src/useAccount";
import { usePreferences } from "@/src/usePreferences";
import { useCampaignPlotKind } from "@/src/useCampaignPlotKind";
import { useTheme } from "@/src/useTheme";
import { useRoute } from "@/src/useRoute";
import type { ClubCode, Player, Scorer, Squad, StandingsRow } from "@/src/types";

export function App() {
  const { route, navigate } = useRoute();
  const { theme, toggle: toggleTheme } = useTheme();
  // Owned here for `useTheme`'s reason: three sections draw a campanha — the
  // Classificação, the Clube page and the Partida page — and one preference
  // called independently in each would be three copies of it. They would agree
  // today only because a route change unmounts the others, which is a property
  // of the router and not a decision anybody made.
  const { kind: plotKind, toggle: togglePlotKind } = useCampaignPlotKind();
  const { state: accountState, signOut, deleteAccount } = useAccount();
  // Two keys with two homes. Meu time is device-local until an account is known
  // and reconciles with it once one is — see `planSync`; signed out, that is
  // exactly Phase 0. The Página inicial lives only in the account, arrives with
  // one and leaves with it.
  const { preferences, syncedAccountId, toggleClub, chooseLanding } = usePreferences({
    id: accountState.status === "signed-in" ? accountState.account.id : null,
    preferences: accountState.status === "signed-in" ? accountState.account.preferences : null,
  });
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [matches, setMatches] = useState<MatchesPayload | null>(null);
  const [scorers, setScorers] = useState<Scorer[]>([]);
  /** Null until the Jogadores page is opened — see the lazy fetch below. */
  const [squads, setSquads] = useState<Squad[] | null>(null);
  const [squadsLoading, setSquadsLoading] = useState(false);
  /** Null until a club page is opened — see the lazy fetch below. */
  const [coaches, setCoaches] = useState<Record<ClubCode, string> | null>(null);
  /** The round the URL asks for; null means "whatever is current". */
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  /**
   * The player whose card is open, and the scoring row it was opened from when
   * there was one — the Artilharia has season figures to show, the Jogadores
   * page has none. One piece of state rather than two, because "opened from the
   * table" and "opened from an elenco" are the same overlay in two states, and
   * two booleans that must never both be set is how they come to both be set.
   *
   * Not a route: a card is a transient overlay, and a URL for it would survive
   * a reload that the overlay should not.
   */
  const [openPlayer, setOpenPlayer] = useState<{ player: Player; scorer?: Scorer } | null>(null);
  /**
   * What `/api/health` said, for the **Rodapé**. Undefined until it settles,
   * which is what lets the footer render whole rather than growing a row.
   */
  const [health, setHealth] = useState<HealthReading | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** True until the first load settles. A page that names something — a club, a
   *  match — cannot tell "no such thing" from "not fetched yet" on its own,
   *  since both look like an empty list, and answering "não encontrado" while
   *  the request is still in flight tells the reader something untrue. */
  const [loading, setLoading] = useState(true);
  /**
   * Every club the app currently knows, for resolving **Meu time**.
   *
   * The standings carry a club on every row and land first on the home page;
   * `/api/matches` ships the clubs it saw, which is the list that survives a
   * standings failure. Preferring whichever has arrived is not belt-and-braces:
   * with only one of them, a reader's club renders as unresolved for as long as
   * the other request takes — and the honest "could not load" line would be
   * showing while the answer was sitting in the other payload.
   */
  const knownClubs = useMemo(() => {
    const fromStandings = standings.map((row) => row.club);
    return fromStandings.length > 0 ? fromStandings : matches?.clubs;
  }, [standings, matches]);

  const follow = useMemo(() => followState(preferences, knownClubs), [preferences, knownClubs]);

  /**
   * The campanha behind every row of the Classificação, computed here rather
   * than fetched: `/api/matches` already ships the whole season, so the client
   * holds everything the calculation needs and a second endpoint would buy
   * nothing. Recomputed only when the fixtures change.
   *
   * Note this is derived from the fixture list, while the table's own positions
   * come from `/api/standings`. With a live provider the two can disagree by a
   * place mid-round, because football-data counts IN_PLAY matches in its table
   * and `computeStandings` does not — the documented, deliberate difference.
   * The sparkline is a trajectory, not a restatement of the position column.
   */
  const rankHistory = useMemo(
    () => (matches ? computeRankHistory(matches.clubs, matches.matches) : []),
    [matches],
  );

  /**
   * Every ground the season's fixtures name, derived here for the same reason
   * the campanha is: `/api/matches` already ships the whole season, so a second
   * endpoint would buy nothing. A stadium is not an entity in any payload —
   * this grouping is what makes one.
   */
  const stadiums = useMemo(
    () => (matches ? buildStadiums(matches.matches, matches.clubs, STADIUMS) : []),
    [matches],
  );

  usePageMeta(route, {
    clubs: matches?.clubs,
    matches: matches?.matches,
    standings,
    stadiums,
  });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [standingsResponse, matchesResponse, scorersResponse] = await Promise.all([
          fetchStandings(),
          fetchMatches(),
          fetchScorers(),
        ]);
        if (cancelled) return;

        setStandings(standingsResponse.data);
        setMatches(matchesResponse.data);
        setScorers(scorersResponse.data);
        setCurrentRound(matchesResponse.data.currentRound);
        // Only flag non-live sources; live data needs no disclaimer banner.
        setNote(standingsResponse.source === "football-data" ? null : standingsResponse.note);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Falha ao carregar os dados.");
        }
      } finally {
        // Also on failure: the request has settled, and leaving the page
        // reading "carregando" forever would be its own kind of lie.
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The process answering, read once at startup and never again.
   *
   * Deliberately its own effect rather than a fourth entry in the `Promise.all`
   * above: that one is `all`, so a health endpoint having a bad minute would
   * take the table, the fixtures and the artilharia down with it and raise the
   * error banner over a page whose data arrived perfectly. A footer is never a
   * reason to fail a page, the same rule `page-meta-core.ts` keeps for
   * metadata.
   *
   * Not refetched. Every fact it carries is fixed for the life of the process —
   * the commit, the build time, the configured provider and the instant it
   * started — so polling would spend requests re-reading constants. A restart
   * is picked up on the next load, which is when a reader could act on it
   * anyway.
   */
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const reading = await fetchHealth();
        if (!cancelled) setHealth(reading);
      } catch {
        // A lost connection reads the same as an unreadable body: the rodapé
        // says the state could not be read and the rest of the page is intact.
        if (!cancelled) setHealth({ health: null, readAt: Date.now() });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The elencos, fetched **only when the Jogadores page is opened**, and only
   * once.
   *
   * Every other payload is loaded up front because every other page is built
   * from it. This one is nearly a thousand players and no other view touches
   * it, so putting it in the opening `Promise.all` would spend that download on
   * every reader who never leaves the table. It is also the most static thing
   * the app serves — an elenco moves in a transfer window — so a single fetch
   * per session is not a staleness anyone can see.
   *
   * A failure leaves `squads` null rather than empty, which is what makes
   * navigating back a retry instead of a permanent "indisponível".
   */
  useEffect(() => {
    if (route.section !== "jogadores" || squads !== null) return;

    let cancelled = false;
    setSquadsLoading(true);

    void (async () => {
      try {
        const response = await fetchSquads();
        if (!cancelled) setSquads(response.data);
      } catch {
        // The endpoint degrades to the seed rather than failing, so this is a
        // lost connection. Say nothing and let the next visit try again.
      } finally {
        if (!cancelled) setSquadsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route.section, squads]);

  /**
   * The head coaches, fetched **only when a club page is opened**, and only
   * once — the same shape as the elencos above, and for a related reason.
   *
   * They are not in the opening `Promise.all` because one page in eight shows
   * them, and they are not taken from the elenco payload, which already carries
   * them on each club, because that payload is ~110 KB and this one is twenty
   * names. The endpoint is a projection of the same cached team list, so the
   * separate request costs nothing upstream.
   *
   * A failure leaves the map null rather than empty, which is what makes the
   * next club page a retry — and the page still names whatever coach the
   * committed club list froze, because `coachOf` falls back to it.
   */
  useEffect(() => {
    if (route.section !== "clube" || coaches !== null) return;

    let cancelled = false;

    void (async () => {
      try {
        const response = await fetchCoaches();
        if (!cancelled) setCoaches(response.data);
      } catch {
        // Degrades to the club list's own value; say nothing and try again on
        // the next visit.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route.section, coaches]);

  /**
   * Open where a signed-in reader asked to be opened.
   *
   * **A redirect rather than rendering another section at `/`**, which is the
   * decision to understand before changing this. Serving different content
   * under one address would make `/` a page whose canonical tag, `og:` metadata
   * and JSON-LD describe the Classificação while the reader is looking at the
   * artilharia — and `page-meta-core.ts` is injected server-side, where there is
   * no session and no way to know. Moving the address instead keeps every one
   * of those true for whatever is actually on screen. Crawlers are unaffected:
   * they have no session, so `/` is the table for them, permanently.
   *
   * Once per document, and only from the address the app opens on. A reader who
   * followed a deep link asked for that page, and a landing preference is not a
   * licence to overrule them; a reader who later clicks Classificação is asking
   * for the table, and a redirect there would make the tab unreachable — which
   * is why the ref is set on the first settle rather than watched for.
   *
   * `replace`, never push: with a history entry, Back would return to `/` and
   * be redirected forward again, which reads as a broken button.
   *
   * The cost is a visible step — the table paints, then the app moves — because
   * the answer depends on `/api/account/me`, and holding the first paint for it
   * would slow the page down for every signed-out reader to spare a redirect
   * for the few with a preference. `meu-time` waits for the club list too: it
   * resolves to a club's own address, and `landingRoute` will not guess one.
   */
  const landed = useRef(false);

  useEffect(() => {
    if (landed.current) return;

    // Anything but the home address is a page the reader asked for by name.
    if (route.section !== "classificacao") {
      landed.current = true;
      return;
    }

    // Still asking who this is. A signed-out or accountless reader settles to
    // one of the other three states and falls out below.
    if (accountState.status === "loading") return;
    if (accountState.status !== "signed-in") {
      landed.current = true;
      return;
    }

    // Signed in, but `preferences` may still be this render's pre-account copy:
    // both effects run against the same commit, and this one is declared after
    // the hook that absorbs the account. Reading `landing` here before that
    // lands is how this shipped broken the first time — it decided there was
    // nothing to do, latched, and the page never moved.
    if (syncedAccountId !== accountState.account.id) return;

    // `unresolved` here is "the club list has not arrived", not "no such club"
    // — `followState`'s rule. Waiting is right while the first load is in
    // flight and wrong once it has settled and still cannot name the club.
    if (preferences.landing === "meu-time" && follow.kind === "unresolved" && loading) return;

    landed.current = true;
    const destination = landingRoute(preferences.landing, follow);
    if (destination) navigate(destination, { replace: true });
  }, [route.section, accountState, syncedAccountId, preferences.landing, follow, loading, navigate]);

  /**
   * **Ao vivo** and an unsettled **Partida** refetch; every other view is a
   * snapshot of what arrived once, which is right for a table and wrong for a
   * scoreboard.
   *
   * Only while such a page is open, and only while the tab is visible. **30s
   * while anything is LIVE, 60s otherwise** — deliberately slower than the
   * server's own fixture cache, which drops to `LIVE_MATCHES_CACHE_TTL_MS`
   * (15s) in that state. Matching the cache would double this page's request
   * rate to buy a scoreline that is at worst 45s old rather than 30s, against
   * a free tier that allows ten upstream calls a minute in total; and polling
   * *faster* than the cache buys nothing at all, since the extra requests
   * re-read an entry that has not expired. A failed refresh is swallowed on
   * purpose: the last good payload keeps rendering rather than the page
   * blanking or growing an error banner over a score that is merely a minute
   * old.
   *
   * **One cadence for both, deliberately.** The Partida page could reasonably
   * poll on whether *its own* fixture is live, but the number this is pinned to
   * is the server's cache TTL, which is driven by whether **any** match is — so
   * a per-fixture cadence would ask more often than there is anything new to
   * get, and would be a second thing to keep true the next time that TTL moves.
   * The paragraph above is the argument, and it does not become a different
   * argument on a page showing one match.
   */
  const refreshMs = matches && hasLiveMatch(matches.matches) ? 30_000 : 60_000;

  /**
   * Whether the fixture on screen still has something to tell us.
   *
   * Read at render rather than from a ticking clock: `App` owns twenty
   * standings rows and twenty sparklines, and a clock here would re-render all
   * of them to answer a question whose answer changes once — which is exactly
   * why `MeuTimeStrip` and `LiveView` keep their own `useNow` instead of asking
   * for one here. It is re-evaluated on every poll, since each one sets state.
   * The one case it cannot catch is a page left open across the moment its
   * fixture comes *within* a day of kickoff, and that fails toward waiting
   * rather than toward a wrong answer.
   */
  const openFixture =
    route.section === "partida" ? findMatch(matches?.matches ?? [], route.id) : null;
  const watching =
    route.section === "ao-vivo" ||
    (openFixture !== null && isAwaitingResult(openFixture, Date.now()));

  useEffect(() => {
    if (!watching) return;

    let cancelled = false;
    const timer = setInterval(() => {
      if (document.hidden) return;

      void (async () => {
        try {
          const response = await fetchMatches();
          if (cancelled) return;
          setMatches(response.data);
          setCurrentRound(response.data.currentRound);
        } catch {
          // Keep what we have; see above.
        }
      })();
    }, refreshMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [watching, refreshMs]);

  return (
    <div className="min-h-screen">
      <NavBar
        current={route.section}
        onNavigate={navigate}
        theme={theme}
        onToggleTheme={toggleTheme}
        accountControl={<AccountButton state={accountState} />}
      />

      {/* `pb-28` on small screens clears the navigation bar fixed to the bottom
          edge — without it the last row of every page sits underneath it, which
          is invisible until you scroll to the end of a twenty-club table. The
          bar is `sm:hidden`, so the padding goes with it. */}
      <div className="mx-auto max-w-3xl px-4 pb-28 pt-6 sm:pb-6">
        <h1 className="sr-only">Portal Brasileirão — Campeonato Brasileiro Série A</h1>

        {note && (
          <p className="mb-4 rounded-small border border-warning/30 bg-warning/10 px-3 py-2 text-body-small text-warning-ink">
            {note}
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-small border border-negative/30 bg-negative/10 px-3 py-2 text-body-medium text-error">
            {error}
          </p>
        )}

        <main>
          {route.section === "classificacao" && (
            <>
              <MeuTimeStrip
                state={follow}
                matches={matches?.matches}
                clubs={matches?.clubs}
                loading={loading}
                onSelectClub={(key) => navigate({ section: "clube", key })}
                onSelectMatch={(id) => navigate({ section: "partida", id })}
              />
              <StandingsTable
                rows={standings}
                onSelectClub={(key) => navigate({ section: "clube", key })}
                rankHistory={rankHistory}
                followedCode={preferences.club ?? undefined}
                plotKind={plotKind}
                onTogglePlotKind={togglePlotKind}
                matches={matches?.matches}
              />
              {matches && (
                <LeagueStats
                  rows={standings}
                  matches={matches.matches}
                  onSelectClub={(key) => navigate({ section: "clube", key })}
                />
              )}
            </>
          )}

          {route.section === "ao-vivo" && (
            <LiveView
              matches={matches?.matches ?? []}
              clubs={matches?.clubs}
              loading={loading}
              onSelectMatch={(id) => navigate({ section: "partida", id })}
              onBrowseRounds={() => navigate({ section: "jogos", round: null })}
            />
          )}

          {route.section === "jogos" && (
            <RoundBrowser
              rounds={matches?.rounds ?? []}
              // The URL wins when it names a round; otherwise fall back to the
              // current one, so /jogos stays a link that ages well.
              round={route.round ?? currentRound}
              matches={matches?.matches ?? []}
              clubs={matches?.clubs}
              onSelectRound={(value) => navigate({ section: "jogos", round: value })}
              onSelectMatch={(id) => navigate({ section: "partida", id })}
            />
          )}

          {route.section === "clube" && (
            <ClubView
              clubKey={route.key}
              loading={loading}
              standings={standings}
              matches={matches?.matches ?? []}
              clubs={matches?.clubs}
              scorers={scorers}
              rankHistory={rankHistory}
              coaches={coaches ?? undefined}
              onBack={() => navigate({ section: "classificacao" })}
              onSelectMatch={(id) => navigate({ section: "partida", id })}
              followedCode={preferences.club ?? undefined}
              onToggleFollow={toggleClub}
              onOpenPanel={(key) => navigate({ section: "painel", key })}
              plotKind={plotKind}
              onTogglePlotKind={togglePlotKind}
            />
          )}

          {route.section === "painel" && (
            <ClubDashboard
              clubKey={route.key}
              loading={loading}
              standings={standings}
              matches={matches?.matches ?? []}
              clubs={matches?.clubs}
              // Back to the club page rather than to the table: this is a
              // drill-down from that page and from nowhere else, so "voltar"
              // means the page it was opened from.
              onBack={() => navigate({ section: "clube", key: route.key })}
              onSelectClub={(key) => navigate({ section: "clube", key })}
            />
          )}

          {route.section === "partida" && (
            <MatchPage
              match={findMatch(matches?.matches ?? [], route.id)}
              loading={loading}
              clubs={matches?.clubs ?? []}
              rankHistory={rankHistory}
              onBack={() => navigate({ section: "jogos", round: null })}
              onNavigate={(path) => navigate(parseRoute(path))}
              plotKind={plotKind}
              onTogglePlotKind={togglePlotKind}
            />
          )}

          {route.section === "estadio" && (
            <StadiumView
              stadiumKey={route.key}
              stadiums={stadiums}
              loading={loading}
              matches={matches?.matches ?? []}
              clubs={matches?.clubs}
              onBack={() => navigate({ section: "jogos", round: null })}
              onSelectMatch={(id) => navigate({ section: "partida", id })}
              onSelectClub={(key) => navigate({ section: "clube", key })}
            />
          )}

          {route.section === "entrar" && (
            <SignInView
              state={accountState}
              // Read from the address bar rather than held in state: the
              // callback redirects here carrying it, so it arrives on a fresh
              // document load and there is no earlier render to have kept it.
              error={new URLSearchParams(window.location.search).get("erro")}
              onBack={() => navigate({ section: "classificacao" })}
            />
          )}

          {route.section === "privacidade" && (
            <PrivacyView onBack={() => navigate({ section: "classificacao" })} />
          )}

          {route.section === "conta" && (
            <AccountView
              state={accountState}
              landing={preferences.landing}
              follow={follow}
              onChooseLanding={chooseLanding}
              onSignOut={(everywhere) => {
                void signOut(everywhere).then(() => navigate({ section: "classificacao" }));
              }}
              onDelete={() => {
                void deleteAccount().then(() => navigate({ section: "classificacao" }));
              }}
              onBack={() => navigate({ section: "classificacao" })}
            />
          )}

          {route.section === "jogadores" && (
            <PlayersView
              squads={squads ?? []}
              loading={squadsLoading}
              onSelectPlayer={(player) => setOpenPlayer({ player })}
              onSelectClub={(key) => navigate({ section: "clube", key })}
            />
          )}

          {route.section === "artilharia" && (
            <>
              <h2 className="mb-3 text-body-medium font-medium text-ink-muted">Artilharia</h2>
              <ScorersTable
                rows={scorers}
                onSelectPlayer={(scorer) =>
                  setOpenPlayer({
                    player: { id: scorer.playerId, name: scorer.playerName, club: scorer.club },
                    scorer,
                  })
                }
              />
            </>
          )}
        </main>

        <Footer reading={health} />
      </div>

      {openPlayer && (
        <PlayerOverlayCard
          player={openPlayer.player}
          scorer={openPlayer.scorer}
          onClose={() => setOpenPlayer(null)}
        />
      )}
    </div>
  );
}
