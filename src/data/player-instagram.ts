/**
 * HAND-MAINTAINED — the data provider carries no social accounts at any tier,
 * so these are curated, like `club-instagram.ts` and `highlights.ts`.
 *
 * Keyed by **our** player id — the upstream numeric id as a string, the same
 * key `squads.ts` and `/api/players/:id` use. Never by name: Athletico-PR
 * really does list two Dudus, and the division carries several Gabriels, a
 * Pedro and a Léo. Pointing one player's readers at another player's account
 * is the exact failure that keying on a name produces, and it is invisible on
 * the page — both render as a plausible link.
 *
 * The value is the handle alone. The profile URL is derived by `instagramUrl`
 * in `instagram-core.ts`, reused rather than reimplemented for the same reason
 * `venue-core.ts` reuses `slugify`: a second normaliser is how two spellings of
 * one address come to disagree.
 *
 * Coverage is **partial and always will be**, like `broadcasts.ts` — 947
 * players are listed for the division and most have no account any source
 * records. A player absent here renders no link, which is the honest result.
 *
 * ## How these were checked, and why it could not be automated
 *
 * Instagram serves **the same JavaScript shell for a real handle and an
 * invented one** — HTTP 200, `<title>Instagram</title>`, no Open Graph tags at
 * all. So there is no `check-player-instagram` script alongside `check-hymns`
 * and `check-stadium-photos`: the check those perform is not available here,
 * and a script that fetched a profile and reported "200 OK" would confirm
 * nothing while looking exactly like the ones that confirm something.
 *
 * **That still holds for a script, and it is narrower than it reads. A
 * RENDERING browser does distinguish, and the 48 entries added in the ptwiki
 * sweep were confirmed that way.** The paragraph above rules out a `check-*`
 * of the kind this repo ships — `curl` gets the shell and learns nothing. It
 * does not rule out driving a real browser, which executes the JavaScript and
 * so reaches what a person would see. Measured against a known-negative
 * BEFORE any candidate was trusted, which is the whole reason to believe it:
 * an invented handle renders **"Profile isn't available"**, while a real one
 * renders the display name, the follower count and the bio.
 *
 * Do not read that as "it can be automated after all". What the browser
 * supplies is the same evidence the search snippet supplied, more reliably;
 * the JUDGEMENT is still per-entry and still refuses more than it accepts.
 * Over 86 candidates: **48 accepted, 19 refused, 19 held** — a 22% hard
 * failure rate, in line with the 13-of-70 the first pass recorded.
 *
 * The 19 refusals are worth keeping, because a script trusting Wikidata would
 * have written every one of them:
 *
 * - **13 handles simply do not resolve.** Accounts are renamed and deleted,
 *   and Wikidata keeps the old value.
 * - **`r.junior.07`** (Robson Júnior) has **0 followers and 1 following** —
 *   an empty account somebody made and abandoned.
 * - **`_allansoouza`** (Allan) has **1 follower**. **`opatrickalan`** (Alan
 *   Patrick) is **private with 12.2K**, which no first-choice Internacional
 *   playmaker's account is. The follower count is what refuses these, exactly
 *   as this file's original pass said.
 * - **`carlos_f20`** renders as *Carlos **Figueroa***; the player is Carlos
 *   **Cuesta**. A surname apart, and nothing but opening it would show that.
 * - **`joaopaulo34`** (João Paulo, *Bahia*) reads *"Menino da vila"* over
 *   Santos' colours, and **`matheuzinho.02`** (Matheuzinho, *Corinthians*) is
 *   private with 170 followers and a `@flamengo` bio. Both are a different
 *   man of the same name — the trap this file exists to catch.
 *
 * The 19 held are not rejections: the name matches and the account is
 * plainly a footballer's, but nothing on the profile names the club, so
 * there is no second source. Absent is the honest answer for those.
 *
 * The candidates came from Wikidata's `P2003` (Instagram username), joined to
 * `squads.ts` on **exact date of birth plus a shared name token** — the join is
 * on identity, not on which club a player is at, since the seed is a frozen
 * snapshot and Wikidata's team memberships are frequently left open-ended.
 *
 * Wikidata was then treated as a **candidate list, not an answer**. Every
 * handle below was confirmed against a search result carrying the profile's own
 * title and follower count — "Nome (@handle) • Instagram photos and videos" —
 * and, where the bio was visible, against a bio naming the player's club. Of 70
 * candidates that check rejected or corrected **13** — count the entries below
 * rather than a number written here, which has no gate on it and goes stale the
 * first time anybody adds a handle:
 *
 * - Six were simply the **wrong handle**. Ramón Sosa was given as `sosa`, which
 *   belongs to somebody else; he is `ramon.sosa17`. Nicolás De La Cruz was given
 *   as `nico_delacruz10` and is `nicodelacruz10` — one underscore, and the two
 *   are different accounts. Kaio Jorge, André Carrillo and Breno Lopes were each
 *   given a longer handle than the one they use.
 * - One was **abandoned**: Ayrton Lucas deactivated his account after the
 *   Recopa final. The handle was still correct and the link would have gone
 *   nowhere, which is the failure a name check cannot catch.
 * - The rest could not be corroborated at all, or the search turned up two
 *   rival accounts with no way to tell which the player writes from. Absent is
 *   the honest answer there; a coin flip is not.
 *
 * So: **do not paste a handle in here from Wikidata, from a fan page, or from a
 * club's own post, without looking at the profile.** Nearly one in five of the
 * candidates was wrong, and every one of them looked entirely reasonable in the
 * source. A wrong handle is indistinguishable from a right one to everyone
 * except the person who opens it.
 *
 * ## A stronger join than the date, where the curated files already agree
 *
 * `flacolopez_10` was added after that survey, and the identity did not rest on
 * the date of birth alone. The Wikidata item reached by the `2000-12-06` join
 * carries **`P12302` = `1094179`** and a **`ptwiki` sitelink of `Flaco López`**
 * — byte-identical to what `player-sofascore.ts` and `player-wikipedia.ts`
 * already record for `170698`, each established through its own join and, for
 * the Wikipedia half, verified by `check-player-wikipedia` against the
 * article's own stated birth date. So three curated files agree on one item
 * rather than one file trusting one date.
 *
 * Prefer that check where it is available. This division carries **two**
 * Lópezes — Renzo López is `44093` at Vitória, born 1994-04-16 — and the
 * general failure is already recorded above: exact name plus exact date is not
 * a unique key here, since `179144` and `13421` are two different Carlos
 * Eduardos both born 1996-10-10. An agreeing third-party id is a question about
 * the *set* of curated files, which is the kind of question a per-row check
 * cannot ask.
 *
 * The profile was still opened, because none of that says the handle is live: a
 * deactivated account is what the Ayrton Lucas entry above records, and no id
 * anywhere reports it. Title, follower count and a bio naming **@palmeiras**,
 * read in a browser.
 *
 * ## An entry the join cannot reach at all
 *
 * `kevinviveros9` had no candidate to check. Wikidata carries **no `P2003`**
 * for Kevin Viveros (`192070`), so the join at the top of this file does not
 * reach him — which is how the competition's own **artilheiro** came to be
 * missing from this file while `player-wikipedia.ts` and
 * `player-sofascore.ts` both record him. The handle was handed over directly
 * and then opened, which is the whole of what this file has ever required:
 * title `Kevin Viveros (@kevinviveros9)`, follower count, and a bio naming
 * **@athleticoparanaense** — the club `squads.ts` lists him at. The same
 * reading that settled `flacolopez_10` one section up, arrived at without the
 * agreeing-ids half, because there were no ids to agree.
 *
 * So a **re-run of the Wikidata join will not find him, and that is not a
 * finding**. The join produces candidates; it does not define them, and it is
 * not a gate anything here is checked against. Absence from it is not a reason
 * to remove an entry somebody opened.
 *
 * ## A handle that arrived without a join at all
 *
 * `carlosvinicius95` (`37833`, Grêmio) came from a link somebody pasted, not
 * from `P2003` — so there is no date-of-birth join behind it and none of the
 * corroboration the paragraphs above rest on. That removes a check; it does
 * not lower the bar, because the bar was never the join. Every entry here was
 * confirmed by **opening the profile**, and the join only ever decided which
 * profile was worth opening.
 *
 * What the profile says is the whole of the evidence, and it is the same
 * evidence the survey above accepted: title `Carlos Vinicius
 * (@carlosvinicius95)`, 676K followers, and a bio naming **@gremio** and
 * `Porto Alegre` — and `squads.ts` lists `37833` under `squad("1767")`, which
 * is Grêmio. The `95` is his birth year, `1995-03-25`, which is a coincidence
 * worth noticing and not a check: a handle can carry any number.
 *
 * Note what is **not** claimed. The bio establishes that this account belongs
 * to a Carlos Vinicius at Grêmio, and the division carries exactly one — but
 * this file already records that exact name plus exact date is not a unique
 * key here, so a second Carlos Vinícius arriving in a transfer window is the
 * case that would need this re-read rather than trusted.
 *
 * ## A handle whose bio names no club
 *
 * `gabigol` (`1327`, Santos) arrived with a Publicação somebody pasted, and it
 * is the one entry here the bio cannot vouch for: opened 2026-09-11, the
 * profile reads `Gabriel B. (@gabigol)`, verified, 11.1M followers, and a bio of
 * a sponsor handle and a company link — no club at all. So the identity rests
 * on `flacolopez_10`'s stronger join instead. Wikidata's item for this `P2003`
 * carries **`P12302` = `358554`**, byte-identical to what `player-sofascore.ts`
 * already records for `1327`, and a `P569` of `1996-08-30`, the date `squads.ts`
 * lists. Two curated files agreeing on one item, not one date trusted alone.
 *
 * ## An entry whose ids agree and whose handle Wikidata does not carry
 *
 * `osamuellino` (`178710`, Flamengo) arrived as a pasted link, and it is the
 * mirror of `gabigol`: there the ids vouched for the handle because Wikidata's
 * item carried it; here the item is found from the other side and carries **no
 * `P2003`** at all. Reached through **`P12302` = `874705`** — what
 * `player-sofascore.ts` already records for `178710` — item `Q67222776` has a
 * `ptwiki` sitelink of `Samuel Lino`, the title `player-wikipedia.ts` records,
 * and a `P569` of `1999-12-23`, the date `squads.ts` lists. That settles which
 * person the row is. It says **nothing about the handle**, which rests on the
 * profile alone: opened 2026-09-11, `Samuel Lino (@osamuellino)`, verified, 1M
 * followers, and a bio reading "Jogador do **@flamengo**" — the club `squads.ts`
 * lists `178710` under — with an invented handle beside it rendering "Profile
 * isn't available". The division lists exactly one Samuel Lino.
 *
 * ## The same road, and an item carrying two birth dates
 *
 * `lucianoneves10` (`42901`, São Paulo) arrived as a pasted link and took
 * `osamuellino`'s road: no item carries this `P2003`, so the person was reached
 * through **`P12302` = `282557`**, what `player-sofascore.ts` records for
 * `42901`. Item `Q15966749` has a `ptwiki` sitelink of `Luciano da Rocha Neves`,
 * the title `player-wikipedia.ts` records — and **two** `P569` values,
 * `1993-05-18` and `1965-10-13`. The first is the date `squads.ts` lists; the
 * second is somebody else's claim left on the item, and it is recorded here so
 * the next join on birth date is not surprised by it. The two curated files
 * agreeing on one item is what settles the row, not the date.
 *
 * The handle rests on the profile alone: opened 2026-09-11, `Luciano Neves
 * (@lucianoneves10)`, verified, 1.4M followers, and a bio naming
 * **@saopaulofc** — the club `squads.ts` lists `42901` under — with an invented
 * handle beside it rendering "Profile isn't available". The division lists
 * exactly one player named `Luciano`; Luciano Juba and Luciano Acosta are other
 * names, not namesakes.
 *
 * ## A division-wide sweep, and what it measured that a one-at-a-time pass cannot
 *
 * Following #604 (Felipe Longo), a session ran the same `P2003` join across
 * every uncovered player in `squads.ts` at once rather than one name at a
 * time: query Wikidata for every professional footballer carrying an
 * Instagram username, born in the same year range as the uncovered roster,
 * then join locally on **exact date of birth**. 13,173 candidates came back
 * worldwide; joined against 856 uncovered players, 55 shared a date of birth
 * with exactly one of them, and 50 survived the five this file already knew
 * were wrong (`carlos_f20`, `opatrickalan`, `r.junior.07`, `_allansoouza`,
 * `joaopaulo34` — above).
 *
 * **Handles rot fast, and a bulk pass is the first thing that can measure
 * it.** Of the 25 candidates where both name tokens agreed with the
 * Wikidata label, 11 answered *"Profile isn't available"* — a handle
 * Wikidata still records as current, dead on Instagram's side, at 44%. A
 * one-entry-at-a-time check never sees this rate; only asking the same
 * question of two dozen rows at once does.
 *
 * **Three of those 25 name matches were the wrong person, caught only by
 * reading the bio, and none of them is recorded here.** `gabriel_mec__`
 * names Gabriel Mec correctly and bios `@fcporto` — he plays for FC Porto,
 * not this division's Grêmio player of the same name. `riquelme.06` reads
 * `Jogador profissional do @intermiamicf` — Inter Miami, not Palmeiras.
 * `hernandezdiego16` bios `@sportrecife` — Sport Club do Recife, not Clube
 * do Remo, an easy pair to confuse by name alone since both are read as
 * "o Remo" locally. A session re-running this join will meet all three
 * again and should read this paragraph before adding them.
 *
 * The eleven entries below are what survived: opened, verified where
 * Instagram shows a badge, and bio-corroborated against the club
 * `squads.ts` records for the player. `matheus_franca04` (Matheus França)
 * and `rodrigor09` (Rodrigo Rodrigues) are the two held to a weaker
 * standard — neither bio names a club — and rest instead on a verified
 * badge plus an uncommon full name with no rival candidate at the same
 * date of birth.
 *
 * ## Three handles that arrived pasted, not joined
 *
 * `voronov_maksym06`, `mycaelmoreira` and `matheuss_s012` were pasted
 * directly by the user rather than found through the join above, and all
 * three are Athletico-PR's younger goalkeepers — `278568` Maksym Voronov,
 * `187426` Mycael and `249158` Matheus Soares. Two of the three carry **no
 * verified badge** (Voronov, Soares), short of every other entry's bar;
 * what stands in for it is goalkeeper-training photography consistent with
 * the position `squads.ts` records for each, a Ukrainian flag in Voronov's
 * bio matching his recorded nationality, and a follower count in the low
 * thousands typical of a young reserve nobody has verified yet rather than
 * of an impostor account courting attention. Mycael alone is verified.
 *
 * ## The same sweep's weaker rows: single-token name matches
 *
 * The 25 candidates above shared both name tokens with the Wikidata label.
 * A further 24 shared only one — a bare first name, most of them — and are
 * far riskier: a first name alone is the shallowest evidence this file
 * accepts anywhere, and every entry below had to clear the bar some other
 * way, never on the name alone.
 *
 * **Four wrong-person or wrong-club catches, all from this weaker
 * batch, none of them recorded here.** `evertongaldinoo` names Everton
 * correctly and bios `Jogador do @vilanovafc` — Vila Nova, not this
 * division's Mirassol player of the same name, and no Wikipedia article
 * exists to say otherwise. `yurilara5` bios `@jubiloiwata.official` —
 * Júbilo Iwata in Japan, not Mirassol's Yuri, same absence of a second
 * source. `_leo06` and `rafaelalexandresilva` are each a different,
 * unrelated footballer entirely — display names "Leonardo Pinheiro" and
 * "Rafael Alexandre" against our "Léo" (Athletico-PR) and "Rafael Thyere"
 * (Chapecoense), caught only because the display name did not match the
 * Wikidata label it was supposed to. Three more were refused before being
 * opened at all, on the name alone: `ibrahimacisse_09` (Ibrahima Cissé)
 * for our Mamady Cissé, `agussantanna22` (Agustín Sant'Anna) for our Ariel
 * Sant'Anna, and `jhesquerda` (João Henrique Mendes da Silva) for our
 * Wendel Silva — each a different first name sharing only a surname, and
 * "Silva" shares nothing at all.
 *
 * **Ten survived, and none of them rests on the name by itself.** Six carry
 * an explicit bio match to the club `squads.ts` records: `pumitaa_4`
 * (`Jugador Profesional @vascodagama`), `zericardo_99` (`@clubedoremo`),
 * `nadsonjuan_09` (`@santosfc`) and `isa_matos02` (`Atleta: @vasco_feminino`
 * — see below). The other four rest on fame plus an exact date-of-birth
 * match with no rival candidate: `bernard` is Bernard Anício Caldeira
 * Duarte, `willianborges88` is Willian Borges da Silva (born 1988-08-09,
 * the exact date `squads.ts` records), `arthurhmelo` is Arthur Melo — three
 * of the most recognisable names to have played in this division, at
 * 895K, 10.6M and 4.6M followers respectively, where a bare first name
 * being wrong would mean a different, equally famous person with the same
 * uncommon full name and the same day of birth. `walacesouza08` and
 * `99alesson` sit one step below that: verified, no bio naming the club,
 * but a kit colour in the profile photo consistent with it — Bahia's
 * stripes for `eve_stum` (see next), Mirassol's yellow-green for
 * `99alesson`.
 *
 * **`eve_stum` is Everaldo Stum, and the display name is the trap this
 * entry almost failed on.** The account now shows only "Eve", not
 * "Everaldo Stum" — Instagram display names change, unlike a handle — and
 * a name check alone would have refused it exactly as `_leo06` and
 * `rafaelalexandresilva` above were refused for the same shape of mismatch.
 * What held here and not there: the handle itself derives unmistakably
 * from "Everaldo Stum" where "_leo06" and "rafaelalexandresilva" derive
 * from names that are not our players' at all, the account is verified,
 * and the profile photo is a striped kit in Bahia's colours. A changed
 * display name is not evidence of anything by itself; it is the derivation
 * and the photo that carry this entry.
 *
 * **`isa_matos02` is Isabela Matos, and the entry she sits under is odd for
 * a reason this file cannot fix.** `squads.ts` lists `287686` inside Vasco
 * da Gama's men's squad, born 2002-08-12 — and her own bio reads `Atleta:
 * @vasco_feminino`, Vasco's **women's** team. That is football-data's
 * classification, not a guess made here: the provider's team payload is
 * what `sync-seed-data` freezes verbatim, and a women's player appearing in
 * a men's Série A squad list is a data anomaly upstream, not a card this
 * app declines to render. The handle is genuinely hers — name, age and the
 * "Isa Matos" short form all agree, and her bio names the club her own way
 * — so the entry stands regardless of which squad `squads.ts` filed her
 * under.
 *
 * ## A fourth method: querying identities already established elsewhere
 *
 * The three sweeps above all resolve identity and find a handle in the
 * same step — a name-and-date join against Wikidata, which is exactly
 * where a wrong-person match sneaks in. `player-wikipedia.ts` has already
 * done that resolution once, independently, for 297 of this file's
 * uncovered players — its own checker verifies the article against
 * `squads.ts`'s birth date before the title is ever committed. So this
 * pass skips the join: resolve each of those 297 titles to a Wikidata
 * QID directly (the MediaWiki API takes 50 titles a request, so this is
 * six requests rather than 297), then query `P2003` on exactly those
 * QIDs. Nothing is matched by name a second time.
 *
 * **27 of the 297 carry an Instagram username, and all but five were
 * already known from the two sweeps above** — refused handles
 * (`carlos_f20`, `opatrickalan`, `joaopaulo34`, `_allansoouza`,
 * `matheuzinho.02`, `r.junior.07`), dead ones, or entries already added.
 * `fernandosantos_99`, `carlinhos_l9` (Carlinhos, Clube do Remo),
 * `maiconroque`, `gabriel` and `renatokayzer` are the five genuinely new
 * survivors, each opened and verified the same way as every other entry
 * here.
 *
 * **The identity behind this pass is stronger than a name match, and
 * that changed two verdicts from the sweeps above — which is the real
 * finding of this round, worth more than the five new rows.**
 * `gilbertomjr02` was refused earlier for bio-ing `@athleticoparanaense`
 * while `squads.ts` lists Gilberto (`1073`) at Bahia — read at the time as
 * a different person. Opening his Wikipedia article (reached from this
 * pass, since `1073` carries a `player-wikipedia.ts` entry) shows a full
 * transfer history: Bahia 2023–2026, **Athletico Paranaense 2026–**. He
 * is the same Gilberto; the bio was right and `squads.ts`'s frozen
 * snapshot had not caught the move. `arturvictor` was refused for a
 * different-looking reason — no bio, and its "accounts you might like"
 * clustered around Botafogo rather than São Paulo's Artur Guimaraes — and
 * his article resolves that identically: *"atua como ponta-direita no
 * São Paulo, emprestado pelo Botafogo"*. Botafogo is not a wrong
 * club, it is the parent club he is on loan from, which is exactly why
 * his own social circle includes it. `gabriel_mec__`, refused in the
 * first sweep for bio-ing `@fcporto` against Grêmio's Gabriel Mec, turns
 * out to be the same shape again — his article states outright:
 * Grêmio 2025–2026, **Porto 2026–**. All three now stand in the data
 * below.
 *
 * **The general lesson: "the bio names a different club" is evidence of
 * a transfer at least as often as it is evidence of a wrong person, and
 * the two look identical from the bio alone.** A name match with no
 * further check cannot tell them apart, which is exactly why the first
 * two sweeps' "wrong-club catches" erred toward caution — refusing three
 * matches that were actually correct. What resolves it is a THIRD
 * source with a career history: `squads.ts` is a snapshot, an Instagram
 * bio is whatever the player last set it to, and only a Wikipedia
 * article states the transfer that reconciles them. Where no such
 * article exists — `evertongaldinoo`, `yurilara5`, `hernandezdiego16`,
 * `riquelme.06` above — the bio mismatch is still the best evidence
 * available, and it still means refuse.
 *
 * ## A fifth method, and why it added exactly one row
 *
 * The two sweeps above join on `P2003` starting from *occupation* —
 * "association football player" — which requires Wikidata to have tagged
 * the item that way. `P54`, "member of sports team", is the complementary
 * property: resolve each of the 20 clubs' Wikidata items (from the titles
 * already in `club-wikipedia.ts`) and ask who has ever been listed as a
 * member of that specific team, joined locally on exact club **and** exact
 * date of birth. It is a smaller pool per club than the occupation query —
 * 1,566 candidates worldwide, against 13,173 — but every one of them is
 * pre-filtered to a club this app actually has, which is evidence the
 * occupation query cannot offer on its own.
 *
 * **It mostly reproduced the first sweep rather than extending it**, which
 * is itself worth knowing before running it again: of 7 exact club+date
 * matches, `opatrickalan`, `carlos_f20`, `riquelme.06` and
 * `murilocerqueira35` were already known — three already refused, one
 * already dead — and `gustavo19luiz` had already been added. One,
 * `bruno_fuchs` for Internacional's Vitinho, is a same-birthdate
 * coincidence with a wholly different name and was refused unopened. Only
 * `dudukogitzki` (Dudu, Athletico-PR) was new, and it earns its place on
 * the bio alone — `@athleticoparanaense`, verified, the kit in the photos
 * in the club's own colours.
 *
 * **Loosening the join to club-only, scored by name overlap with no date
 * requirement, was tried and produced 269 rows of near-total noise.**
 * `P54` accumulates a player's *entire* career at a club across decades,
 * so a common surname collides constantly with the wrong generation:
 * Corinthians' `Guilherme` (born 2007) matched `guilherme`, a Corinthians
 * player born **1991** — sixteen years apart, on a first name alone. That
 * shape repeats across nearly every one of the 269, which is why none of
 * them appear here: without a date to anchor it, a name-only join against
 * a club's full historical roster is not a lead, it is a coincidence
 * generator. Reject candidates whose age gap from a real teammate reads
 * more than a couple of years apart on sight; do not open them looking for
 * corroboration that will not be there.
 */
