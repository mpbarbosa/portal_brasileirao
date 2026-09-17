import type { ClubCode, ClubNewsItem } from "@/src/types";

/**
 * HAND-MAINTAINED — **Notícias do clube**, reports about a club shown on the
 * **Página do clube**, keyed by **our** club code (the upstream numeric id) and
 * never by `tla`: Corinthians and Coritiba both report `COR`.
 *
 * No provider this app reaches carries news, so this is curated like
 * `club-videos.ts` and coverage grows by hand. The page **links** to each
 * report and reproduces none of it: `title` and `summary` are the publisher's
 * own headline and linha fina, copied verbatim, never reworded.
 *
 * ## Adding an entry
 *
 * - **Strip the address to its path.** A link shared out of the ge app ends in
 *   `?utm_source=push&utm_medium=app&utm_campaign=pushge`; `isNewsUrl` refuses
 *   any query string or fragment, and `tests/club-news.test.ts` fails on it.
 * - **Read `date` off the page, not the URL.** ge files an article under the
 *   day its address was minted, and the page's `itemprop="datePublished"` is
 *   when it went out — they can differ for a report drafted before midnight.
 *   A ge page also carries a *second* `datePublished` for a related item; the
 *   one on the article is the one with a `-03:00` offset beside the headline.
 * - **Open the page** before writing a headline down. A plausible headline is
 *   indistinguishable from a correct one.
 * - **Look for the key on `origin/main` first** — a second `"<code>"` key is
 *   not a second list, and only `tsc` refuses the duplicate (TS1117):
 *
 *       git grep -n '"<club code>"' origin/main -- src/data/club-news.ts
 *
 * Order within a club does not matter: `newsFor` sorts newest first.
 */
export const CLUB_NEWS: Record<ClubCode, ClubNewsItem[]> = {
  // Botafogo — read 2026-09-16 off the page: <title> "Botafogo anuncia a
  // contratação de Tite | Ge", content-head__subtitle as `summary`,
  // datePublished 2026-09-16T16:14:49-03:00.
  "1770": [
    {
      url: "https://ge.globo.com/futebol/times/botafogo/noticia/2026/09/16/botafogo-anuncia-a-contratacao-de-tite.ghtml",
      title: "Botafogo anuncia a contratação de Tite",
      date: "2026-09-16",
      summary: "Treinador assinou contrato com o clube até o fim de 2028",
    },
  ],
};
