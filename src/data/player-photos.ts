import type { PlayerPhoto } from "@/src/types";

/**
 * HAND-MAINTAINED — photographs of players, from Wikimedia Commons, keyed by
 * player id.
 *
 * **Instagram is not a source here and cannot be.** A player's own photographs
 * are their copyright; nothing about a public profile licenses reuse, the CDN
 * addresses expire, and hotlinking them would republish someone's work without
 * permission. Commons is the source precisely because a licence is attached to
 * every file and says what may be done with it. If a photograph is wanted that
 * Commons does not have, the answer is that the app does not show one — not
 * that it takes one from elsewhere.
 *
 * The bytes are **vendored into `public/players/`** by
 * `npm run sync-player-photos` and served from our own origin, the same answer
 * the broadcaster marks and the stadium photographs got (`docs/roadmap.md`
 * principle 4). That reasoning is sharper here than for stadiums: a stadium
 * page shows one photograph, whereas opening several cards in a row is the
 * ordinary way to read the Jogadores page, and Commons throttles at the third
 * or fourth request.
 *
 * `credit`, `license` and `licenseUrl` are required by the type. A player may
 * have no photograph; a player may not have an unattributed one. Credits are
 * copied **verbatim**, trailing punctuation and all — where Commons publishes
 * an `Attribution` field the photographer dictated that wording, and tidying it
 * into house style is the edit that is not ours to make.
 *
 * ## How these 70 were chosen out of 99 candidates
 *
 * Every player with an article in `player-wikipedia.ts` was surveyed for a lead
 * image under a licence `redistributable` will name. That produced 100
 * candidates. **Thirty were rejected**, and the reasons are worth keeping
 * because they are what a future batch will hit too.
 *
 * **A file that resolves is not a photograph of the right person.** The obvious
 * automation — take the lead image of the player's article — is exactly what
 * put a journalist posing outside the Nilton Santos into `stadiums.ts` as a
 * photograph of the ground. For a player the trap is a *team photograph*, and
 * it is far commoner than the stadium equivalent:
 *
 * - João Paulo's lead image is described "Equipe do Santos perfilada antes de
 *   jogo contra o Corinthians" — a line-up, eleven men.
 * - Cristian Medina's is "Argentina's starting eleven against Iraq".
 * - Edenilson's is "Players of SC Corinthians", and the file is titled
 *   `Edeilson (cropped).jpg` — a different name by one letter.
 * - Dudu and Marllon were offered **the same photograph**, a Palmeiras–Cuiabá
 *   match shot, as the lead image for both.
 *
 * Every file was opened and looked at, at the size and crop the card actually
 * renders, and `alt` was written from that viewing rather than from the name.
 * The second half of the rejections are photographs that are genuinely of the
 * player and still unusable here: a full-body action shot leaves a face a few
 * pixels wide at 64px, and Nuno Moreira's only free picture has him in a snood
 * with his face covered.
 *
 * Two rejections came from the rules in this file rather than from looking.
 * Thiago Maia's candidate named him nowhere — not in the file title, not in the
 * description — so nothing but a face connected it to him. Patrick de Paula's
 * carried **no attribution at all**, and an unattributed photograph is the one
 * thing the type forbids outright.
 *
 * **A free photograph of a footballer is usually old, and usually another
 * club's.** Commons has what somebody was free to release: Memphis Depay at
 * Olympique Lyonnais in 2019, Alex Sandro in a Brazil shirt, Saúl at Atlético
 * de Madrid. That is not a defect to hide — it is why `alt` names the shirt and
 * the year rather than the player, whom the card already names beside it, so a
 * reader who cannot see the image is not left assuming it is current.
 *
 * Verify with:
 *
 *   npm run check-player-photos
 *
 * which re-reads every licence and credit from Commons. Like `check-hymns` it
 * prints the whole table: it narrows what a person has to look at, it does not
 * replace looking.
 */
