import type { ClubCode } from "@/src/types";

/**
 * Técnicos the provider names **wrongly**, keyed by club code.
 *
 * The sibling of `player-overrides.ts`, and it exists for the same reason: the
 * provider is the source, `clubs.ts` and `squads.ts` are generated, and a
 * hand-edit to either is overwritten by the next `sync-seed-data` without a
 * word. Correcting at serve time survives the regeneration.
 *
 * **The bar is the one `player-overrides.ts` sets for `nationality`, not the one
 * it sets for `name`: correct only where the value is factually wrong — a
 * different person — and only where the right answer can be established.** Both
 * halves bind. A value that is merely odd-looking, abbreviated or a nickname
 * stays: the provider's spelling is what every other football site shows the
 * same reader, and this file is not a place to prefer one rendering to another.
 *
 * **Two independent sources must agree against the provider**, which is the
 * `position` field's rule one file over. A técnico changes several times a
 * season, so a single article is worth less here than it is for a birth date —
 * and the sources rot in different directions: an infobox is edited within
 * hours of a sacking, while Wikidata's `P286` keeps a superseded claim ranked
 * `preferred` for years. Where they disagree, the provider stands.
 *
 * Every entry below was established that way, and the working is in the commit
 * that added it rather than summarised here, where it would go stale.
 */
export const COACH_OVERRIDES: Record<ClubCode, string> = {
  // Grêmio. Served as "Jéssica Lima", who is not the men's first-team técnico.
  //
  // **Updated 2026-09-14, and this is the file's own predicted failure mode
  // arriving.** Grêmio demitiu Luís Castro em 2026-09-13, um dia depois da
  // derrota por 2x1 contra o Vasco na Arena, com o coordenador técnico Luiz
  // Felipe Scolari (Felipão) assumindo o comando interinamente — confirmado
  // por cinco fontes de imprensa independentes, todas datadas de 2026-09-13
  // (VAVEL, Jornal do Comércio, Portal do Gremista, aRede, portalgilbertosilva).
  // pt.wikipedia's infobox already reads `[[Felipão (treinador de
  // futebol)|Luiz Felipe Scolari]] (interino)` — checked the raw wikitext
  // directly. **Wikidata's P286 has NOT caught up**: it still ranks Castro's
  // claim `preferred` with no end date, exactly the lag this file's own header
  // comment already names ("Wikidata's P286 keeps a superseded claim ranked
  // preferred for years"). That is source staleness rather than a genuine
  // disagreement about who holds the job today, so it does not trigger the
  // "where they disagree, the provider stands" clause — the provider (still
  // serving "Jéssica Lima") is not a candidate answer either way.
  "1767": "Luiz Felipe Scolari",

  // Athletico-PR. Served as "João Eduardo Louro Baptista Cr" — a different
  // person, and cut short. pt.wikipedia and en.wikipedia both name Odair
  // Hellmann. Wikidata is the outlier and stale: its preferred P286 still says
  // Maurício Barbieri, from 2024-12-16.
  "1768": "Odair Hellmann",

  // Vasco is DELIBERATELY ABSENT, and the reason belongs here rather than in a
  // commit nobody re-reads. It is served as "Possato", which no source
  // corroborates — but the sources do not corroborate each other either:
  // en.wikipedia says Pedro Emanuel, Wikidata's preferred P286 says Fábio
  // Carille (from 2024-12-19), and pt.wikipedia's infobox carries no coach
  // field at all. Doubt that the provider is right is not the same as knowing
  // what is right, and this file may only hold the second. Absence of a source
  // is not evidence of an error — `player-overrides.ts`' rule, met again.
};
