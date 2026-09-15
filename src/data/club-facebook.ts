import type { ClubCode, ClubFacebook } from "@/src/types";

/**
 * HAND-MAINTAINED — each club's official Facebook page. No provider carries
 * one, so these are curated like `club-youtube.ts` and keyed the same way: by
 * **our** club code, never by `tla`.
 *
 * Each entry is the page's username and the numeric id its own page stated, for
 * `ClubYouTube`'s reason (see `ClubFacebook`): the username is the link, the id
 * is which page it is, and `npm run check-club-facebook` compares the two. The
 * username is stored in the casing the page's own canonical address uses.
 *
 * **Where the club points at a page, that decided** — a link from the club's
 * own website or its link-in-bio page, read on 2026-09-15. Wikidata's Facebook
 * id (P2013) was a second reading; it holds no value for Mirassol or Remo and
 * agreed everywhere else but one. What the readings turned up:
 *
 * - `facebook.com/flamengo` is **somebody else's page** — a person's, nothing to
 *   do with the club. Flamengo's site and Linktree both link `FlamengoOficial`.
 * - A club's own pointer can be stale: Athletico-PR's website links
 *   `atleticopr`, a page titled "CAP antiga" with 293 followers, where its
 *   Linktree and Wikidata name `clubathleticoparanaense`, 1.1 million.
 * - The second source can be wrong too: Wikidata names `sePalmeiras` for
 *   Palmeiras, which is a supporters' page ("Consulados do Palmeiras"). The
 *   club's Linktree links `Palmeiras`, "SE Palmeiras", 5.5 million.
 * - Bragantino's link came from `redbullbragantino.com`, the club's current
 *   site; the `bragantino.net` the provider lists showed a browser an unrelated
 *   page that day.
 *
 * Vasco is the one entry no club pointer decided: its website answers a script
 * with 403 and puts a human-verification challenge in front of a browser, which
 * is not ours to get past. `vascodagama` rests on Wikidata and on the page
 * itself — "Página oficial do Vasco da Gama", 3.3 million followers.
 */
export const CLUB_FACEBOOK: Record<ClubCode, ClubFacebook> = {
  "1765": { handle: "FluminenseFC", page: "100044402230689" },
  "1766": { handle: "atletico", page: "100044238708889" },
  "1767": { handle: "Gremio", page: "100043954487820" },
  "1768": { handle: "clubathleticoparanaense", page: "100044306490090" },
  "1769": { handle: "Palmeiras", page: "100044256858033" },
  "1770": { handle: "Botafogo", page: "100044550901299" },
  "1771": { handle: "cruzeirooficial", page: "100044078831794" },
  "1772": { handle: "AChapeF", page: "100044557440991" },
  "1776": { handle: "saopaulofc", page: "100053327862055" },
  "1777": { handle: "ecbahia", page: "100044177059061" },
  "1779": { handle: "corinthians", page: "100044381201093" },
  "1780": { handle: "vascodagama", page: "100070311317131" },
  "1782": { handle: "ecvitoria", page: "100044244048723" },
  "1783": { handle: "FlamengoOficial", page: "100044205950532" },
  "4241": { handle: "coritibaoficial", page: "100044221306745" },
  "4286": { handle: "RedBullBragantino", page: "100063549737710" },
  "4287": { handle: "ClubeDoRemo", page: "100044593742228" },
  "4364": { handle: "mirassolfc", page: "100064805016135" },
  "6684": { handle: "scinternacional", page: "100044089073797" },
  "6685": { handle: "santosfc", page: "100044552704401" },
};
