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
 * **Coverage is deliberately PARTIAL — thirteen clubs of twenty — and grows by
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
 * answered **403 with an HTML body** to a scripted request, `about.json` and a
 * browser User-Agent included, `old.reddit.com` redirects, and the in-app
 * browser refuses `reddit.com` by policy. The harness's own `WebFetch` refuses
 * the host outright — tried 2026-09-09Z, when `SantosFC` was written.
 *
 * **Re-read 2026-09-09Z, `www.reddit.com/r/<name>/` no longer 403s. It answers
 * 200 with an 8.4 KB empty shell, and that is WORSE than the refusal it
 * replaced**, because a 200 reads as access. Known-negative, which is the only
 * thing that settles it: the file's own control `CRFla` (8405 bytes), the real
 * `SantosFC` (8408) and a name nobody has registered (8421) return the *same*
 * shell — `<title>Reddit</title>`, no Open Graph, the sizes differing only by
 * the length of the name in the URL. **The probe has no failing branch**, so a
 * checker written against it would pass an invented sub, which is the shape
 * `CLAUDE.md` names for the piped `git log`. `about.json` still 403s.
 *
 * A checker could therefore read nothing, and one reporting a 403 — or, now, a
 * 200 — as a pass would confirm nothing while looking exactly like the checkers
 * that confirm something. Note which of the two is live, because they are not
 * equally dangerous: a refusal is at least legible as a refusal, where the
 * shell is a success code carrying no subject. Open the sub in a real browser
 * before adding a line, the way Sofascore's ids were opened.
 *
 * The 200 was found by the session adding `r/Cruzeiro`; the readings above are
 * this workstation's own, re-measured here rather than relayed.
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
 * **`SantosFC` is the second of that kind, and it is recorded here rather
 * than argued again.** The maintainer supplied the address, subredditstats
 * identifies the sub correctly at 16.8k, and
 * **Wikidata carries no `P3984` for `Q80955`** — read 2026-09-09Z, before the
 * entry was written, on an entity whose own claims say Santos Futebol Clube,
 * founded 1912, of Santos SP. That last clause is not ceremony. Asking
 * Wikidata for "Santos FC" returns **five** items, among them the women's club
 * *of the same city* and a Burkinabé one, so an absence read off the wrong
 * Q-id is an absence about somebody else — and it would read exactly like this
 * one. Confirm the entity before believing what it does not carry. Why the
 * weaker pair is acceptable is `Furacao`'s paragraph above and is not restated.
 *
 * **`Cruzeiro` is that same rule met in its hard form, where Santos was the
 * legible one.** subredditstats titles the sub *"Cruzeiro Esporte Clube"*,
 * which reads like the question already settled — and that name belongs to at
 * least **four** Brazilian clubs: ours in Belo Horizonte (`Q188277`), plus
 * Cruzeiro Esporte Clube of Rondônia, of Paraíba, and Esporte Clube Cruzeiro of
 * Arapiraca. It matches our club exactly *and* matches three others exactly, so
 * the title is not an identification. Read the two cases together and the
 * difference is the whole point: `r/santos` is the **wrong name** pointing at
 * another sport's club, which a reader might notice, while this is the **right
 * name on the wrong club**, which nobody could. `P3984` is absent from
 * `Q188277` (read 2026-09-09Z) and would be absent from the other three too —
 * an absence is only as good as the Q-id it was read off. What separated them
 * was a human opening the sidebar, which is the one instrument this
 * workstation does not have and the paragraph above explains why.
 *
 * **`botafogo` is the worst name of the four and the cleanest split of the
 * labour, and it also corrects how this file reads subredditstats.** The
 * survey above talks about "title and description" as though they were one
 * thing. They are two fields, and which one carries the identification moves
 * from sub to sub — measured with controls on 2026-09-09Z:
 *
 *   Cruzeiro   title "Cruzeiro Esporte Clube"  desc "Discussões sobre o Cruzeiro Esporte Clube"
 *   Galo       title "Clube Atlético Mineiro"  desc "Clube Atlético Mineiro, uma vez até morrer!"
 *   botafogo   title "/r/botafogo"             desc "Subreddit da torcida botafoguense! Junte-se a nós!"
 *   Coritiba   (no field)                      (no field)
 *
 * `r/botafogo` takes its own **address** as its title, which identifies
 * nothing, so a survey reading titles alone would have rejected it — and would
 * have accepted `Cruzeiro`, whose title is the *ambiguous* one. Read the wrong
 * field and this file's two hardest cases come out backwards.
 *
 * The description is what resolves it, and it resolves the half that matters:
 * **"torcida" kills the neighbourhood.** This is the worst name in the series —
 * asking Wikidata for "Botafogo" returns the **bairro of Rio de Janeiro
 * first**, then an administrative region, then a different football club, then
 * our own club's basketball team — and the club is named *after* the
 * neighbourhood, so `r/bahia`'s and `r/vitoria`'s trap is live here in its
 * strongest form. A bairro has no torcida; that one word settles it.
 *
 * What the description does **not** say is *which* Botafogo, since a
 * botafoguense of Ribeirão Preto or of João Pessoa is one too. That half is the
 * maintainer's read. So the two sources each do one half of a single
 * identification — the machine says what kind of thing it is, the human says
 * which one — which is the clearest statement of this bar the file has.
 *
 * `P3984` is absent from **`Q80958`** (ours: Rio, founded 1904,
 * `botafogo.com.br`), read 2026-09-09Z, and confirming *that* Q-id rather than
 * a homonym is the rule two paragraphs up, met where it bites hardest.
 *
 * The casing is taken from the address as given, and **the method that settled
 * `SaoPauloFC` is no longer available** — it read the canonical name back off
 * Reddit, which now returns the subject-free shell. Two independent lowercase
 * readings (the pasted URL and subredditstats' own `"/r/botafogo"`) are what
 * there is; Reddit resolves case-insensitively, so nothing here is broken by
 * being wrong about it, which is why it ships rather than waiting.
 *
 * **`Galo` is the EASIEST entry in this file, and that is worth stating beside
 * the two hardest ones rather than passed over.** The sub identifies itself as
 * "Clube Atlético Mineiro" in *both* fields — a name unique in Brazilian
 * football, where `Cruzeiro` and `Botafogo` name themselves things four and
 * five entities share — and its description is a line of the club's own hymn.
 * Wikidata returns **our club first** for "Galo", ahead of the bird, which is
 * the exact inverse of `Botafogo`, where the bairro outranked the club. So the
 * machine source is, here alone, sufficient by itself.
 *
 * **The bar still wanted the second source, and refusing to make an exception
 * is the point.** A rule relaxed for the cases that look obvious is a rule that
 * binds only where nobody was going to get it wrong — and "this one is clearly
 * fine" is exactly what a reader would also have said about `r/santos`, which
 * is a Mexican club. The cost of holding the line here was one paste.
 *
 * **The four combinations of the two fields all occur, which is what makes the
 * paragraph above a rule rather than an anecdote** — measured 2026-09-09Z:
 *
 *   Galo         title "Clube Atlético Mineiro"   desc "…uma vez até morrer!"
 *   Cruzeiro     title "Cruzeiro Esporte Clube"   desc "Discussões sobre o…"
 *   botafogo     title "/r/botafogo"  (useless)   desc "…torcida botafoguense!"
 *   Chapecoense  title "Chapecoense - Força…"     (no description)
 *   Coritiba     (no field)                       (no field)
 *
 * `Chapecoense` is `botafogo`'s mirror — the title carries it and there is no
 * description — so neither field may be treated as the one that identifies.
 *
 * `P3984` is absent from **`Q270995`** (ours: Belo Horizonte, founded 1908,
 * `atletico.com.br`), read 2026-09-09Z.
 *
 * **`nense` is the entry where the NAME carries nothing and the description
 * carries everything, which is the fourth combination arriving in the field.**
 * The address is not a word — it is the tail of "Fluminense", and derived from
 * it nobody would reach it — so the survey's whole method of guessing at
 * `r/<club name>` fails here in the one direction it has not yet failed: not a
 * wrong subject, but no candidate at all. It arrived pasted, which is the only
 * way it could have.
 *
 * The machine source is nonetheless the **strongest in this file**, and both
 * fields carry it (2026-09-10Z): the title is `"Fluminense Football Club"` —
 * the *same string* `club-wikipedia.ts` already stores for `1765` and has
 * verified resolves to our club — and the description reads "O Fluminense é o
 * único time tricolor do mundo" and "Bem vindo ao subreddit do atual campeão
 * da América". That last clause is the discriminator the `Cruzeiro` paragraph
 * wanted and did not have: "Fluminense Football Club" is a name Fluminense de
 * Feira and Fluminense-PI do not carry, and the **Libertadores** narrows it
 * further to the Rio club, in 2023. Compare `Cruzeiro`, whose title matched our
 * club exactly *and* matched three others exactly.
 *
 * `P3984` is absent from **`Q80987`** — read 2026-09-10Z on the entity
 * confirmed first, which is this file's rule met where it is cheap: pt label
 * "Fluminense Football Club", inception **1902-07-21**, `fluminense.com.br`,
 * `P118` the Série A. So the pair is **maintainer + subredditstats**, the
 * weaker one of `Furacao`/`SantosFC`/`Cruzeiro`/`botafogo`/`Galo`, and the
 * paragraph arguing why that is acceptable is above and is not restated.
 *
 * The casing is the pasted lowercase, corroborated by subredditstats' own
 * `"r/nense"`; `SaoPauloFC`'s method of reading the canonical form back off
 * Reddit is still unavailable, for the reason four paragraphs up.
 *
 * **subredditstats is FROZEN ~1000 days back, and the counts below are
 * therefore historical.** Proved by control rather than suspected: `r/AskReddit`,
 * 44 million members and busy every second, reports its last post **994 days**
 * ago. So it
 * establishes **identity** and never **liveness**, which is why the sizes here
 * are recorded as a reading with a date and not as a claim about today —
 * `StadiumWeather`'s rule. It does discriminate: an invented name 404s at 9
 * bytes where a real one returns 65KB, so it is an instrument with a failing
 * branch rather than one that agrees with whatever it is handed.
 *
 * **The freeze is PER SUB and not one global date, which this paragraph used
 * to say it was** — it read "~1001 days for every sub asked", and that is the
 * shape of claim this file exists to refuse, since it produces no work while
 * it holds. Measured 2026-09-10Z, one `lastSubredditInfoUpdate` in each page
 * and no other: `nense` **2023-12-11** (~1003 days, which is where the ~1001
 * came from) against `CRFla` **2021-05-13** (~1946). So a size below is only as
 * recent as its **own** stamp, and `CRFla` 95.9k is a 2021 reading sitting in a
 * list a reader will take as one date. Two samples is not a survey; what it is
 * enough for is to stop the general claim being carried forward.
 *
 * Sizes at that reading: `CRFla` 95.9k, `corinthians` 66.8k, `SaoPauloFC`
 * 51.2k, `palmeiras` 44.8k, `internacional` 21.5k, `gremio` 21.2k, `SantosFC`
 * 16.8k, `vasco` 15.0k, `Cruzeiro` 2.8k, `nense` 2.2k, `botafogo` 2.1k,
 * `Galo` 1.9k, `Furacao` 390. **The smallest is two orders of magnitude below
 * the largest and is still nothing like the four rejected below**: a small community is
 * not an empty room, and the line those four fall the wrong side of is whether
 * anybody is there at all. Named by size rather than by position, because the
 * sentence used to say "that last one" and every club added after `Furacao`
 * silently re-pointed it.
 *
 * **São Paulo is the one entry whose CASING had to be resolved.** Wikidata
 * carries `SaoPauloFC` and `saopaulofc` as two claims of equal rank; they are
 * one sub, and Reddit's own canonical spelling is `SaoPauloFC`. Read rather
 * than guessed — requesting the lowercase address returns the canonical name,
 * verified against two controls (`crfla` -> `CRFla`, `askreddit` -> `AskReddit`)
 * before being believed.
 *
 * **THE SEVEN CLUBS THAT ARE ABSENT, AND WHY — so nobody re-runs this.**
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
 * **`r/santos` is now that same line and a worse one**, Santos having arrived
 * as `r/SantosFC`. Two of the four derivations therefore sit beside a right
 * answer that exists, which is the case for reading the list as a rule rather
 * than as a list of six-year-old accidents. And this one is harder to catch
 * than `CAP` was: a volunteer air force announces itself as the wrong page in
 * its first line, where **Club Santos Laguna is a football club**, with a
 * crest, a league table and supporters posting about a match — everything a
 * reader arrives expecting to find, and none of it this club's.
 *
 * Four clubs have a sub that exists and is not a community: Bragantino (49
 * members), Remo (5), Mirassol (1), Vitória (2). Linking a room
 * with one person in it is worse than the absence, which at least says nothing.
 *
 * **Fluminense stood in that list and is now above, and it is the one club
 * that left it for a reason none of the others can copy.** `Athletico-PR`,
 * `Santos`, `Cruzeiro`, `Botafogo` and `Atlético-MG` moved up when a second
 * source arrived for a sub already identified. Fluminense's `r/Fluminense`
 * (1 member) did not grow and is still the dead room it was — what changed is
 * that the club's actual community is at a **different address**. So this is
 * `r/CAP` and `r/santos` a third time: a derived address sitting beside a right
 * answer that exists, and the third variety of it. `r/CAP` reaches the wrong
 * subject loudly, `r/santos` reaches the wrong subject plausibly, and
 * `r/Fluminense` reaches the **right** subject with nobody in it — which is the
 * one a reader would never question, because the name is correct.
 *
 * **One club** has a real, correctly-identified sub and only **one** source,
 * so it fails the bar rather than the sniff test and is the obvious candidate
 * for the second: Chapecoense (`Chapecoense`, 326), whose sub titles itself
 * "Chapecoense - Força, Chapecoense!" and carries **no description** — the
 * mirror of `botafogo`, and measured 2026-09-09Z rather than carried forward.
 * Coritiba's `r/Coritiba` (298) carries **no title and no description at all**
 * — re-checked the same day, and it holds — so nothing in it says which
 * Coritiba it is. Athletico-PR, Santos, Cruzeiro, Botafogo and Atlético-MG
 * stood in this list and are now above, which is what a second source looks
 * like when it arrives: one line of the survey moves and the rest stay exactly
 * where they were.
 *
 * **Count the names rather than the number in front of them.** The sentence
 * above read "Four clubs" while listing six, from the commit that wrote it —
 * a count in prose has no gate on it, which is `CLAUDE.md`'s own recurring
 * failure met inside a file that spends eighty lines on being checkable. The
 * thirteen, the seven and the four here were each counted against `clubs.ts`
 * on 2026-09-10Z — recounted for this entry rather than decremented, which is
 * the same discipline stated one sentence up; none of them is safe to carry
 * forward on trust. The three before them read eleven, nine and four, and only
 * the last was still right.
 *
 * **Bahia is the entry that is deliberately absent though a source names one**,
 * and it is `coach-overrides.ts`' Vasco written out again. Wikidata says
 * `ecbahia`; that sub has **59 members, no title and no description**. A
 * different sub, `EsporteClubeBahia` (232), plainly is the club's. So the two
 * sources **disagree**, and doubt that one is right is not knowledge of which —
 * which is the whole of what this file may hold.
 */
export const CLUB_REDDIT: Record<ClubCode, string> = {
  "1765": "nense",
  "1766": "Galo",
  "1767": "gremio",
  "1768": "Furacao",
  "1769": "palmeiras",
  "1770": "botafogo",
  "1771": "Cruzeiro",
  "1776": "SaoPauloFC",
  "1779": "corinthians",
  "1780": "vasco",
  "1783": "CRFla",
  "6684": "internacional",
  "6685": "SantosFC",
};
