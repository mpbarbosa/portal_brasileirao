import type { SeasonEvent } from "@/src/types";

/**
 * HAND-MAINTAINED — the **Acontecimentos** of the season, in two scopes: what
 * touched the whole division, and what touched one club.
 *
 * No provider this app can reach reports any of it. football-data carries
 * fixtures, tables and squads; CBF's own endpoints carry gols, escalações and
 * súmulas. A técnico sacked is news, and news is not a feed here — so this is
 * curated like `broadcasts.ts`, `club-hymns.ts` and `club-reddit.ts`, and
 * coverage grows by hand.
 *
 * **`clubCode` is our club code — the upstream numeric id, never the `tla`.**
 * Corinthians and Coritiba both report `COR`; filing one club's sacking under
 * the other is exactly what keying on an abbreviation produces.
 *
 * **Every date here is a BRAZIL-LOCAL calendar day**, for the reason
 * `src/types.ts` sets out at length beside `SeasonEventBase.date`. It is not a
 * UTC instant and must not be converted into one.
 *
 * ## The bar an entry has to clear
 *
 * `nationality`'s bar in `player-overrides.ts`, not `name`'s: **two independent
 * sources have to agree on the day**, and where they do not, the entry stays
 * out. A plausible date is indistinguishable from a correct one — the rule
 * `src/data/stadiums.ts` states about capacity, and it bites harder here,
 * because a sacking dated three days wrong still sits plausibly next to the run
 * of results that caused it.
 *
 * **A third source is available for free and was used wherever it applies: this
 * repository's own fixture list.** Most sackings follow a named match, and
 * `src/data/matches.ts` dates that match — so "after the 1-0 defeat to
 * Internacional at the Neo Química Arena" resolves to round 10,
 * `2026-04-05T22:30:00Z`, which is 19:30 BRT on Sunday 5 April, which is the
 * day the press reported. Three of the entries below were confirmed that way
 * (Cruzeiro, Corinthians, Chapecoense's second) and one was corrected by it.
 *
 * **The correction is worth reading before adding an entry.** One consolidated
 * list surveyed for this file dates Tite's sacking to 14 March. ge.globo files
 * its report under `/2026/03/15/`, O Tempo under `/2026/3/15/`, and Agência
 * Brasil and CNN both say "ao fim da noite de domingo (15)". Our own fixture
 * list settles it: Cruzeiro 3x3 Vasco kicked off at 20:30 BRT on Sunday 15
 * March and ended after midnight UTC. So 14 is wrong, 15 is the local day, and
 * 16 is what a UTC conversion would have printed. A single list agreeing with
 * itself is not two sources.
 *
 * The same survey put Martín Anselmi's departure at "~27/03"; four reports date
 * it to Sunday 22 March, less than 24 hours after Botafogo's round-8 win over
 * Bragantino. Two entries corrected out of one list is what the two-source bar
 * is for.
 *
 * ## What is deliberately absent
 *
 * **Rounds 29 to 38 carry placeholder kickoffs** — every fixture at exactly
 * `00:00Z`, which is football-data serving a date with no time — so the
 * calendar gaps in that stretch are artefacts of the placeholder and not
 * evidence of a pause. The 17-day hole before round 29 and the 14-day hole
 * before round 35 look exactly like the Copa do Mundo hole below and are
 * nothing of the kind. No entry may be derived from them.
 *
 * **The Copa do Mundo itself is not a second entry beside the paralisação.**
 * The tournament is the *cause*; the halt is what touched the twenty clubs, and
 * two rows for one thing would say the championship stopped twice. Its own
 * window is named in the halt's `detail` instead.
 */
