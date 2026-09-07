import type { ClubCode } from "@/src/types";

/**
 * HAND-MAINTAINED — the data provider carries no community forum at any tier,
 * so this is curated, like `club-instagram.ts` and `club-hymns.ts`.
 *
 * Keyed by **our** club code (the upstream numeric id), never by `tla`:
 * Corinthians and Coritiba both report `COR`, and sending one club's supporters
 * into another club's sub is the exact failure that keying on an abbreviation
 * produces.
 *
 * The value is the subreddit name alone, in the casing the sub itself uses.
 * `redditUrl` in `club-core.ts` derives the address, so the origin is written
 * once and a pasted link's trailing `/new/`, `?rdt=…` or a share suffix does
 * not persist. The casing is stored verbatim rather than folded, because Reddit
 * resolves a sub case-insensitively while *printing* one canonical form —
 * `r/CRFla` is what the community calls itself, and `r/crfla` reaches the same
 * page while looking like somebody guessed.
 *
 * **A subreddit is the SUPPORTERS' and not the club's**, which is why the page
 * does not file it beside the **Site oficial** and the **Instagram do clube**
 * as a third official channel: the screen-reader suffix says "comunidade de
 * torcedores". Nothing here is a club's own statement, and presenting one as if
 * it were is the kind of wrong that looks right.
 *
 * **Coverage is deliberately PARTIAL — one club of twenty — and grows by hand**,
 * like `player-instagram.ts` and `broadcasts.ts`. A club with no entry renders
 * no link rather than a guessed one: `r/<name>` is exactly the shape somebody
 * would be tempted to derive from a club's name, and most of those addresses
 * are either a different community or nothing at all.
 *
 * **There is no `check-club-reddit` script, and that is a property of the HOST
 * rather than of diligence** — the same asymmetry `player-sofascore.ts` and
 * `player-instagram.ts` already record, and the reason it is written here is so
 * nobody re-investigates. Measured 2026-09-07 from this workstation: Reddit
 * answers **403 with an HTML body** to a scripted request, `about.json` and a
 * browser User-Agent included, `old.reddit.com` redirects, and the in-app
 * browser refuses `reddit.com` by policy. A checker could therefore read
 * nothing, and one that reported a 403 as a pass would confirm nothing while
 * looking exactly like the checkers that confirm something. Open the sub in a
 * real browser before adding a line, the way Sofascore's ids were opened.
 *
 * `CRFla` is Flamengo's, supplied by this repository's own maintainer, which is
 * the strongest source available for a value no script here can reach.
 */
export const CLUB_REDDIT: Record<ClubCode, string> = {
  "1783": "CRFla",
};
