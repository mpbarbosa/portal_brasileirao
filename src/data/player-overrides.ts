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
};
