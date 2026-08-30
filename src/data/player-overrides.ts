import type { PlayerOverride } from "@/src/types";

/**
 * Corrections to what the provider reports about a player, keyed by **player
 * id** like `player-instagram.ts`, `player-wikipedia.ts` and
 * `player-sofascore.ts` beside it — and the only one of the four that
 * *corrects* the provider rather than adding to it.
 *
 * The id is what makes an entry safe to apply. A table keyed by name would
 * correct everybody who shares the string, and the division carries two Dudus
 * at one club — the same collision `comparePlayers` breaks ties on.
 *
 * **One file with optional fields, not one file per field.** It held only names
 * for the hour between #213 and #214; a parallel
 * `player-nationality-overrides.ts` would have meant two near-identical doc
 * comments stating two versions of the same rule, and a third file the first
 * time somebody wants a position. The per-field rules differ and are stated on
 * `PlayerOverride` in `src/types.ts`, which is where a reader adding an entry
 * will look.
 *
 * **`src/data/squads.ts` cannot carry any of this.** It is generated, so
 * `sync-seed-data` overwrites a hand-edit on its next run and says nothing.
 * Overriding at serve time survives the regeneration. That is also why
 * `tests/player-core.test.ts` asserts every field here still *disagrees* with
 * the squad list: an entry only corrects, never fills a gap and never restates
 * what the provider already says, and the day upstream fixes a value the seed
 * regenerates and the entry becomes a silent no-op nobody would think to
 * delete.
 *
 * Each entry records **what upstream serves** as well as what is true, because
 * once the wrong value is off the page there is nothing left to check the
 * correction against.
 */
export const PLAYER_OVERRIDES: Record<string, PlayerOverride> = {
  // Corinthians' fourth goalkeeper. Upstream serves "Felipexxx": `firstName`
  // empty, `lastName` "Felipe", and a placeholder suffix on the composed name.
  // Read from /v4/persons/249314 on 2026-08-29, whose own `lastUpdated` is
  // 2026-03-19, so it is their standing record rather than a stale snapshot of
  // ours. Shirt 40, born 2005-03-05 — the date pt.wikipedia gives for "Felipe
  // Longo" and the date `squads.ts` already carries for this id. The club's own
  // elenco page lists him first among the goleiros, at 40.
  "249314": { name: "Felipe Longo" },

  // Upstream serves `nationality: "Bulgaria"` (/v4/persons/1609, `lastUpdated`
  // 2025-03-10). He is Brazilian: born in Atibaia/SP, Wikidata Q27836019 records
  // `P27` = Brasil and nothing else, and pt.wikipedia's infobox reads
  // `nacionalidade = {{BRAn|o}}`. The likely mechanism, worth recording because
  // it says where else to look: he played for **Ludogorets** — Supercopa da
  // Bulgária 2021 — and the article files him under *Brasileiros expatriados na
  // Bulgária*, so a country-of-club appears to have leaked into the field. The
  // cause is a guess; the error is not.
  //
  // The value is the provider's own vocabulary, never the pt-BR label:
  // `nationalityLabel` still does the translating, so there is one table rather
  // than two ways for a country to reach the page.
  "1609": { nationality: "Brazil" },

  // ---------------------------------------------------------------------
  // Positions. Six Corinthians players upstream files on the wrong LINE —
  // not a shade within one — each confirmed twice over: the club's own
  // elenco page puts them in a different section, and their article states
  // a role, and the article is joined to the player on the exact date of
  // birth `squads.ts` carries. Read 2026-08-29.
  //
  // Corinthians only, deliberately: that is the club whose squad was
  // validated, and the other nineteen will have their own. Partial coverage
  // is the norm for a curated file here, and the method above is the whole
  // of what a later pass needs.
  //
  // NOT here: Jesse Lingard (3325). Upstream says Midfield, the club says
  // atacantes, and his article says "meio-campista ou atacante" — the
  // sources do not agree, so the provider's value stands. He is the reason
  // the bar is stated as two sources rather than one.
  // ---------------------------------------------------------------------

  // Upstream: "Defence". Club: meias. Article: "atua como volante"
  // (b. 1996-12-31). The worst of the six on the page — a defensive
  // midfielder listed among the Defensores, which is a claim about what he
  // does rather than a nuance of it.
  "103611": { position: "Defensive Midfield" },

  // Upstream: "Defence". Club: meias. "André Luiz Santos Dias" — "atua como
  // volante" (b. 2006-06-20). Note the club writes him as plain "André".
  "285271": { position: "Defensive Midfield" },

  // Upstream: "Midfield". Club: atacantes. "Kayke Ferrari" — "atua como
  // ponta-esquerda" (b. 2004-04-28).
  "211607": { position: "Left Winger" },

  // Upstream: "Midfield". Club: atacantes. "Gui Negão" — "atua como
  // centroavante" (b. 2007-02-06). The club calls him Gui Negão and we show
  // "Guilherme"; that stays, because an ambiguous real name is still a name.
  "259933": { position: "Centre-Forward" },

  // Upstream: "Midfield". Club: atacantes. Article: "atua como atacante"
  // (b. 1993-03-09). Broad rather than specific on purpose: the source says
  // attacker and names no role, and inventing one would be the taste this
  // file exists to keep out.
  "3703": { position: "Offence" },

  // Upstream: "Offence" — the only one wrong in the other direction. Club:
  // meias. "Diego da Cruz Lopes" — "atua como meio-campista"
  // (b. 2007-09-16). Broad, for the same reason as Labyad.
  "275104": { position: "Midfield" },

  // ---------------------------------------------------------------------
  // Dates of birth. Two, from the same division-wide sweep that added the
  // ptwiki articles — and found the error running **both ways**, which is
  // why neither side is presumed right here. Read 2026-08-30.
  //
  // The evidence cannot be the usual join: every other entry in this file
  // is trusted because it was matched to the player on exact date of
  // birth, and that is unavailable when the date is the thing in dispute.
  // So each of these rests on the article being established as this player
  // by its **club and role** — matching the row — and on **several
  // independent sources agreeing against the provider**: Wikidata's P569,
  // plus the article in English, Spanish and Italian.
  //
  // NOT here, and this is the half that keeps the bar honest: three players
  // whose pt.wikipedia article disagrees with us and is itself the outlier.
  // Matheus Martins (169234), Lucas Ramon (13647) and Lucas Arcanjo
  // (169696) are served correctly by the provider, and are absent from
  // `player-wikipedia.ts` for that reason — see the note there. A
  // disagreeing article is not evidence; a disagreeing article contradicted
  // by every other source is evidence of the *article* being wrong.
  // ---------------------------------------------------------------------

  // Upstream serves 1999-10-22; he was born 1998-10-22, a year earlier.
  // Wikidata Q61940543 carries **both** dates, one reference each, so it
  // does not settle it alone — the three articles do, and they are
  // unanimous: pt "22 de outubro de 1998", en "22 October 1998", es "22 de
  // octubre de 1998", it "22 ottobre 1998". The es article is the one to
  // weigh most for an Argentine, and it names Wilde, Buenos Aires and Remo,
  // which is this row's club. The card read 26 where he is 27.
  "113224": { dateOfBirth: "1998-10-22" },

  // Upstream serves 1991-10-15; he was born 1993-10-15, two years later.
  // Same shape as Picco: Wikidata Q28151216 holds both dates with one
  // reference each, and pt, en, es and it all say 1993. The es article
  // names Zona Bananera and a Colombian volante, which is this row. The
  // biggest visible error of the five chased — the card read 34 where he
  // is 32.
  "3738": { dateOfBirth: "1993-10-15" },
};
