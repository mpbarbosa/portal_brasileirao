/**
 * HAND-MAINTAINED — the data provider carries no article links at any tier, so
 * these are curated, like `club-wikipedia.ts` and `player-instagram.ts`.
 *
 * Keyed by **player id** — the upstream numeric id as a string — never by name,
 * for the reason `player-instagram.ts` gives at length: Athletico-PR lists two
 * Dudus, and the division fields several Gabriels and more than one Pedro.
 *
 * The value is the **article title alone** ("Memphis Depay"), exactly as
 * `club-wikipedia.ts` stores one. `wikipediaUrl` in `club-core.ts` builds the
 * address, so the edition is written once and a pasted link's `?action=` or
 * `#Carreira` does not persist. The title is not derivable from the name the
 * app holds: the provider gives the popular name and the article often sits at
 * the full one ("Danilo Luiz da Silva"), or at a disambiguated one where the
 * popular name is shared.
 *
 * Coverage is **partial**, like every curated file here — 187 of ~950 listed
 * players. A player absent here renders no link.
 *
 * ## How these were checked
 *
 * Unlike the Instagram handles beside them, **this data can be verified, and
 * is** — `npm run check-player-wikipedia` re-runs the whole check. That is a
 * real difference in kind, not diligence: Wikipedia answers a machine honestly
 * where Instagram serves the same shell for a real page and an invented one.
 *
 * Candidates came from Wikidata items with a **`ptwiki` sitelink**, joined to
 * `squads.ts` on exact date of birth plus a shared name token. Each was then
 * checked against the MediaWiki API for four things at once: the article
 * resolves (following redirects), its `wikibase_item` round-trips to the same
 * Wikidata id the sitelink came from, it is not a disambiguation page, and its
 * **own intro states the same birth date** as `squads.ts`.
 *
 * That last one is the check that matters, and it is why the join alone is not
 * enough. Three of 160 candidates failed it and all three were real:
 *
 * - **Willian Oliveira** (born 1993-05-16) drew the article on *Willian
 *   Farias*, whose article opens "6 de junho de 1989". Wikidata carried a birth
 *   date for that item which disagrees with the article's own, so a
 *   date-keyed join accepted a different person entirely.
 * - **Nathan** drew *Nathan Fogaça* — same year, different man.
 * - **Osvaldo** drew an article whose intro extract is empty, so nothing could
 *   be confirmed either way. Absent, not guessed.
 *
 * One false negative was fixed rather than dropped: pt-BR writes the first of
 * the month as an ordinal, so Bruno Fuchs's "1º de abril de 1999" did not match
 * a plain "1 de abril". The checker accepts `1`, `1º` and `1.º`.
 *
 * ## A second source: the club's own article
 *
 * The Wikidata join is not the only way in, and Atlético-MG's twelve later
 * entries came the other way — from the **squad table of the club's own
 * article**, which links each player to their article by hand. That source is
 * better than the join at the thing the join is worst at: a club article's
 * table is maintained by people who know which Dudu plays there, so it does not
 * offer a same-name stranger in the first place.
 *
 * It is not a licence to skip the check. Every one of the twelve went through
 * the same four tests — and through a fifth that only this source makes
 * available, since the article arrived from a page asserting the player is at
 * this club: **the intro names Atlético Mineiro**. All twelve do.
 *
 * Two things the source does not give, both of which look like gaps and are
 * not. Its table is **more current than `squads.ts`**, so it lists players the
 * frozen snapshot has never heard of (Léo Duarte, Kevin Castaño, Vitão); they
 * are skipped, because there is no id to file them under until the next
 * `sync-seed-data`. And it links only the players who *have* an article, so a
 * squad member absent from it — Igor Gomes, Júnior Alonso, Tomás Cuello — is
 * unlinked **on that page**, which is not the same as having no article. Those
 * are candidates for the Wikidata join, not evidence against one.
 */
