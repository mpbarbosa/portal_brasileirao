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
 * in `club-core.ts`, reused rather than reimplemented for the same reason
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
 */
export const PLAYER_INSTAGRAM: Record<string, string> = {
  "192070": "kevinviveros9",     // Kevin Viveros · Athletico-PR
  "1662": "goleirosantosoficial", // Santos · Athletico-PR
  "8606": "stevenmendozaoficial", // Stiven Mendoza · Athletico-PR
  "1182": "7_dudu",              // Dudu · Atlético-MG
  "7569": "cassierrajr",         // Mateo Cassierra · Atlético-MG
  "1447": "maycon",              // Maycon · Atlético-MG
  "123350": "reinier.jesus",     // Reinier · Atlético-MG
  "46266": "tomascuello28",      // Tomás Cuello · Atlético-MG
  "178854": "victorhg_10_",      // Victor Hugo Gomes · Atlético-MG
  "1548": "evertonri",           // Éverton Ribeiro · Bahia
  "1547": "jeanlucas8_",         // Jean Lucas · Bahia
  "15904": "alextelles13",       // Alex Telles · Botafogo
  "2096": "allanmarques91",      // Allan · Botafogo
  "250493": "alvaro_montoro10",  // Alvaro Montoro · Botafogo
  "1580": "edenilson",           // Edenilson · Botafogo
  "12653": "jr.santos.oficial",  // Júnior Santos · Botafogo
  "286833": "kadirbarria_18",    // Kadir Barría · Botafogo
  "160792": "mateoponte_04",     // Mateo Ponte · Botafogo
  "7838": "yannickbolasie",      // Yannick Bolasie · Chapecoense
  "119621": "jl_carvalho",       // João Lucas · Clube do Remo
  "168807": "vitorfbueno",       // Vitor Bueno · Clube do Remo
  "3789": "carrillo",            // André Carrillo · Corinthians
  "179054": "brenobidon",        // Bidon · Corinthians
  "33145": "gpaulista5",         // Gabriel Paulista · Corinthians
  "82991": "hugosouza",          // Hugo Souza · Corinthians
  "3325": "jesselingard",        // Jesse Lingard · Corinthians
  "1614": "matheuspereira_98",   // Matheus Pereira · Corinthians
  "8472": "memphisdepay",        // Memphis Depay · Corinthians
  "1325": "yurialberto",         // Yuri Alberto · Corinthians
  "169022": "brenolopesoficial", // Breno Lopes · Coritiba
  "249479": "jp_chermont",       // João Pedro Chermont · Coritiba
  "16154": "pedrorocha32",       // Pedro Rocha · Coritiba
  "1572": "rodrigomoledo13",     // Rodrigo Moledo · Coritiba
  "1266": "fabriciobruno96",     // Fabrício Bruno · Cruzeiro
  "1815": "gersonsantoss",       // Gerson · Cruzeiro
  "91310": "kaiojorge",          // Kaio Jorge · Cruzeiro
  "178822": "matheuscunha_01",   // Matheus Cunha · Cruzeiro
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
  "118": "saulniguez",           // Saúl · Flamengo
  "28614": "agus_cano7",         // Agustín Canobbio · Fluminense
  "245200": "facubernal_08",     // Facundo Bernal · Fluminense
  "15929": "guiarana",           // Guilherme Arana · Fluminense
  "21689": "hulkparaiba",        // Hulk · Fluminense
  "1215": "igorrabellooficial",  // Igor Rabello · Fluminense
  "157533": "jkennedy",          // John Kennedy · Fluminense
  "179177": "martinelli.08",     // Martinelli · Fluminense
  "23333": "yefersonsoteldo1006", // Yeferson Soteldo · Fluminense
  "37833": "carlosvinicius95",   // Carlos Vinícius · Grêmio
  "3219": "kichanpavon",         // Cristian Pavón · Grêmio
  "147442": "ericknoriega34",    // Erick Noriega · Grêmio
  "116177": "furacaotete",       // Tetê · Grêmio
  "1138": "wkannemann",          // Walter Kannemann · Grêmio
  "1129": "alerrandro_souza00",  // Alerrandro · Internacional
  "58": "gabimercado25",         // Gabriel Mercado · Internacional
  "30386": "chinorochet93",      // Sergio Rochet · Internacional
  "272": "gabrielpires.oficial", // Gabriel · Mirassol
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
  "99380": "gabrielbrazao1",     // Gabriel Brazão · Santos
  "139933": "gabrielmenino00",   // Gabriel Menino · Santos
  "1086": "luanperes94",         // Luan Peres · Santos
  "8491": "neymarjr",            // Neymar · Santos
  "2295": "tomasrincon8",        // Tomás Rincón · Santos
  "3244": "cedricsoares41",      // Cédric · São Paulo
  "85523": "marcosantonio",      // Marcos Antônio · São Paulo
  "169542": "pablo_maia02",      // Pablo Maia · São Paulo
  "171304": "nmmoreira_79",      // Nuno Moreira · Vasco da Gama
  "179017": "robertrenan03",     // Robert · Vasco da Gama
  "77470": "cacazagueiro",       // Cacá · Vitória
  "166758": "kike_saverio",      // Kike Saverio · Vitória
};
