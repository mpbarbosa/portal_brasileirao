import { E2E_NOW, type Page } from "@/tests/e2e/clock";

/**
 * The `/api/matches` envelope as a spec rewrites it.
 *
 * Deliberately loose: every caller mutates fixtures in place, and a precise type
 * here would have to be cast away at each of them.
 */
export interface MatchesPayload {
  data: {
    matches: Record<string, any>[];
    clubs: { code: string; shortName: string }[];
  };
}

/** Read the payload the server would answer with, once. */
export const readMatches = async (page: Page): Promise<MatchesPayload> =>
  (await page.request.get("/api/matches")).json();

/**
 * Serve a prepared payload for every `/api/matches` request the page makes.
 *
 * From memory, never `route.fetch()` per request: a proxying handler came back
 * as something other than the envelope under the suite's workers, and passed in
 * isolation.
 */
export const serveMatches = (page: Page, body: MatchesPayload) =>
  page.route("**/api/matches*", (route) => route.fulfill({ json: body }));

/**
 * A fixture that has been played and carries a score.
 *
 * Throws rather than returning undefined: a snapshot with no finished fixture is
 * a broken seed, not a state to skip past.
 */
export const finishedFixture = (body: MatchesPayload): Record<string, any> => {
  const match = body.data.matches.find(
    (m) => m.status === "FINISHED" && m.homeGoals !== null && m.awayGoals !== null,
  );
  if (!match) throw new Error("the /api/matches payload holds no finished fixture with a score");
  return match;
};

/**
 * Turn one fixture into a match still to be played, one minute after `E2E_NOW`.
 *
 * **Produced every time, never looked for.** Specs used to skip when the
 * snapshot had no round left to play, or when the next round had no curated
 * venue yet — both real states, the first reached at the end of every season,
 * and both reported by nothing but a `skipped` count. Rewriting a fixture runs
 * the same code path today and in December.
 *
 * The **latest** fixture by kickoff is the one rewritten, so the change touches
 * the least of the season a page derives from the payload.
 *
 * `E2E_NOW` and not `Date.now()`: this runs in Node, where the page's frozen
 * clock does not reach, and a kickoff dated from the wall clock is how a
 * "future" fixture ends up in the snapshot's past — the failure that silenced
 * `meu-time.spec.ts` for four hours.
 *
 * Everything only a played or curated fixture carries is dropped, so the page
 * cannot render scorers under an unplayed scoreline, and a spec that wants a
 * venue or a broadcast line says so by setting one.
 */
export const upcomingFixture = (body: MatchesPayload): Record<string, any> => {
  const target = [...body.data.matches].sort(
    (a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff),
  )[0];
  if (!target) throw new Error("the /api/matches payload holds no fixture at all");

  target.status = "SCHEDULED";
  target.homeGoals = null;
  target.awayGoals = null;
  target.kickoff = new Date(E2E_NOW.getTime() + 60_000).toISOString();
  for (const key of [
    "goals",
    "highlights",
    "lineups",
    "referees",
    "broadcasters",
    "venue",
    "kickoffDateOnly",
  ]) {
    delete target[key];
  }
  return target;
};
