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
 * **Coverage is deliberately PARTIAL — eight clubs of twenty — and grows by
 * hand**, like `player-instagram.ts` and `broadcasts.ts`. A club with no entry
 * renders no link rather than a guessed one, and the survey below is what that
 * rule is worth: `r/<name>` is exactly the shape somebody would be tempted to
 * derive from a club's name, and four of those addresses are a **different
 * subject entirely**.
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
 * **THE BAR IS TWO INDEPENDENT SOURCES NAMING THE SAME SUB**, which is
 * `player-overrides.ts`' rule for a position and `coach-overrides.ts`' for a
 * técnico. **Wikidata's P3984** and **subredditstats.com** are the pair that
 * produced most of these, and they are independent in the way that matters:
 * one is an editor's claim about the club, the other is the sub's own title,
 * description, subscriber count and canonical casing.
 *
 * **That pair is the METHOD and not the whole of what counts as a source**, and
 * saying so is the correction `Furacao` obliged. Read as a closed whitelist the
 * bar excludes the maintainer — who is the one party here that can do the thing
 * this file asks for in as many words, which is to open the sub in a real
 * browser. `CRFla` is the proof, not an exception to be argued around: it was
 * **supplied by this repository's own maintainer** and Wikidata reached it
 * independently, so the first entry in the file already cleared the bar with a
 * person as one of its two. A rule whose own control violates it is a rule
 * written down slightly wrong.
 *
 * Which is also why `CRFla` is the **control** rather than merely the first
 * entry: a method that agrees with the one value already known is a method with
 * something behind it — the known-negative rule `CLAUDE.md` states, for once
 * pointed at a source instead of at a command.
 *
 * **`Furacao` is therefore maintainer + subredditstats, and the honest reading
 * of that is one machine source rather than two.** Recorded plainly instead of
 * folded into the seven: subredditstats identifies it correctly, the maintainer
 * supplied the address, and **Wikidata still carries no `P3984` for `Q506832`**
 * — re-queried 2026-09-09Z, before the entry was written rather than after, so
 * the absence is a reading and not an assumption inherited from the survey
 * below. Nobody need run that query again. Note what the weaker pair costs and
 * what it does not: the failure this bar exists to refuse is a sub naming a
 * **different subject** — a Mexican club, the Civil Air Patrol, a state, a city
 * — and a person who follows the club is the source least able to make that
 * mistake.
 *
 * **subredditstats is FROZEN ~1000 days back, and the counts below are
 * therefore historical.** Proved by control rather than suspected: `r/AskReddit`,
 * 44 million members and busy every second, reports its last post **994 days**
 * ago, and `lastSubredditInfoUpdate` is ~1001 days for every sub asked. So it
 * establishes **identity** and never **liveness**, which is why the sizes here
 * are recorded as a reading with a date and not as a claim about today —
 * `StadiumWeather`'s rule. It does discriminate: an invented name 404s at 9
 * bytes where a real one returns 65KB, so it is an instrument with a failing
 * branch rather than one that agrees with whatever it is handed.
 *
 * Sizes at that reading: `corinthians` 66.8k, `SaoPauloFC` 51.2k, `palmeiras`
 * 44.8k, `internacional` 21.5k, `gremio` 21.2k, `vasco` 15.0k, `CRFla` 95.9k,
 * `Furacao` 390. That last one is two orders of magnitude below the rest and is
 * still nothing like the five rejected below: **a small community is not an
 * empty room**, and the line those five fall the wrong side of is whether
 * anybody is there at all.
 *
 * **São Paulo is the one entry whose CASING had to be resolved.** Wikidata
 * carries `SaoPauloFC` and `saopaulofc` as two claims of equal rank; they are
 * one sub, and Reddit's own canonical spelling is `SaoPauloFC`. Read rather
 * than guessed — requesting the lowercase address returns the canonical name,
 * verified against two controls (`crfla` -> `CRFla`, `askreddit` -> `AskReddit`)
 * before being believed.
 *
 * **THE TWELVE CLUBS THAT ARE ABSENT, AND WHY — so nobody re-runs this.**
 * Four derived addresses would have been wrong in a way no reader could see,
 * and they are the whole argument against deriving a name from a club's name:
 *
 *   r/santos    -> **Club Santos Laguna**, of Torreón, MEXICO
 *   r/CAP       -> **Civil Air Patrol**
 *   r/bahia     -> the **state** of Bahia, "lar da Baía de Todos os Santos"
 *   r/vitoria   -> **Vitória - ES**, the city, where the club is from Salvador
 *
 * That is `club-hymns.ts`' Santos trap exactly — the hymn of the *city* of
 * Santos returned beside the club's — met a second time in a second dataset.
 *
 * **`r/CAP` stays on that list although Athletico-PR is now PRESENT**, and it
 * is the sharpest line in it for exactly that reason: the club has a sub, it is
 * `r/Furacao`, and the address a `tla` would produce reaches an American
 * volunteer air force. So the derivation is not merely unreliable where the
 * data is thin — it is wrong **next to a right answer that exists**, which is
 * the shape a reader cannot see and a compiler cannot either. `CAP` is also the
 * abbreviation this file's own header refuses to key on.
 *
 * Five clubs have a sub that exists and is not a community: Bragantino (49
 * members), Remo (5), Fluminense (1), Mirassol (1), Vitória (2). Linking a room
 * with one person in it is worse than the absence, which at least says nothing.
 *
 * Five clubs have a real, correctly-identified sub and only **one** source, so
 * they fail the bar rather than the sniff test, and are the obvious candidates
 * for the second: Santos (`SantosFC`, 16.8k, and absent from Wikidata only),
 * Cruzeiro (`Cruzeiro`, 2.8k), Botafogo (`botafogo`, 2.1k), Atlético-MG
 * (`Galo`, 1.9k), Chapecoense (326). Coritiba's `r/Coritiba` (298) carries **no
 * title and no description at all**, so nothing in it says which Coritiba it
 * is. Athletico-PR stood in this list and is now above, which is what a second
 * source looks like when it arrives: one line of the survey moves and the rest
 * stay exactly where they were.
 *
 * **Count the names rather than the number in front of them.** The sentence
 * above read "Four clubs" while listing six, from the commit that wrote it —
 * a count in prose has no gate on it, which is `CLAUDE.md`'s own recurring
 * failure met inside a file that spends eighty lines on being checkable. The
 * twelve, the eight and the five here were each counted against `clubs.ts` on
 * 2026-09-09Z; none of them is safe to carry forward on trust.
 *
 * **Bahia is the entry that is deliberately absent though a source names one**,
 * and it is `coach-overrides.ts`' Vasco written out again. Wikidata says
 * `ecbahia`; that sub has **59 members, no title and no description**. A
 * different sub, `EsporteClubeBahia` (232), plainly is the club's. So the two
 * sources **disagree**, and doubt that one is right is not knowledge of which —
 * which is the whole of what this file may hold.
 */
export const CLUB_REDDIT: Record<ClubCode, string> = {
  "1767": "gremio",
  "1768": "Furacao",
  "1769": "palmeiras",
  "1776": "SaoPauloFC",
  "1779": "corinthians",
  "1780": "vasco",
  "1783": "CRFla",
  "6684": "internacional",
};
