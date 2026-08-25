import type { Highlight } from "@/src/types";

/**
 * HAND-MAINTAINED — never generated, and the sync script does not touch it.
 *
 * Links to a match's highlights, keyed by **our** match id, same as
 * `broadcasts.ts`. No provider we use exposes highlight links, so these are
 * supplied by hand.
 *
 * A match can have several: broadcasters each publish their own package, and
 * one may be longer, better, or simply still up when another is gone. The page
 * lists them all, labelled by channel, so the reader picks. When a match has
 * none, the page falls back to a YouTube *search* and says so — see
 * `highlightsSearchUrl` in `match-core.ts`.
 *
 * Rules for entries:
 * - YouTube only, over HTTPS. `isHighlightUrl` rejects anything else and that
 *   entry is dropped, so one bad line does not take the others with it.
 * - Prefer the rights-holder's own upload (ge tv, CazéTV, Premiere, the club's
 *   channel). A reupload can vanish or be taken down.
 * - `channel` is the label the reader sees, so write it the way the channel
 *   writes itself: "ge tv", "CazéTV".
 * - Only for matches that actually finished with goals.
 *
 * To find a match id: open the fixture in the app and read it from the URL
 * (`/partida/554975`), or run
 *   curl -s https://brasileirao.mpbarbosa.com/api/matches?round=24 | jq
 */
export const HIGHLIGHTS: Record<string, Highlight[]> = {
  // Fluminense 2 x 1 Clube do Remo, rodada 24.
  "554975": [
    { url: "https://www.youtube.com/watch?v=o-_hD5Q8f4Q", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=AgycMjd6b-I", channel: "CazéTV" },
  ],
};
