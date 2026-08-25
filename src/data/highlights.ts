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
 * - Prefer the rights-holder's own upload. A reupload can vanish or be taken
 *   down. `KNOWN_CHANNELS` in `highlight-search-core.ts` holds the ones we
 *   link, in preference order: ge tv, CazéTV, UOL Esporte.
 * - List them in that order, since it is the order the reader meets them.
 * - `channel` is the label the reader sees, so write it the way the channel
 *   writes itself: "ge tv", "CazéTV", "UOL Esporte".
 * - Any match that finished with a score, a 0-0 included — see `hasHighlights`.
 *
 * Filling this in is a script, not a chore:
 *   npx tsx scripts/find-highlights.ts --round 24 --write
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
  // Internacional 0 x 0 Atlético-MG, rodada 24.
  "554976": [
    { url: "https://www.youtube.com/watch?v=4hGzHO6domw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=lhEf7WoBd3k", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=IDv3BmGI8M4", channel: "UOL Esporte" },
  ],
  // Palmeiras 4 x 1 Vasco da Gama, rodada 24.
  "554977": [
    { url: "https://www.youtube.com/watch?v=0ceAn6TLVtE", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ryRpY29ySvk", channel: "UOL Esporte" },
  ],
};
