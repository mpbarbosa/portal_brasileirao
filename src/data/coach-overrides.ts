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
  // Fluminense. Served as "Luis Zubeldía", demitido em 2026-08-13 — ver
  // `events.ts`'s `fluminense-zubeldia`. Marcão (Marco Aurélio de Oliveira),
  // auxiliar permanente do clube desde 2014, assumiu interinamente no dia
  // seguinte e foi **efetivado** — não apenas interino — em 2026-08-22, no
  // Maracanã, logo depois da vitória de virada por 2x1 sobre o Remo pela 24ª
  // rodada. Confirmado por múltiplas fontes de imprensa independentes, todas
  // nomeando a mesma data e o mesmo anúncio do presidente Mattheus Montenegro:
  // Gazeta Esportiva ("Fluminense oficializa Marcão"), Folha do Leste
  // ("Fluminense efetiva Marcão"), CNN Brasil, Goal.com. `events.ts` só
  // registava a fase interina; a efetivação é um acontecimento mais recente
  // que este ficheiro escolhe não duplicar lá — a correcção aqui já é a
  // resposta que interessa a um leitor do cartão do clube.
  "1765": "Marcão",

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

  // Botafogo. Served as "Franclim Carvalho", demitido em 2026-08-18 — ver
  // `events.ts`'s `botafogo-franclim`. Rodrigo Bellão, treinador do sub-20 do
  // clube, assumiu interinamente o time principal. Confirmado por
  // pt.wikipedia's infobox (`| treinador = [[Rodrigo Bellão]]`, com citação da
  // própria ge.globo da demissão de Franclim) e por imprensa independente
  // datada de setembro de 2026: ESPN ("Rodrigo Bellão ganha prestígio..."),
  // gazetabotafogo.com ("respaldado pela diretoria... técnico interino... até
  // 19/9"), FogãoNET. **A interinidade tem uma data de revisão próxima
  // (19/9)** — a mais frágil das cinco correcções desta leva, e a mais
  // provável de precisar de outra em breve.
  "1770": "Rodrigo Bellão",

  // Chapecoense. Served as "Fábio Matias", demitido em 2026-05-25 — ver
  // `events.ts`'s `chapecoense-fabio-matias`. Rafael Lacerda foi anunciado
  // cinco dias depois, em 2026-05-30, com contrato até o fim de 2026.
  // Confirmado pelo próprio site do clube ("Fechado com a Chape: Rafael
  // Lacerda é o novo técnico") e por imprensa independente da mesma data:
  // Gazeta Esportiva, ClicRDC, esportegoiano.com.
  "1772": "Rafael Lacerda",

  // Vasco. Served as "Possato", corroborated by nothing. **This entry used to
  // be deliberately absent** because the three sources this file checks
  // disagreed with each other: en.wikipedia said Pedro Emanuel, Wikidata's
  // preferred P286 said Fábio Carille (from 2024-12-19), and pt.wikipedia's
  // infobox carried no coach field at all. That is resolved now, not by one
  // of the three catching up but by a fourth: Vasco's own site announced
  // Pedro Emanuel on 2026-07-10 ("Pedro Emanuel é o novo técnico do Vasco da
  // Gama"), matching en.wikipedia's claim and corroborated independently by
  // NETVASCO, Super Rádio Tupi, Golo FM and Diário do Rio de Janeiro, all
  // naming the same date. Doubt that the provider was right was never
  // evidence of what was right — this is what changed.
  "1780": "Pedro Emanuel",

  // Internacional. Served as "Leonardo Ramos" — a real person at the club,
  // but the sub-20 técnico, not the first team's. A different kind of
  // mistake from the other four here: not a stale name but the wrong squad
  // entirely. Paulo Pezzolano is the men's first-team técnico, announced
  // 2025-12-18/19, contract until December 2026 — confirmed by the club's own
  // site ("Paulo Pezzolano é o novo técnico do Internacional") and
  // independently by ESPN and O Tempo, both dated the same week, and matching
  // pt.wikipedia's infobox. No announcement of a further change was found.
  "6684": "Paulo Pezzolano",
};
