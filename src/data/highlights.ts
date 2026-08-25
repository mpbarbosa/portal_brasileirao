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
  // Cruzeiro 2 x 1 Flamengo, rodada 24.
  "554974": [
    { url: "https://www.youtube.com/watch?v=GhV-hg9QQCY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=nEknyMrCHuA", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=n4ySCP9iff8", channel: "UOL Esporte" },
  ],
  // Bragantino 1 x 0 Grêmio, rodada 24.
  "554971": [
    { url: "https://www.youtube.com/watch?v=R6Rqm77dgTo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=YlLLl0sW3vI", channel: "UOL Esporte" },
  ],
  // Vitória 0 x 2 Bahia, rodada 24.
  "554979": [
    { url: "https://www.youtube.com/watch?v=5PGO-tHVAX8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=c3U4aUuxsQk", channel: "UOL Esporte" },
  ],
  // Chapecoense 1 x 0 São Paulo, rodada 24.
  "554972": [
    { url: "https://www.youtube.com/watch?v=M7b8fdPRajk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=MBtZ8F5t1vc", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=PF8FX02A8P8", channel: "UOL Esporte" },
  ],
  // Santos 1 x 1 Mirassol, rodada 24.
  "554978": [
    { url: "https://www.youtube.com/watch?v=ES44RDZCbv4", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=y-FVCdxoik4", channel: "UOL Esporte" },
  ],
  // Coritiba 2 x 1 Corinthians, rodada 24.
  "554973": [
    { url: "https://www.youtube.com/watch?v=X8Eid2nGSyU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=9YHN8rP0aHU", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=KhxocmJ2j5o", channel: "UOL Esporte" },
  ],
  // Fluminense 3 x 2 Palmeiras, rodada 23.
  "554964": [
    { url: "https://www.youtube.com/watch?v=cs1ykNb9lFw", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=doROk0Tgn8g", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=AzArDSBW3vQ", channel: "UOL Esporte" },
  ],
  // Athletico-PR 1 x 1 Bragantino, rodada 23.
  "554960": [
    { url: "https://www.youtube.com/watch?v=3s1Nu7bdEHU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=RiFSmOlrQnQ", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=XTPBFbm5U5o", channel: "UOL Esporte" },
  ],
  // São Paulo 1 x 1 Coritiba, rodada 23.
  "554967": [
    { url: "https://www.youtube.com/watch?v=CKPXBY6BEEg", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=NcUuh7bRS4s", channel: "UOL Esporte" },
  ],
  // Chapecoense 3 x 3 Bahia, rodada 23.
  "554962": [
    { url: "https://www.youtube.com/watch?v=uLzRdhxVRB8", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=gjkJwL0JhEg", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=zozJDvv0ml8", channel: "UOL Esporte" },
  ],
  // Atlético-MG 3 x 0 Grêmio, rodada 23.
  "554961": [
    { url: "https://www.youtube.com/watch?v=84Yo81jENDk", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ISHvEUlQXMI", channel: "UOL Esporte" },
  ],
  // Vasco da Gama 0 x 3 Santos, rodada 23.
  "554968": [
    { url: "https://www.youtube.com/watch?v=m1GECiycBSU", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=zlXzjxvRB1Q", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=_QumEZ1wdf4", channel: "UOL Esporte" },
  ],
  // Mirassol 1 x 5 Flamengo, rodada 23.
  "554966": [
    { url: "https://www.youtube.com/watch?v=UvlZbUMJpSo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=GY714RKi0AY", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=yTCGc3-LDhQ", channel: "UOL Esporte" },
  ],
  // Vitória 1 x 0 Botafogo, rodada 23.
  "554969": [
    { url: "https://www.youtube.com/watch?v=eeF8CdvLfPo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=elfzdoDFhrQ", channel: "UOL Esporte" },
  ],
  // Corinthians 1 x 2 Cruzeiro, rodada 23.
  "554963": [
    { url: "https://www.youtube.com/watch?v=V82bH90Xm-k", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=7MfuJ1o8uIY", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=CxK9CkowQ08", channel: "UOL Esporte" },
  ],
  // Internacional 1 x 1 Clube do Remo, rodada 23.
  "554965": [
    { url: "https://www.youtube.com/watch?v=q6Sn-QgweWM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=CBL4dK2FUes", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=LkeeEZHv76g", channel: "UOL Esporte" },
  ],
  // Grêmio 2 x 1 São Paulo, rodada 22.
  "554956": [
    { url: "https://www.youtube.com/watch?v=dGhO7ah73WM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=Huf9q1wy_X4", channel: "UOL Esporte" },
  ],
  // Clube do Remo 2 x 2 Atlético-MG, rodada 22.
  "554958": [
    { url: "https://www.youtube.com/watch?v=bU0OwHAuquA", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=b9rUHLiYqhs", channel: "UOL Esporte" },
  ],
  // Coritiba 2 x 1 Chapecoense, rodada 22.
  "554953": [
    { url: "https://www.youtube.com/watch?v=3oIEjO9bWtc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ydZuRz3aHyM", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=n8mhilun-qo", channel: "UOL Esporte" },
  ],
  // Botafogo 1 x 1 Fluminense, rodada 22.
  "554951": [
    { url: "https://www.youtube.com/watch?v=CT9UKBvQqXM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=4nGUP-nRuvc", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=2Nl3Ra6Uu0M", channel: "UOL Esporte" },
  ],
  // Cruzeiro 3 x 1 Mirassol, rodada 22.
  "554954": [
    { url: "https://www.youtube.com/watch?v=pxnpDWx-FDY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ouSGlMxcjMc", channel: "CazéTV" },
    { url: "https://www.youtube.com/watch?v=Pq9RYsFlqT8", channel: "UOL Esporte" },
  ],
  // Bahia 0 x 0 Vasco da Gama, rodada 22.
  "554950": [
    { url: "https://www.youtube.com/watch?v=kVk_eTpxKWo", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=wZAI-M5YbUw", channel: "UOL Esporte" },
  ],
  // Palmeiras 0 x 0 Internacional, rodada 22.
  "554957": [
    { url: "https://www.youtube.com/watch?v=LZQIyoiq3DM", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=6FbRkxgaoG4", channel: "UOL Esporte" },
  ],
  // Bragantino 0 x 2 Corinthians, rodada 22.
  "554952": [
    { url: "https://www.youtube.com/watch?v=N6xN_VVkOJY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=ahWXyPxy3_c", channel: "UOL Esporte" },
  ],
  // Santos 0 x 2 Athletico-PR, rodada 22.
  "554959": [
    { url: "https://www.youtube.com/watch?v=RGtIioFgreY", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=1lGT-pTc7aU", channel: "UOL Esporte" },
  ],
  // Flamengo 2 x 0 Vitória, rodada 22.
  "554955": [
    { url: "https://www.youtube.com/watch?v=Vrk4K9a3HVc", channel: "ge tv" },
    { url: "https://www.youtube.com/watch?v=x7Oxl_A86nw", channel: "UOL Esporte" },
  ],
};