export const PLAYER_WIKIPEDIA: Record<string, string> = {
  // Athletico-PR
  "1386": "Léo Pelé", // Léo
  "153853": "Lucas Esquivel",
  "8357": "Luiz Gustavo (futebolista, 1987)", // Luiz Gustavo
  "1662": "Santos (futebolista)", // Santos

  // Atlético-MG
  "24670": "Alan Franco Palma", // Alan Franco
  "179174": "Alan Minda",
  "189371": "Alexsander", // Alexsander Gomes
  "24673": "Ángelo Preciado",
  "16476": "Bernard (futebolista)", // Bernard
  "1182": "Dudu (futebolista, 1992)", // Dudu
  "1695": "Éverson", // Everson
  "178929": "Gabriel Delfim",
  "72781": "Gustavo Scarpa",
  "2283": "Lyanco",
  "7569": "Mateo Cassierra",
  "1447": "Maycon de Andrade Barberan", // Maycon
  "141379": "Natanael (futebolista, 2002)", // Natanael
  "123350": "Reinier",
  "1671": "Renan Lodi",
  "178854": "Victor Hugo (futebolista)", // Victor Hugo Gomes
  "1773": "Vitor Hugo Franchescoli de Souza", // Vitor Hugo

  // Bahia
  "18478": "Erick Luis Conrado Carvalho", // Erick
  "1548": "Éverton Ribeiro",
  "1073": "Gilberto Moraes Junior", // Gilberto
  "1566": "Iago Borduchi",
  "1547": "Jean Lucas",
  "1296": "João Paulo Silva Martins", // João Paulo
  "8": "Willian José",

  // Botafogo
  "15904": "Alex Telles",
  "2096": "Allan Marques Loureiro", // Allan
  "1723": "Arthur Cabral",
  "154595": "Cristian Medina",
  "149704": "Danilo (futebolista, 2001)", // Danilo dos Santos de Oliveira
  "1580": "Edenilson",
  "3221": "Norberto Murara Neto", // Neto

  // Bragantino
  "1326": "Eduardo Sasha",
  "11198": "Fernando dos Santos Pedro", // Fernando
  "1445": "Gabriel Girotto Franco", // Gabriel
  "131279": "Andrés Hurtado", // José Hurtado
  "1439": "Juninho Capixaba",
  "1214": "Matheus Fernandes (futebolista)", // Matheus Fernandes
  "1435": "Pedro Henrique (futebolista)", // Pedro Henrique

  // Chapecoense
  "13922": "Jean Carlos",
  "13237": "Rafael Santos (futebolista)", // Rafael Santos
  "7838": "Yannick Bolasie",

  // Clube do Remo
  "113521": "Jáderson Flores dos Reis", // Jáderson
  "119621": "João Lucas (futebolista)", // João Lucas
  "1441": "Marllon Borges", // Marllon
  "139932": "Patrick de Paula",
  "168807": "Vitor Bueno",
  "1465": "Yago Pikachu",

  // Corinthians
  "1609": "Alex Santana (futebolista)", // Alex Santana
  "56574": "Allan (futebolista)", // Allan
  "3789": "André Carrillo",
  "285271": "André Luiz Santos Dias", // André Luiz
  "16342": "André Ramalho",
  "179054": "Breno Bidon", // Bidon
  "169688": "Matheus Bidu", // Bidu
  "1577": "Charles Rigon Matos", // Charles
  "275104": "Diego da Cruz Lopes", // Dieguinho
  "46376": "Fabrizio Angileri",
  "249314": "Felipe Longo",
  "33145": "Gabriel Paulista",
  "1301": "Gustavo Henrique",
  "120089": "Hugo Ferreira", // Hugo
  "82991": "Hugo Souza",
  "3325": "Jesse Lingard",
  "211608": "João Pedro de Sousa Rodrigues", // João Pedro
  "192626": "Kaio César",
  "211607": "Kayke Ferrari", // Kayke
  "179167": "Matheus Donelli",
  "1614": "Matheus Pereira (futebolista, 1998)", // Matheus Pereira
  "13710": "Matheuzinho (futebolista, 2000)", // Matheuzinho
  "8472": "Memphis Depay",
  "137557": "Pedro Milans",
  "40134": "Pedro Raul",
  "103611": "Raniele",
  "60058": "Rodrigo Garro",
  "15795": "Vitinho (futebolista)", // Vitinho
  "1325": "Yuri Alberto",
  "3703": "Zakaria Labyad",

  // Coritiba
  "169022": "Breno Lopes",
  "249505": "Jacy", // Jacy Maranhão
  "30539": "Maicon Pereira Roque", // Maicon
  "1572": "Rodrigo Moledo",
  "1184": "Thiago Santos (futebolista)", // Thiago Santos
  "12781": "Willian Oliveira",

  // Cruzeiro
  "169004": "Bruno Rodrigues",
  "1431": "Cássio Ramos", // Cássio
  "40067": "Chico da Costa (futebolista)", // Chico
  "118245": "Christian Roberto Alves Cardoso", // Christian
  "1266": "Fabrício Bruno",
  "1434": "Fagner (futebolista)", // Fágner
  "1815": "Gerson Santos da Silva", // Gerson
  "181633": "Kaiki Bruno",
  "91310": "Kaio Jorge",
  "1246": "Lucas Romero",
  "1250": "Lucas Silva",
  "45865": "Lucas Villalba",
  "178822": "Matheus Cunha Queiroz", // Matheus Cunha
  "45490": "Matheus Pereira (futebolista, 1996)", // Matheus Pereira
  "9418": "William de Asevedo Furtado", // William

  // Flamengo
  "2028": "Alex Sandro",
  "1074": "Ayrton Lucas",
  "1317": "Bruno Henrique",
  "7881": "Danilo Luiz da Silva",
  "1244": "Giorgian de Arrascaeta", // Giorgian De Arrascaeta
  "29012": "Jorge Carrascal",
  "2094": "Jorge Luiz Frello Filho", // Jorginho
  "1408": "Léo Ortiz", // Leo Ortiz
  "11192": "Léo Pereira",
  "1543": "Lucas Paquetá",
  "168795": "Nicolás de la Cruz", // Nicolas de la Cruz
  "1077": "Pedro Guilherme Abreu dos Santos", // Pedro
  "178710": "Samuel Lino",
  "118": "Saúl Ñíguez", // Saúl
  "113807": "Vitão (futebolista)", // Vitão

  // Fluminense
  "28614": "Agustín Canobbio",
  "1154": "Alisson (futebolista)", // Alisson
  "1230": "Fábio Deivson Lopes Maciel", // Fábio
  "76": "Paulo Henrique Ganso", // Ganso
  "15929": "Guilherme Arana",
  "21689": "Hulk (futebolista)", // Hulk
  "1215": "Igor Rabello",
  "77159": "Jefferson Savarino",
  "76910": "Lucho Acosta", // Luciano Acosta
  "136654": "Marcelo Pitaluga",
  "61369": "Gustavo Nonato", // Nonato
  "8503": "Otávio Henrique", // Otávio
  "1546": "Renê (futebolista)", // Renê

  // Grêmio
  "1087": "Dodi (futebolista)", // Dodi
  "1436": "Fabián Balbuena",
  "1387": "João Pedro Maturano dos Santos", // João Pedro
  "1072": "Marlon Rodrigues Xavier", // Marlon
  "168793": "Wagner Leonardo",
  "1170": "Weverton",

  // Internacional
  "16481": "Alan Patrick",
  "1129": "Alerrandro",
  "129367": "Bruno Gomes",
  "1189": "Bruno Henrique Corsini", // Bruno Henrique
  "24740": "Félix Torres",
  "58": "Gabriel Mercado",
  "11680": "Rafael Santos Borré", // Rafael Borré
  "1091": "Richard Candido Coelho", // Richard
  "1550": "Ronaldo da Silva Souza", // Ronaldo
  "8404": "Thiago Maia",

  // Mirassol
  "44810": "Alex Muralha",
  "183580": "Carlos Eduardo de Oliveira Alves", // Carlos Eduardo
  "23363": "Lucas Mugni",
  "1181": "Victor Luis",
  "1432": "Walter Leandro Capeloza Artune", // Walter

  // Palmeiras
  "115222": "Bruno Fuchs",
  "2060": "Felipe Anderson",
  "22306": "Jhon Arias",
  "28740": "Joaquín Piquerez",
  "115559": "Khellven",
  "1562": "Marcelo Lomba",
  "1080": "Marlon Freitas",
  "119594": "Maurício (futebolista)", // Mauricio
  "170525": "Murilo Cerqueira",
  "140647": "Ramón Sosa",
  "181439": "Vitor Roque", // Vítor Roque

  // Santos
  "139933": "Gabriel Menino",
  "1174": "Mayke",
  "8491": "Neymar",
  "1226": "Rony",
  "1540": "Willian Arão",
  "169556": "Zé Ivaldo",
  "1380": "Zé Rafael",

  // São Paulo
  "1192": "Artur Victor", // Artur Guimaraes
  "79609": "Sabino (futebolista, 1996)", // José Sabino
  "42901": "Luciano da Rocha Neves", // Luciano
  "85523": "Marcos Antônio (futebolista)", // Marcos Antônio
  "181372": "Dória (futebolista)", // Matheus Doria
  "179023": "Rafael Pires Monteiro", // Rafael Monteiro

  // Vasco da Gama
  "1360": "Brenner Souza da Silva", // Brenner
  "22497": "Carlos Cuesta",
  "178432": "Andrés Gómez (futebolista)", // Carlos Gómez
  "1251": "David Corrêa da Fonseca", // David
  "103153": "Hugo Moura",
  "13192": "Jair (futebolista)", // Jair
  "117822": "Lucas Piton",
  "85890": "Marino Hinestroza",
  "171304": "Nuno Moreira",

  // Vitória
  "2478": "Gabriel Vasconcellos", // Gabriel
  "61447": "Gabriel Baralhas",
  "95136": "Luan Cândido",
};