export const SEASON_EVENTS: SeasonEvent[] = [
  // ── Geral ──────────────────────────────────────────────────────────────
  {
    // The span is read off our OWN fixture list rather than off the press,
    // and the two genuinely differ: CBF brought two round-19 matches forward
    // to 16 July, before the Copa's own final on the 19th, while the reports
    // announce the return as 22 July. `src/data/matches.ts` says the last
    // round-18 match kicked off 2026-05-31T23:30Z and the first round-19 match
    // 2026-07-16T22:30Z, with **zero fixtures in between** — so 1 June to 15
    // July is the stretch a reader of this app actually finds empty, and it is
    // the stretch this entry names. A date taken from the press would leave
    // six days of football sitting inside a band captioned "sem jogos".
    id: "paralisacao-copa-2026",
    scope: "geral",
    date: "2026-06-01",
    endDate: "2026-07-15",
    title: "Brasileirão paralisado para a Copa do Mundo",
    detail:
      "A Série A parou depois da 18ª rodada, encerrada em 31 de maio, e só voltou na 19ª, " +
      "em 16 de julho — 45 dias sem jogo. A Copa do Mundo foi disputada entre 11 de junho " +
      "e 19 de julho, e a CBF antecipou duas partidas da volta para antes da final.",
    source:
      "https://www.cnnbrasil.com.br/esportes/brasileirao/tem-jogos-durante-a-copa-do-mundo-veja-as-paralisacoes-do-brasileirao-2026/",
  },

  // ── Clube ──────────────────────────────────────────────────────────────
  // Ordered by date. The list is not required to be sorted — `clubTimeline`
  // orders it — but a file somebody appends to reads better kept in order.
  {
    // Atlético-MG. Após empate em 3 a 3 com o Remo. Eduardo Domínguez foi
    // anunciado em 24 de fevereiro, o que é outro acontecimento e não este.
    id: "atletico-mg-sampaoli",
    scope: "clube",
    clubCode: "1766",
    date: "2026-02-12",
    title: "Atlético-MG demite Jorge Sampaoli",
    detail: "Início ruim no Brasileirão. Eduardo Domínguez foi anunciado no dia 24.",
    source: "https://www.gazetaesportiva.com/campeonatos/brasileiro-serie-a/demissoes-tecnicos-brasileirao-2026/",
  },
  {
    // Vasco. A derrota que o derrubou foi na semifinal do Carioca, não no
    // Brasileirão — o motivo pelo qual nada aqui é derivado do calendário da
    // Série A. Renato Gaúcho foi anunciado a 3 de março.
    id: "vasco-diniz",
    scope: "clube",
    clubCode: "1780",
    date: "2026-02-22",
    title: "Vasco demite Fernando Diniz",
    detail: "Depois da derrota para o Fluminense na semifinal do Carioca. Renato Gaúcho assumiu a 3 de março.",
    source: "https://www.metropoles.com/esportes/vasco-anuncia-renato-gaucho-apos-demissao-de-fernando-diniz",
  },
  {
    // Clube do Remo. Também fora do Brasileirão: a derrota foi na final do
    // Paraense. Léo Condé foi confirmado a 4 de março.
    id: "remo-osorio",
    scope: "clube",
    clubCode: "4287",
    date: "2026-03-01",
    title: "Remo demite Juan Carlos Osorio",
    detail: "Após a derrota por 2 a 1 para o Paysandu na final do Paraense. Léo Condé assumiu a 4 de março.",
    source: "https://www.oliberal.com/esportes/remo/remo-demite-juan-carlos-osorio-ap-1.1091305",
  },
  {
    // Flamengo. O caso que mais desmente a ideia de que um acontecimento se
    // deduz de uma sequência de resultados: a saída veio DEPOIS de um 8 a 0.
    id: "flamengo-filipe-luis",
    scope: "clube",
    clubCode: "1783",
    date: "2026-03-03",
    title: "Flamengo demite Filipe Luís",
    detail:
      "Campeão brasileiro e da Libertadores em 2025, saiu no pior início do clube em uma década. " +
      "Leonardo Jardim assumiu no dia seguinte.",
    // Trocada de um credited.com.br que passou a responder 404. A ge.globo
    // confirma a data em vez de a mexer: datePublished 2026-03-03T01:02-03:00,
    // dia local 03/03, e o título da peça é o `title` desta entrada à letra.
    source:
      "https://ge.globo.com/futebol/times/flamengo/noticia/2026/03/03/filipe-luis-nao-e-mais-treinador-do-flamengo.ghtml",
  },
  {
    id: "sao-paulo-crespo",
    scope: "clube",
    clubCode: "1776",
    date: "2026-03-09",
    title: "São Paulo demite Hernán Crespo",
    detail: "Roger Machado foi anunciado no dia seguinte, com contrato até o fim de 2026.",
    source: "https://www.vavel.com/br/futebol/2026/03/09/sao-paulo/1253423-sao-paulo-demite-hernan-crespo.html",
  },
  {
    // Confirmado contra a nossa própria lista de jogos: Cruzeiro 3x3 Vasco,
    // 6ª rodada, `2026-03-15T23:30:00Z` = 20:30 BRT de domingo. Ver a
    // correcção documentada no cabeçalho deste ficheiro.
    id: "cruzeiro-tite",
    scope: "clube",
    clubCode: "1771",
    date: "2026-03-15",
    title: "Cruzeiro demite Tite",
    detail:
      "Ao fim da noite de domingo, depois do empate em 3 a 3 com o Vasco no Mineirão, " +
      "pela 6ª rodada — seis jogos sem vencer. Estava no cargo havia menos de três meses.",
    source: "https://ge.globo.com/futebol/times/cruzeiro/noticia/2026/03/15/cruzeiro-demite-tite.ghtml",
  },
  {
    // **A entrada que a barra das duas fontes corrigiu, e no sentido menos
    // óbvio.** O JOGO é de quarta, 18: Santos 1x2 Internacional, 7ª rodada,
    // `2026-03-19T00:30:00Z` = 21:30 BRT de 18 de março. A DEMISSÃO não é.
    // Os relatos dizem "na madrugada desta quinta-feira (19)", e o Cuca foi
    // anunciado "na manhã de quinta (19), menos de 12 horas depois" — ou seja,
    // o dia local do acontecimento é 19 e não 18. Esta ficha esteve datada de
    // 18, deduzida do jogo; a nossa própria lista de jogos data o JOGO e nunca
    // o que se seguiu a ele, e é essa a fronteira da terceira fonte.
    id: "santos-vojvoda",
    scope: "clube",
    clubCode: "6685",
    date: "2026-03-19",
    title: "Santos demite Juan Pablo Vojvoda",
    detail:
      "Na madrugada seguinte à derrota por 2 a 1 para o Internacional na Vila Belmiro, " +
      "pela 7ª rodada. Cuca foi anunciado poucas horas depois, na mesma manhã.",
    source: "https://agenciabrasil.ebc.com.br/esportes/noticia/2026-03/santos-anuncia-cuca-como-novo-tecnico-horas-apos-demitir-vojvoda",
  },
  {
    // Menos de 24 h depois de uma VITÓRIA sobre o Bragantino, na 8ª rodada.
    // Ver o cabeçalho: uma das listas consultadas data isto de ~27/03.
    id: "botafogo-anselmi",
    scope: "clube",
    clubCode: "1770",
    date: "2026-03-22",
    title: "Botafogo demite Martín Anselmi",
    detail:
      "Na tarde de domingo, menos de 24 horas depois de vencer o Bragantino pela 8ª rodada. " +
      "O clube alegou não ter visto “evolução, progresso e resultados”. Franclim Carvalho assumiu no início de abril.",
    source: "https://agenciabrasil.ebc.com.br/esportes/noticia/2026-03/botafogo-demite-tecnico-martin-anselmi",
  },
  {
    // Chapecoense 0x4 Atlético-MG, 9ª rodada, `2026-04-02T22:00:00Z` = 19:00
    // BRT de quinta. A demissão foi na sexta, 3.
    id: "chapecoense-dal-pozzo",
    scope: "clube",
    clubCode: "1772",
    date: "2026-04-03",
    title: "Chapecoense demite Gilmar Dal Pozzo",
    detail: "No dia seguinte à goleada por 4 a 0 sofrida em casa diante do Atlético-MG, pela 9ª rodada.",
    source: "https://www.ogol.com.br/noticias/apos-goleada-sofrida-em-casa-chapecoense-demite-gilmar-dal-pozzo/1087102",
  },
  {
    // Corinthians 0x1 Internacional, 10ª rodada, `2026-04-05T22:30:00Z` =
    // 19:30 BRT de domingo. Confirmado contra a nossa própria lista de jogos.
    id: "corinthians-dorival",
    scope: "clube",
    clubCode: "1779",
    date: "2026-04-05",
    title: "Corinthians demite Dorival Júnior",
    detail:
      "Na noite de domingo, após a derrota por 1 a 0 para o Internacional em Itaquera, pela 10ª rodada — " +
      "nove jogos sem vencer. Campeão da Copa do Brasil de 2025 e da Supercopa Rei.",
    source: "https://exame.com/esporte/corinthians-demite-dorival-junior-apos-sequencia-negativa-no-brasileirao/",
  },
  {
    // Cruzeiro 2x1 Chapecoense, 17ª rodada, `2026-05-24T19:00:00Z` = 16:00 BRT
    // de domingo. A demissão foi na noite de segunda, 25. É a SEGUNDA do mesmo
    // clube na mesma temporada, e é por isso que a chave é o `id` e não o
    // clube: um registo por clube perderia uma das duas.
    id: "chapecoense-fabio-matias",
    scope: "clube",
    clubCode: "1772",
    date: "2026-05-25",
    title: "Chapecoense demite Fábio Matias",
    detail:
      "Na noite de segunda, um dia depois da derrota por 2 a 1 para o Cruzeiro no Mineirão, pela 17ª rodada. " +
      "Dez jogos no cargo. A Chapecoense foi o primeiro clube a trocar duas vezes de técnico na edição.",
    source: "https://www.opovo.com.br/agencia/jogada10/2026/05/25/chapecoense-anuncia-demissao-de-fabio-matias-apos-10-jogos.html",
  },
  {
    id: "fluminense-zubeldia",
    scope: "clube",
    clubCode: "1765",
    date: "2026-08-13",
    title: "Fluminense demite Luis Zubeldía",
    detail:
      "Oito jogos sem vencer, às vésperas da volta das oitavas da Sul-Americana. " +
      "Marcão assumiu interinamente.",
    source: "https://www.terra.com.br/esportes/fluminense/fluminense-demite-luis-zubeldia-antes-de-duelo-com-o-palmeiras,d74b56c1201164755732a0261d6951a53695ccks.html",
  },
  {
    // A segunda saída do Botafogo na temporada, como na Chapecoense.
    id: "botafogo-franclim",
    scope: "clube",
    clubCode: "1770",
    date: "2026-08-18",
    title: "Botafogo demite Franclim Carvalho",
    detail:
      "Na noite de terça, após a goleada por 6 a 1 sofrida diante do Cienciano na Sul-Americana e a derrota " +
      "para o Vitória no Brasileirão. Quatro meses e meio no cargo.",
    source: "https://www.lance.com.br/botafogo/botafogo-demite-o-tecnico-franclim-carvalho.html",
  },
];
