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
 * `photo` names a file on **Wikimedia Commons**, and is the one field here that
 * carries an obligation rather than a fact. Every licence in use below except
 * CC0 requires the photographer to be named wherever the picture appears, so
 * `credit`, `license` and `licenseUrl` are stored beside the filename and the
 * page renders all three — a stadium may have no photo, but it may not have an
 * unattributed one. Where Commons publishes an explicit `Attribution` field the
 * photographer has dictated the wording, and that wording is copied verbatim
 * (the Morumbi is the one that does).
 *
 * Each file was **looked at** before being written down, not merely resolved.
 * The lead image of a Wikipedia article is not reliably a photograph: the
 * Maracanã, the Mineirão and the Arena do Grêmio all lead with the ground's
 * *logo*, and one candidate for the Nilton Santos is described on Commons as a
 * journalist posing outside it. A filename that reads correctly is no evidence
 * at all about what the picture shows — the same trap the capacities above
 * document, one step further along, because a wrong photo is wrong in a way
 * only eyes can catch.
 *
 * `alt` is written from that same viewing, in pt-BR. It describes the picture
 * rather than repeating the name, which the heading directly above it already
 * gives.
 *
 * `npm run check-stadium-photos` re-asks Commons whether every file still
 * exists and whether the credit and licence recorded here still match what it
 * publishes. It cannot tell you the photo is of the right ground; that part
 * stays with whoever looks.
 *
 * Checked against pt.wikipedia.org and commons.wikimedia.org on 2026-08-25.
 */
