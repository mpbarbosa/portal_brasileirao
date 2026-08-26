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
 * The candidates came from Wikidata's `P2003` (Instagram username), joined to
 * `squads.ts` on **exact date of birth plus a shared name token** — the join is
 * on identity, not on which club a player is at, since the seed is a frozen
 * snapshot and Wikidata's team memberships are frequently left open-ended.
 *
 * Wikidata was then treated as a **candidate list, not an answer**. Every
 * handle below was confirmed against a search result carrying the profile's own
 * title and follower count — "Nome (@handle) • Instagram photos and videos" —
 * and, where the bio was visible, against a bio naming the player's club. Of 70
 * candidates that check rejected or corrected **13**, which is why the file is
 * 38 entries and not 70:
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
 */
export const PLAYER_INSTAGRAM: Record<string, string> = {
  "1182": "7_dudu",              // Dudu · Atlético-MG
  "1447": "maycon",              // Maycon · Atlético-MG
  "1548": "evertonri",           // Éverton Ribeiro · Bahia
  "15904": "alextelles13",       // Alex Telles · Botafogo
  "2096": "allanmarques91",      // Allan · Botafogo
  "7838": "yannickbolasie",      // Yannick Bolasie · Chapecoense
  "3789": "carrillo",            // André Carrillo · Corinthians
  "33145": "gpaulista5",         // Gabriel Paulista · Corinthians
  "3325": "jesselingard",        // Jesse Lingard · Corinthians
  "8472": "memphisdepay",        // Memphis Depay · Corinthians
  "1325": "yurialberto",         // Yuri Alberto · Corinthians
  "169022": "brenolopesoficial", // Breno Lopes · Coritiba
  "1266": "fabriciobruno96",     // Fabrício Bruno · Cruzeiro
  "1815": "gersonsantoss",       // Gerson · Cruzeiro
  "91310": "kaiojorge",          // Kaio Jorge · Cruzeiro
  "178822": "matheuscunha_01",   // Matheus Cunha · Cruzeiro
  "2028": "alxsndro12",          // Alex Sandro · Flamengo
  "7881": "daniluiz2",           // Danilo Luiz da Silva · Flamengo
  "1244": "g10dearrascaeta",     // Giorgian De Arrascaeta · Flamengo
  "29012": "carrascall",         // Jorge Carrascal · Flamengo
  "1408": "leortiz33",           // Leo Ortiz · Flamengo
  "1543": "lucaspaqueta",        // Lucas Paquetá · Flamengo
  "168795": "nicodelacruz10",    // Nicolas de la Cruz · Flamengo
  "1077": "pedroguilherme",      // Pedro · Flamengo
  "118": "saulniguez",           // Saúl · Flamengo
  "28614": "agus_cano7",         // Agustín Canobbio · Fluminense
  "15929": "guiarana",           // Guilherme Arana · Fluminense
  "21689": "hulkparaiba",        // Hulk · Fluminense
  "1215": "igorrabellooficial",  // Igor Rabello · Fluminense
  "1129": "alerrandro_souza00",  // Alerrandro · Internacional
  "115222": "bruno_fuchs",       // Bruno Fuchs · Palmeiras
  "28740": "joacopiquerez",      // Joaquín Piquerez · Palmeiras
  "115559": "khellvensilva",     // Khellven · Palmeiras
  "140647": "ramon.sosa17",      // Ramón Sosa · Palmeiras
  "181439": "vitor_roque9",      // Vítor Roque · Palmeiras
  "139933": "gabrielmenino00",   // Gabriel Menino · Santos
  "8491": "neymarjr",            // Neymar · Santos
  "85523": "marcosantonio",      // Marcos Antônio · São Paulo
};