export const PLAYER_PHOTOS: Record<string, PlayerPhoto> = {
  // Athletico-PR
  "8357": {
    file: "20141118 AUTBRA 5085.jpg",
    alt: "Retrato com o agasalho amarelo da seleção brasileira, em 2014",
    credit: "Ailura, CC BY-SA 3.0 AT",
    license: "CC BY-SA 3.0 at",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/at/",
  }, // Luiz Gustavo

  // Bahia
  "1073": {
    file: "GilbertoBenfica2020.jpg",
    alt: "Retrato com o agasalho vermelho do Benfica",
    credit: "Sport Lisboa e Benfica",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  }, // Gilberto
  "1547": {
    file: "Jean Lucas comemora gol marcado pelo Bahia.jpg",
    alt: "Comemorando um gol, com a camisa tricolor do Bahia",
    credit: "Imagem: MARCIO ROBERTO/ESTADÃO",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  }, // Jean Lucas
  "8": {
    file: "Willian Jose 2016.jpg",
    alt: "Com a camisa listrada da Real Sociedad, na apresentação em 2016",
    credit: "Giovanni Batista Rodriguez from San Sebastian-Donostia, España",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  }, // Willian José
  "1548": {
    file: "Everton Ribeiro em entrevista.jpg",
    alt: "Em entrevista, de camisa rubro-negra do Flamengo, em 2018",
    credit: "Segue o baile",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  }, // Éverton Ribeiro

  // Botafogo
  "1723": {
    file: "Arthur Cabral, atacante do Benfica, em promoção ao EAFC 24 (cropped).jpg",
    alt: "Em entrevista, de agasalho vermelho do Benfica",
    credit: "Sport Lisboa e Benfica",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  }, // Arthur Cabral
  "149704": {
    file: "Danilo Santos Brazil V Morocco 13 June 2026-140 (cropped).jpg",
    alt: "Em campo pela seleção brasileira, na Copa do Mundo de 2026",
    credit: "Bryan Berlin / WikiPortraits",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Danilo dos Santos de Oliveira

  // Bragantino
  "1326": {
    file: "Internacional-2015 (3).jpg",
    alt: "Com a camisa vermelha do Internacional, em 2015",
    credit: "César Muñoz/ANDES",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
  }, // Eduardo Sasha
  "1445": {
    file: "Gabriel Girotto - Red Bull Bragantino.jpg",
    alt: "Comemorando, com a camisa do Red Bull Bragantino",
    credit: "C2 Sports 2026",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  }, // Gabriel

  // Chapecoense
  "13237": {
    file: "Rafael Santos 2013.png",
    alt: "Em entrevista como jogador do Botafogo-SP, em 2013",
    credit: "TV Botafogo",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  }, // Rafael Santos

  // Corinthians
  "8472": {
    file: "Memphis Depay 2019.jpg",
    alt: "De perto, com a camisa azul do Olympique Lyonnais, em 2019",
    credit: "Derivative work: Joe Sins",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Memphis Depay
  "3789": {
    file: "CSKA Sporting (3) (cropped).jpg",
    alt: "Com a camisa verde do Sporting, em jogo europeu",
    credit: "Дмитрий Голубович",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // André Carrillo
  "1577": {
    file: "CharlesInter2017.jpg",
    alt: "Com a camisa vermelha do Internacional, em 2017",
    credit: "Israel Cidade",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  }, // Charles
  "33145": {
    file: "Gabriel Paulista 2026 (cropped).jpg",
    alt: "De agasalho preto do Corinthians, em 2026",
    credit: "TV Central do Timão",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  }, // Gabriel Paulista
  "1301": {
    file: "Gustavo Henrique (Press Conference, August 2022).png",
    alt: "Em entrevista coletiva, de camisa escura",
    credit: "Sportreport",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  }, // Gustavo Henrique
  "3325": {
    file: "240609 FC 서울 팬사인회 (Jesse Lingard).jpg",
    alt: "Sorrindo, de boné preto, em evento com torcedores em 2024",
    credit: "Explicit",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Jesse Lingard
  "15795": {
    file: "CSKA Moscow v Basel (5).jpg",
    alt: "Com a camisa do CSKA de Moscou",
    credit: "Дмитрий Голубович",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // Vitinho
  "1325": {
    file: "Yuri Alberto celebra gol contra o Palmeiras em vitória de 2 x 0 pelo campeonato brasileiro 2024.jpg",
    alt: "Comemorando um gol, com a camisa preta do Corinthians",
    credit: "Felipematoslima",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  }, // Yuri Alberto
  "3703": {
    file: "Открытая тренировка «Аякса» перед матчем с «Динамо». 27 августа 2018 года — 900376 (Zakaria Labyad).jpg",
    alt: "Com a camisa branca do Ajax, segurando a bola",
    credit: "ТОВ \"Динамоманія\"",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Zakaria Labyad

  // Coritiba
  "169022": {
    file: "Breno-lopes-palmeiras-wikipedia-2021 (cropped).jpg",
    alt: "Com a camisa verde do Palmeiras, em 2021",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Breno Lopes
  "1572": {
    file: "Rodrigo Moledo.jpg",
    alt: "De camisa amarela, em campo",
    credit: "Football.ua",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // Rodrigo Moledo

  // Cruzeiro
  "169004": {
    file: "Bruno-rodrigues-palmeiras-internacional-sep2025-3.jpg",
    alt: "Com a camisa verde do Palmeiras, em 2022",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Bruno Rodrigues
  "1431": {
    file: "Cássio 2022.jpg",
    alt: "De uniforme amarelo de goleiro do Corinthians, em 2022",
    credit: "Soccer Digital",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  }, // Cássio
  "181633": {
    file: "Kaiki-3.png",
    alt: "De camisa polo azul do Cruzeiro",
    credit: "Yara Fonseca",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  }, // Kaiki Bruno
  "1250": {
    file: "Présentation de Lucas Silva (cropped).jpg",
    alt: "Com a camisa branca do Real Madrid, na apresentação",
    credit: "Matias Arraez Crop: MYS77",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  }, // Lucas Silva
  "45490": {
    file: "Matheus Pereira.jpg",
    alt: "De camisa vinho, em campo",
    credit: "Silesia711",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Matheus Pereira

  // Flamengo
  "2028": {
    file: "Alex Sandro Brazil V Morocco 13 June 2026-68.jpg",
    alt: "Com a camisa amarela da seleção brasileira, na Copa de 2026",
    credit: "Bryan Berlin / WikiPortraits",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Alex Sandro
  "1317": {
    file: "Bruno Henrique.2019.jpg",
    alt: "Com a camisa rubro-negra do Flamengo, em 2019",
    credit: "Segue o baile",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  }, // Bruno Henrique
  "7881": {
    file: "Danilo and Bilal El Khannouss at 2026 FIFA World Cup by YantsImages (cropped).jpg",
    alt: "Com a camisa amarela da seleção brasileira, na Copa de 2026",
    credit: "YantsImages",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Danilo Luiz da Silva
  "29012": {
    file: "Jorge Carrascal 2025.jpg",
    alt: "Em campo, de camisa azul, em 2025",
    credit: "Вячеслав Евдокимов / ФК «Зенит»",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // Jorge Carrascal
  "1408": {
    file: "LEO ORTIZ X FLU - ONE9 CONTENT - GABRIEL NUFFER 2024-7.jpg",
    alt: "De perto, com a camisa rubro-negra do Flamengo",
    credit: "Cleisson Lima",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Leo Ortiz
  "1543": {
    file: "Lucas Paqueta Brazil V Morocco 13 June 2026-134 (cropped).jpg",
    alt: "Com a camisa amarela da seleção brasileira, na Copa de 2026",
    credit: "Bryan Berlin / WikiPortraits",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Lucas Paquetá
  "11192": {
    file: "Leo Pereira Brazil V Morocco 13 June 2026-136 (cropped).jpg",
    alt: "Com a camisa da seleção brasileira, na Copa de 2026",
    credit: "Bryan Berlin / WikiPortraits",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Léo Pereira
  "168795": {
    file: "Nicolás de la Cruz.jpg",
    alt: "Com a camisa celeste do Uruguai",
    credit: "Agencia de Noticias ANDES",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // Nicolas de la Cruz
  "1077": {
    file: "2025-02-18 Pedro Guilherme Abreu dos Santos.jpg",
    alt: "Retrato, de camisa escura, em 2025",
    credit: "Wilfredor",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  }, // Pedro
  "178710": {
    file: "Samuel Lino, FC Salzburg vs. Atletico Madrid (2025-01-29 UEFA Championsleague) 83 (cropped).jpg",
    alt: "Com a camisa do Atlético de Madrid",
    credit: "Werner100359",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Samuel Lino
  "118": {
    file: "Saul niguez atletico 2017 (cropped).jpg",
    alt: "Com o uniforme do Atlético de Madrid, em 2017",
    credit: "cristina cifuentes",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  }, // Saúl
  "113807": {
    file: "Vitão2020.jpg",
    alt: "Com a camisa laranja do Shakhtar Donetsk, em 2020",
    credit: "Football.ua",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // Vitão

  // Fluminense
  "76": {
    file: "Ganso (cropped).jpg",
    alt: "Retrato, de terno e gravata",
    credit: "Dilma Rousseff from Brasil",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
  }, // Ganso
  "15929": {
    file: "Guilherme Arana 2017.jpg",
    alt: "Com a camisa azul da seleção brasileira, em 2017",
    credit: "Agencia de Noticias ANDES",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
  }, // Guilherme Arana
  "21689": {
    file: "Spar-Zen2015 (3).jpg",
    alt: "Com a camisa azul-clara do Zenit, em 2015",
    credit: "Вячеслав Евдокимов",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // Hulk
  "77159": {
    file: "USAvVEN 2019-06-09 - Jefferson Savarino (51169633652) (cropped).jpg",
    alt: "Com a camisa vinho da seleção venezuelana",
    credit: "Hayden Schiff from Cincinnati, USA",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  }, // Jefferson Savarino
  "8503": {
    file: "Otávio Henrique Santos (cropped).jpg",
    alt: "Retrato, de camisa escura",
    credit: "Adrien33000",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Otávio
  "1546": {
    file: "Renê Rodrigues Martins.jpg",
    alt: "Com a camisa rubro-negra do Flamengo",
    credit: "Agencia de Noticias ANDES",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
  }, // Renê

  // Grêmio
  "1087": {
    file: "Dodi Santos 2023.png",
    alt: "Em campo, de camisa branca",
    credit: "TV Franca - Canal 23",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  }, // Dodi
  "1436": {
    file: "Fabián Balbuena 2022.jpg",
    alt: "Com a camisa do Dínamo de Kiev",
    credit: "Антон Зайцев",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // Fabián Balbuena
  "1170": {
    file: "Weverton Brazil V Morocco 13 June 2026-67 (cropped).jpg",
    alt: "De uniforme escuro de goleiro",
    credit: "Bryan Berlin / WikiPortraits",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Weverton

  // Internacional
  "16481": {
    file: "Alan Patrick at Internacional in 2023.png",
    alt: "Com a camisa vermelha do Internacional",
    credit: "Lennon Haas",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
  }, // Alan Patrick
  "129367": {
    file: "Bruno Gomes - Internacional 2024.png",
    alt: "De agasalho do Internacional",
    credit: "Lennon Haas",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  }, // Bruno Gomes
  "24740": {
    file: "Felix Torres Cote D'Ivoire v Ecuador 14 June 2026-75.jpg",
    alt: "Retrato de perto, de camisa clara",
    credit: "Bryan Berlin / WikiPortraits",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Félix Torres
  "58": {
    file: "FRA-ARG (16) (cropped).jpg",
    alt: "Com a camisa listrada da seleção argentina",
    credit: "Антон Зайцев",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // Gabriel Mercado
  "11680": {
    file: "RAFAEL BORRE (cropped2).jpg",
    alt: "Retrato de perto",
    credit: "MAGERSA78",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Rafael Borré

  // Mirassol
  "23363": {
    file: "Lucas Mugni.jpg",
    alt: "Com a camisa rubro-negra do Flamengo",
    credit: "Renanguilhermedasilva",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // Lucas Mugni
  "1432": {
    file: "Walter-Cuiaba-Palmeiras-jul-2022 (cropped).jpg",
    alt: "Com a camisa preta do Cuiabá",
    credit: "SOCCER DIGITAL",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  }, // Walter

  // Palmeiras
  "115222": {
    file: "Bruno-Fuchs-Palmeiras-Jacuipense-abr26.jpg",
    alt: "Em treino do Palmeiras, de colete laranja",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Bruno Fuchs
  "2060": {
    file: "Felipe-Anderson-Palmeiras-Criciuma-sep24.jpg",
    alt: "Com a camisa verde do Palmeiras",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Felipe Anderson
  "22306": {
    file: "Jhon Arias en Palmeiras - Copa Libertadores 2026.jpg",
    alt: "Com a camisa listrada em azul e branco",
    credit: "Pichotito1821",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  }, // Jhon Arias
  "28740": {
    file: "Joaquin-piquerez-palmeiras-internacional-sep2025-2.jpg",
    alt: "Em treino do Palmeiras, de colete",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Joaquín Piquerez
  "115559": {
    file: "Khellven-Palmeiras-Jacuipense-abr26.jpg",
    alt: "Em treino do Palmeiras, de colete laranja",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Khellven
  "1562": {
    file: "Marcelo-Lomba-Palmeiras-Santos-jan24 (cropped).jpg",
    alt: "De uniforme azul de goleiro do Palmeiras",
    credit: "NullReason",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  }, // Marcelo Lomba
  "1080": {
    file: "Marlon-Freitas-Palmeiras-Jacuipense-abr26.jpg",
    alt: "De regata escura, em treino",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Marlon Freitas
  "119594": {
    file: "Mauricio-Palmeiras-Jacuipense-abr26.jpg",
    alt: "Em treino do Palmeiras",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Mauricio
  "170525": {
    file: "Murilo-Palmeiras-Jacuipense-abr26.jpg",
    alt: "Em treino do Palmeiras, de colete laranja",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Murilo Cerqueira
  "140647": {
    file: "Ramon-Sosa-Palmeiras-Jacuipense-abr26.jpg",
    alt: "Em treino do Palmeiras",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Ramón Sosa
  "181439": {
    file: "Vitor-Roque-Palmeiras-Jacuipense-abr26.jpg",
    alt: "Em treino do Palmeiras",
    credit: "NullReason",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Vítor Roque

  // Santos
  "8491": {
    file: "Neymar Junior Brazil V Morocco 13 June 2026-40.jpg",
    alt: "De boné branco, no banco de reservas",
    credit: "Bryan Berlin / WikiPortraits",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  }, // Neymar
  "1226": {
    file: "Rony-Palmeiras-Santos-jan24.jpg",
    alt: "Sorrindo, com a camisa do Palmeiras",
    credit: "NullReason",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  }, // Rony
  "1540": {
    file: "Willian Arão 2023 (cropped).jpg",
    alt: "Com a camisa do Fenerbahçe",
    credit: "Вячеслав Евдокимов",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  }, // Willian Arão

  // Vasco da Gama
  "1360": {
    file: "CINvNYC 2022-06-29 - Brenner, Álvaro Barreal, Ray Gaddis (52186351647) (Brenner crop).jpg",
    alt: "Retrato, de uniforme escuro",
    credit: "Hayden Schiff from Cincinnati, USA",
    license: "CC BY 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
  }, // Brenner
  "117822": {
    file: "Lucas-Piton-Corinthians-jul-2022.jpg",
    alt: "Retrato de perto, de camisa escura",
    credit: "SOCCER DIGITAL",
    license: "CC0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  }, // Lucas Piton
};