export const STADIUMS: Record<string, StadiumFacts> = {
  "arena-conda": {
    name: "Arena Condá",
    capacity: 19351,
    opened: 1980,
    wikipedia: "Arena Condá",
    coordinates: [-27.1041, -52.607],
    photo: {
      file: "Arena Condá.jpg",
      alt:
        "As arquibancadas verdes e brancas e o gramado da Arena Condá, com Chapecó ao fundo",
      credit: "Rafinha C.",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "arena-da-baixada": {
    name: "Arena da Baixada",
    officialName: "Estádio Mário Celso Petraglia",
    capacity: 42372,
    opened: 1913,
    wikipedia: "Estádio Mário Celso Petraglia",
    coordinates: [-25.448333, -49.276944],
    photo: {
      file: "Arenadabaixada2.jpg",
      alt:
        "Vista aérea da Arena da Baixada cercada pelos prédios de Curitiba",
      credit: "Gustavo Paolo",
      license: "CC0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
  },
  "arena-do-gremio": {
    name: "Arena do Grêmio",
    capacity: 60540,
    opened: 2012,
    wikipedia: "Arena do Grêmio",
    coordinates: [-29.973444, -51.194403],
    photo: {
      file: "Arena do Grêmio - 26out2024.jpg",
      alt:
        "O gramado e as arquibancadas lotadas da Arena do Grêmio em dia de jogo",
      credit: "ElFerno",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    },
  },
  "arena-fonte-nova": {
    name: "Arena Fonte Nova",
    officialName: "Complexo Esportivo Cultural Octávio Mangabeira",
    capacity: 48661,
    opened: 2013,
    wikipedia: "Arena Fonte Nova",
    coordinates: [-12.978819, -38.504253],
    photo: {
      file: "Arena Fonte Nova view from lake (zoom).jpg",
      alt:
        "A Arena Fonte Nova vista do outro lado do Dique do Tororó",
      // Verbatim from Commons, trailing semicolon and all. The credit line
      // is what the licence obliges us to print, so it is not ours to tidy.
      credit: "Faquini Produção Fotográfica; Fotógrafo David Campbell;",
      license: "CC BY 3.0 BR",
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/br/",
    },
  },
  "arena-mrv": {
    // CBF writes this one "ARENA MRV". The slug is what matches; this is what
    // the page shows.
    name: "Arena MRV",
    capacity: 44892,
    opened: 2023,
    wikipedia: "Arena MRV",
    coordinates: [-19.930556, -44.016111],
    photo: {
      file: "ARENA MRV.jpg",
      alt:
        "Vista aérea da Arena MRV, com Belo Horizonte e a serra ao fundo",
      credit: "Heuler.silva",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "beira-rio": {
    name: "Beira-Rio",
    officialName: "Estádio José Pinheiro Borda",
    capacity: 50842,
    opened: 1969,
    wikipedia: "Estádio Beira-Rio",
    coordinates: [-30.065614, -51.236086],
    photo: {
      file: "Beira-Rio-Stadium-Porto-Alegre-Brazil.jpg",
      alt:
        "O Beira-Rio iluminado e lotado durante um jogo à noite",
      credit: "Israel Heldt",
      license: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    },
  },
  "cicero-de-souza-marques": {
    name: "Cícero de Souza Marques",
    officialName: "Estádio Municipal Cícero de Souza Marques",
    capacity: 12000,
    // The article's infobox states no inauguration year — only that the ground
    // was remodelled in 2025. Absent rather than guessed.
    wikipedia: "Estádio Municipal Cícero de Souza Marques",
    coordinates: [-22.950935, -46.530224],
    photo: {
      file: "Estádio Cícero de Souza Marques (3).jpg",
      alt:
        "Vista aérea do estádio Cícero de Souza Marques e do bairro ao redor",
      credit: "BP Drones",
      license: "CC BY 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    },
  },
  "couto-pereira": {
    name: "Couto Pereira",
    officialName: "Estádio Major Antônio Couto Pereira",
    capacity: 40502,
    opened: 1932,
    wikipedia: "Estádio Major Antônio Couto Pereira",
    coordinates: [-25.421111, -49.2595],
    photo: {
      file: "Estádio Major Antônio Couto Pereira (17819160010).jpg",
      alt:
        "A fachada do Couto Pereira, com o letreiro do estádio sobre a entrada",
      credit: "Roberto Sabino from Campinas - SP, BRAZIL",
      license: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    },
  },
  "jose-maria-de-campos-maia": {
    name: "José Maria de Campos Maia",
    officialName: "Estádio Municipal José Maria de Campos Maia",
    capacity: 15000,
    opened: 1925,
    wikipedia: "Estádio Municipal José Maria de Campos Maia",
    coordinates: [-20.822392, -49.506422],
    photo: {
      file: "Patinhas esteve aqui - Estadio Mirassol 2 - panoramio.jpg",
      alt:
        "O gramado do José Maria de Campos Maia visto da arquibancada",
      credit: "Renato Patinhas",
      license: "CC BY 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    },
  },
  mangueirao: {
    name: "Mangueirão",
    officialName: "Estádio Estadual Jornalista Edgar Augusto Proença",
    capacity: 53645,
    opened: 1978,
    wikipedia: "Mangueirão",
    coordinates: [-1.381111, -48.444],
    photo: {
      file: "Mangueirão 2025.jpg",
      alt:
        "O gramado e o anel de arquibancadas do Mangueirão em dia de jogo",
      credit: "Hiarley Marques",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "manoel-barradas": {
    name: "Manoel Barradas",
    capacity: 30793,
    opened: 1986,
    wikipedia: "Estádio Manoel Barradas",
    coordinates: [-12.917926, -38.428117],
    photo: {
      file: "Estádio Barradão - Esporte Clube Vitória 8.jpg",
      alt:
        "O Barradão cheio, visto de trás de um dos gols",
      credit: "Jaorge",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  maracana: {
    name: "Maracanã",
    officialName: "Estádio Jornalista Mário Filho",
    capacity: 78838,
    opened: 1950,
    wikipedia: "Estádio Jornalista Mário Filho",
    coordinates: [-22.912222, -43.230278],
    photo: {
      file: "Aerea2 maracana.jpg",
      alt:
        "Vista aérea do Maracanã e do complexo esportivo ao seu redor",
      credit: "Erica Ramalho/Portal da Copa/Março de 2013",
      license: "CC BY 3.0 BR",
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/br/",
    },
  },
  mineirao: {
    name: "Mineirão",
    officialName: "Estádio Governador Magalhães Pinto",
    capacity: 61927,
    opened: 1965,
    wikipedia: "Estádio Governador Magalhães Pinto",
    coordinates: [-19.865833, -43.970833],
    photo: {
      file: "Mineirao, January 2020.jpg",
      alt:
        "A fachada e a marquise do Mineirão vistas da esplanada",
      credit: "Sudhertzen",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  morumbi: {
    name: "Morumbi",
    officialName: "Estádio Cícero Pompeu de Toledo",
    capacity: 66795,
    opened: 1960,
    wikipedia: "Estádio do Morumbi",
    coordinates: [-23.600125, -46.720156],
    photo: {
      file: "Estádio do Morumbi.jpg",
      alt:
        "Vista aérea do Morumbi cercado pelos bairros da zona sul de São Paulo",
      credit: "Arne Müseler / www.arne-mueseler.com",
      license: "CC BY-SA 3.0 DE",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/de/",
    },
  },
  "neo-quimica-arena": {
    name: "Neo Química Arena",
    capacity: 49082,
    opened: 2014,
    wikipedia: "Neo Química Arena",
    coordinates: [-23.545556, -46.474],
    photo: {
      file: "ARENA CORINTHIANS.jpg",
      alt:
        "Vista aérea da Neo Química Arena, em Itaquera",
      credit: "Alexandre Breveglieri",
      license: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    },
  },
  "nilton-santos": {
    name: "Nilton Santos",
    officialName: "Estádio Olímpico Nilton Santos",
    capacity: 46831,
    opened: 2007,
    wikipedia: "Estádio Olímpico Nilton Santos",
    coordinates: [-22.893172, -43.292269],
    photo: {
      // Commons describes this one as a journalist posing outside the
      // ground. The frame is the pitch and the Botafogo mosaic, with nobody
      // in it — which is why the file was opened rather than trusted.
      file: "Nilton Santos, Estádio Nilton Santos.jpg",
      alt:
        "O gramado do Nilton Santos e o mosaico do Botafogo nas arquibancadas",
      credit: "Andrea Hernández",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "nubank-parque": {
    // Allianz Parque until 2026; CBF already uses the new name, and so does the
    // article. No inauguration year in its infobox.
    name: "Nubank Parque",
    capacity: 43723,
    wikipedia: "Nubank Parque",
    coordinates: [-23.527556, -46.678417],
    photo: {
      file: "Imagens da Cidade de São Paulo e Zoológico da Capital Paulista. (47480340301).jpg",
      alt:
        "Vista aérea do Nubank Parque, na zona oeste de São Paulo",
      credit: "Governo do Estado de São Paulo",
      license: "CC BY 2.0",
      licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
    },
  },
  "sao-januario": {
    name: "São Januário",
    officialName: "Estádio Vasco da Gama",
    capacity: 21880,
    opened: 1927,
    wikipedia: "Estádio Vasco da Gama",
    coordinates: [-22.890917, -43.228253],
    photo: {
      file: "Estádio de São Januário.jpg",
      alt:
        "O gramado e as arquibancadas de São Januário, com o Rio de Janeiro ao fundo",
      credit: "Bernardo1989",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
  "vila-belmiro": {
    name: "Vila Belmiro",
    officialName: "Estádio Urbano Caldeira",
    capacity: 17923,
    opened: 1916,
    wikipedia: "Estádio Urbano Caldeira",
    coordinates: [-23.951111, -46.338889],
    photo: {
      file: "Vila Belmiro pre-match Santos vs Grêmio 2021.jpg",
      alt:
        "A Vila Belmiro pouco antes de um jogo, vista da arquibancada",
      credit: "BrazilianDude70",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  },
};
