import type { StadiumFacts } from "@/src/types";

/**
 * Hand-maintained, like `broadcasts.ts` and `club-hymns.ts` and for the same
 * reason: **no provider we use carries a stadium at all.** football-data has no
 * venue field at any tier, and CBF's Onde Assistir feed gives only the string
 * `Stadium - City - UF` — a name, a city and a state, and nothing else. Capacity,
 * inauguration and the official name come from nowhere in the pipeline.
 *
 * Keyed by the stadium **slug** (`slugify` of CBF's venue string), because that
 * string is the only thing tying a fixture to a stadium: there is no venue id
 * in any payload. The slug absorbs CBF's casing and accent drift, so `ARENA MRV`
 * and `Arena MRV` resolve to one entry rather than two stadiums.
 *
 * Every value here was read out of the stadium's article on the Portuguese
 * Wikipedia — the infobox's `nome_completo`, `capacidade` and `datainauguração`
 * — rather than recalled. That is the same rule the hymn list follows, and for
 * a sharper reason: a plausible capacity is indistinguishable from a correct
 * one to anyone reading the page, so an unverified number would never be
 * caught. Two stadiums' articles state no inauguration year; `opened` is absent
 * for them rather than guessed.
 *
 * `name` is the popular name, properly cased — what a reader would say out
 * loud. `officialName` is carried only where it genuinely differs, so the page
 * does not print "Arena MRV / Arena MRV".
 *
 * Checked against pt.wikipedia.org on 2026-08-25.
 */
export const STADIUMS: Record<string, StadiumFacts> = {
  "arena-conda": {
    name: "Arena Condá",
    capacity: 19351,
    opened: 1980,
    wikipedia: "Arena Condá",
  },
  "arena-da-baixada": {
    name: "Arena da Baixada",
    officialName: "Estádio Mário Celso Petraglia",
    capacity: 42372,
    opened: 1913,
    wikipedia: "Estádio Mário Celso Petraglia",
  },
  "arena-do-gremio": {
    name: "Arena do Grêmio",
    capacity: 60540,
    opened: 2012,
    wikipedia: "Arena do Grêmio",
  },
  "arena-fonte-nova": {
    name: "Arena Fonte Nova",
    officialName: "Complexo Esportivo Cultural Octávio Mangabeira",
    capacity: 48661,
    opened: 2013,
    wikipedia: "Arena Fonte Nova",
  },
  "arena-mrv": {
    // CBF writes this one "ARENA MRV". The slug is what matches; this is what
    // the page shows.
    name: "Arena MRV",
    capacity: 44892,
    opened: 2023,
    wikipedia: "Arena MRV",
  },
  "beira-rio": {
    name: "Beira-Rio",
    officialName: "Estádio José Pinheiro Borda",
    capacity: 50842,
    opened: 1969,
    wikipedia: "Estádio Beira-Rio",
  },
  "cicero-de-souza-marques": {
    name: "Cícero de Souza Marques",
    officialName: "Estádio Municipal Cícero de Souza Marques",
    capacity: 12000,
    // The article's infobox states no inauguration year — only that the ground
    // was remodelled in 2025. Absent rather than guessed.
    wikipedia: "Estádio Municipal Cícero de Souza Marques",
  },
  "couto-pereira": {
    name: "Couto Pereira",
    officialName: "Estádio Major Antônio Couto Pereira",
    capacity: 40502,
    opened: 1932,
    wikipedia: "Estádio Major Antônio Couto Pereira",
  },
  "jose-maria-de-campos-maia": {
    name: "José Maria de Campos Maia",
    officialName: "Estádio Municipal José Maria de Campos Maia",
    capacity: 15000,
    opened: 1925,
    wikipedia: "Estádio Municipal José Maria de Campos Maia",
  },
  mangueirao: {
    name: "Mangueirão",
    officialName: "Estádio Estadual Jornalista Edgar Augusto Proença",
    capacity: 53645,
    opened: 1978,
    wikipedia: "Mangueirão",
  },
  "manoel-barradas": {
    name: "Manoel Barradas",
    capacity: 30793,
    opened: 1986,
    wikipedia: "Estádio Manoel Barradas",
  },
  maracana: {
    name: "Maracanã",
    officialName: "Estádio Jornalista Mário Filho",
    capacity: 78838,
    opened: 1950,
    wikipedia: "Estádio Jornalista Mário Filho",
  },
  mineirao: {
    name: "Mineirão",
    officialName: "Estádio Governador Magalhães Pinto",
    capacity: 61927,
    opened: 1965,
    wikipedia: "Estádio Governador Magalhães Pinto",
  },
  morumbi: {
    name: "Morumbi",
    officialName: "Estádio Cícero Pompeu de Toledo",
    capacity: 66795,
    opened: 1960,
    wikipedia: "Estádio do Morumbi",
  },
  "neo-quimica-arena": {
    name: "Neo Química Arena",
    capacity: 49082,
    opened: 2014,
    wikipedia: "Neo Química Arena",
  },
  "nilton-santos": {
    name: "Nilton Santos",
    officialName: "Estádio Olímpico Nilton Santos",
    capacity: 46831,
    opened: 2007,
    wikipedia: "Estádio Olímpico Nilton Santos",
  },
  "nubank-parque": {
    // Allianz Parque until 2026; CBF already uses the new name, and so does the
    // article. No inauguration year in its infobox.
    name: "Nubank Parque",
    capacity: 43723,
    wikipedia: "Nubank Parque",
  },
  "sao-januario": {
    name: "São Januário",
    officialName: "Estádio Vasco da Gama",
    capacity: 21880,
    opened: 1927,
    wikipedia: "Estádio Vasco da Gama",
  },
  "vila-belmiro": {
    name: "Vila Belmiro",
    officialName: "Estádio Urbano Caldeira",
    capacity: 17923,
    opened: 1916,
    wikipedia: "Estádio Urbano Caldeira",
  },
};