export const PLAYER_INSTAGRAM: Record<string, string> = {
  "211606": "dudukogitzki",      // Dudu · Athletico-PR
  "192070": "kevinviveros9",     // Kevin Viveros · Athletico-PR
  "278568": "voronov_maksym06",  // Maksym Voronov · Athletico-PR
  "249158": "matheuss_s012",     // Matheus Soares · Athletico-PR
  "187426": "mycaelmoreira",     // Mycael · Athletico-PR
  "1662": "goleirosantosoficial", // Santos · Athletico-PR
  "8606": "stevenmendozaoficial", // Stiven Mendoza · Athletico-PR
  "16476": "bernard",            // Bernard · Atlético-MG
  "1182": "7_dudu",              // Dudu · Atlético-MG
  "7569": "cassierrajr",         // Mateo Cassierra · Atlético-MG
  "1447": "maycon",              // Maycon · Atlético-MG
  "123350": "reinier.jesus",     // Reinier · Atlético-MG
  "46266": "tomascuello28",      // Tomás Cuello · Atlético-MG
  "178854": "victorhg_10_",      // Victor Hugo Gomes · Atlético-MG
  "39954": "eve_stum",           // Everaldo · Bahia
  "1548": "evertonri",           // Éverton Ribeiro · Bahia
  "1073": "gilbertomjr02",       // Gilberto · Bahia
  "1547": "jeanlucas8_",         // Jean Lucas · Bahia
  "15904": "alextelles13",       // Alex Telles · Botafogo
  "2096": "allanmarques91",      // Allan · Botafogo
  "250493": "alvaro_montoro10",  // Alvaro Montoro · Botafogo
  "154595": "criistian_medina",  // Cristian Medina · Botafogo
  "1580": "edenilson",           // Edenilson · Botafogo
  "77": "tucucorrea",            // Joaquín Correa · Botafogo
  "12653": "jr.santos.oficial",  // Júnior Santos · Botafogo
  "286833": "kadirbarria_18",    // Kadir Barría · Botafogo
  "160792": "mateoponte_04",     // Mateo Ponte · Botafogo
  "11198": "fernandosantos_99",  // Fernando · Bragantino
  "1445": "gabriel",             // Gabriel · Bragantino
  "7838": "yannickbolasie",      // Yannick Bolasie · Chapecoense
  "180287": "braiancufre",       // Braian Cufré · Clube do Remo
  "12960": "carlinhos_l9",       // Carlinhos · Clube do Remo
  "169720": "jandirbreno",       // Jája Silva · Clube do Remo
  "119621": "jl_carvalho",       // João Lucas · Clube do Remo
  "168807": "vitorfbueno",       // Vitor Bueno · Clube do Remo
  "73778": "zericardo_99",       // Zé Ricardo · Clube do Remo
  "3789": "carrillo",            // André Carrillo · Corinthians
  "179054": "brenobidon",        // Bidon · Corinthians
  "249314": "felipelongo05",     // Felipe Longo · Corinthians
  "33145": "gpaulista5",         // Gabriel Paulista · Corinthians
  "82991": "hugosouza",          // Hugo Souza · Corinthians
  "3325": "jesselingard",        // Jesse Lingard · Corinthians
  "1614": "matheuspereira_98",   // Matheus Pereira · Corinthians
  "8472": "memphisdepay",        // Memphis Depay · Corinthians
  "1325": "yurialberto",         // Yuri Alberto · Corinthians
  "169022": "brenolopesoficial", // Breno Lopes · Coritiba
  "249479": "jp_chermont",       // João Pedro Chermont · Coritiba
  "30539": "maiconroque",        // Maicon · Coritiba
  "16154": "pedrorocha32",       // Pedro Rocha · Coritiba
  "1572": "rodrigomoledo13",     // Rodrigo Moledo · Coritiba
  "19958": "rodrigor09",         // Rodrigo Rodrigues · Coritiba
  "1266": "fabriciobruno96",     // Fabrício Bruno · Cruzeiro
  "1815": "gersonsantoss",       // Gerson · Cruzeiro
  "181633": "kaikibrunos",       // Kaiki Bruno · Cruzeiro
  "91310": "kaiojorge",          // Kaio Jorge · Cruzeiro
  "178822": "matheuscunha_01",   // Matheus Cunha · Cruzeiro
  "6532": "walacesouza08",       // Walace · Cruzeiro
  "2028": "alxsndro12",          // Alex Sandro · Flamengo
  "1074": "ayrtonlucas",         // Ayrton Lucas · Flamengo
  "7881": "daniluiz2",           // Danilo Luiz da Silva · Flamengo
  "1131": "emerson_royal",       // Emerson Royal · Flamengo
  "1244": "g10dearrascaeta",     // Giorgian De Arrascaeta · Flamengo
  "29012": "carrascall",         // Jorge Carrascal · Flamengo
  "1408": "leortiz33",           // Leo Ortiz · Flamengo
  "11192": "leopereira4",        // Léo Pereira · Flamengo
  "1543": "lucaspaqueta",        // Lucas Paquetá · Flamengo
  "8413": "l.araujo11oficial",   // Luiz Araújo · Flamengo
  "168795": "nicodelacruz10",    // Nicolas de la Cruz · Flamengo
  "1077": "pedroguilherme",      // Pedro · Flamengo
  "178710": "osamuellino",       // Samuel Lino · Flamengo
  "118": "saulniguez",           // Saúl · Flamengo
  "28614": "agus_cano7",         // Agustín Canobbio · Fluminense
  "245200": "facubernal_08",     // Facundo Bernal · Fluminense
  "15929": "guiarana",           // Guilherme Arana · Fluminense
  "21689": "hulkparaiba",        // Hulk · Fluminense
  "1215": "igorrabellooficial",  // Igor Rabello · Fluminense
  "157533": "jkennedy",          // John Kennedy · Fluminense
  "179177": "martinelli.08",     // Martinelli · Fluminense
  "23333": "yefersonsoteldo1006", // Yeferson Soteldo · Fluminense
  "1148": "arthurhmelo",         // Arthur · Grêmio
  "37833": "carlosvinicius95",   // Carlos Vinícius · Grêmio
  "3219": "kichanpavon",         // Cristian Pavón · Grêmio
  "147442": "ericknoriega34",    // Erick Noriega · Grêmio
  "276279": "gabriel_mec__",     // Gabriel Mec · Grêmio (transferido ao Porto em 2026)
  "116177": "furacaotete",       // Tetê · Grêmio
  "1138": "wkannemann",          // Walter Kannemann · Grêmio
  "3230": "willianborges88",     // Willian · Grêmio
  "1129": "alerrandro_souza00",  // Alerrandro · Internacional
  "58": "gabimercado25",         // Gabriel Mercado · Internacional
  "30386": "chinorochet93",      // Sergio Rochet · Internacional
  "95982": "99alesson",          // Alesson · Mirassol
  "272": "gabrielpires.oficial", // Gabriel · Mirassol
  "12818": "eulucasoliveira96",  // Lucas Oliveira · Mirassol
  "1181": "victorluis",          // Victor Luis · Mirassol
  "33153": "andreaspereira",     // Andreas Pereira · Palmeiras
  "115222": "bruno_fuchs",       // Bruno Fuchs · Palmeiras
  "130957": "emimartinez.32",    // Emiliano Martínez · Palmeiras
  "28740": "joacopiquerez",      // Joaquín Piquerez · Palmeiras
  "170698": "flacolopez_10",     // José Manuel López · Palmeiras
  "115559": "khellvensilva",     // Khellven · Palmeiras
  "119594": "mauriciomp7",       // Mauricio · Palmeiras
  "140647": "ramon.sosa17",      // Ramón Sosa · Palmeiras
  "181439": "vitor_roque9",      // Vítor Roque · Palmeiras
  "28708": "christiaan_oliva",   // Christian Oliva · Santos
  "1327": "gabigol",             // Gabriel Barbosa · Santos
  "99380": "gabrielbrazao1",     // Gabriel Brazão · Santos
  "139933": "gabrielmenino00",   // Gabriel Menino · Santos
  "1086": "luanperes94",         // Luan Peres · Santos
  "292398": "nadsonjuan_09",     // Nadson Maia · Santos
  "8491": "neymarjr",            // Neymar · Santos
  "2295": "tomasrincon8",        // Tomás Rincón · Santos
  "1192": "arturvictor",         // Artur Guimaraes · São Paulo
  "3244": "cedricsoares41",      // Cédric · São Paulo
  "276282": "luccamalencar",     // Lucca Marques · São Paulo
  "42901": "lucianoneves10",     // Luciano · São Paulo
  "85523": "marcosantonio",      // Marcos Antônio · São Paulo
  "169542": "pablo_maia02",      // Pablo Maia · São Paulo
  "1832": "rafael.toloi2",       // Rafael Tolói · São Paulo
  "287686": "isa_matos02",       // Isabela Matos · Vasco da Gama
  "28564": "pumitaa_4",          // José Rodríguez · Vasco da Gama
  "176241": "matheus_franca04",  // Matheus França · Vasco da Gama
  "171304": "nmmoreira_79",      // Nuno Moreira · Vasco da Gama
  "179017": "robertrenan03",     // Robert · Vasco da Gama
  "77470": "cacazagueiro",       // Cacá · Vitória
  "166758": "kike_saverio",      // Kike Saverio · Vitória
  "12837": "renatokayzer",       // Renato Kayzer · Vitória
};
