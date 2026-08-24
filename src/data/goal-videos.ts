/**
 * HAND-MAINTAINED — never generated, and the sync script does not touch it.
 *
 * Direct links to a match's goals, keyed by **our** match id, same as
 * `broadcasts.ts`. No provider we use exposes highlight links, so these are
 * supplied by hand.
 *
 * When a match has an entry here the page links straight to it. When it does
 * not, the page falls back to a YouTube *search* and says so — see
 * `goalsSearchUrl` in `match-core.ts`.
 *
 * Rules for entries:
 * - YouTube only, over HTTPS. `isGoalsVideoUrl` rejects anything else and the
 *   page then falls back to the search, so a bad entry degrades rather than
 *   rendering a broken or untrusted link.
 * - Prefer the rights-holder's own upload (Premiere, CazéTV, the club's
 *   channel). A reupload can vanish or be taken down.
 * - Only for matches that actually finished with goals.
 *
 * To find a match id: open the fixture in the app and read it from the URL
 * (`/partida/554975`), or run
 *   curl -s https://brasileirao.mpbarbosa.com/api/matches?round=24 | jq
 */
export const GOAL_VIDEOS: Record<string, string> = {
  // "554975": "https://www.youtube.com/watch?v=...",
};
