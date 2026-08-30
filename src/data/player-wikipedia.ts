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
 * Coverage is **partial**, like every curated file here — 376 of the 948
 * listed players, every club represented. A player absent here renders no
 * link.
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
 * ## The division-wide sweep, and the one thing it taught
 *
 * The other nineteen clubs were done in one pass with the method above:
 * Wikidata items carrying a `ptwiki` sitelink, joined to `squads.ts` on exact
 * date of birth and an exact or subset name match, then every candidate put
 * through the article's own intro. 197 candidates, 189 kept, **eight
 * refused** — and the refusals are the part worth reading, because seven of
 * them look like matches right up until the intro is read.
 *
 * Two were already known and came back unchanged, which is the sweep
 * confirming itself rather than a coincidence: **Nathan** drew *Nathan
 * Fogaça* again, and **Osvaldo** again drew an article with an empty intro
 * extract. Four more are a birth date that disagrees by a few days or a year
 * while the article names the right club and role — *Matheus Martins*
 * (Botafogo, 13 vs 16 July), *Leonel Picco* (Remo, 1998 vs 1999), *Lucas
 * Arcanjo* (Vitória, 5 vs 8 August) and *Lucas Ramon* (São Paulo, whose 3
 * July and our 7 March are the same two numbers transposed). Those are very
 * probably the right person with one side's date wrong; **probably is not the
 * bar**, and `squads.ts` is generated, so there is nowhere to record a
 * correction even if we knew which side to believe. Absent, not guessed.
 *
 * **The eighth is the one that changes the method, and no check listed above
 * would have caught it.** Two *different* players share a name and a birth
 * date: `179144` at Mirassol and `13421` at Vitória are both "Carlos Eduardo",
 * both born 1996-10-10. The join offered the same article to both and every
 * per-entry test passed for both, because each was asked in isolation. What
 * caught it was asking a question about the *set* — whether any article had
 * been claimed twice. The article names Mirassol and calls him an atacante,
 * which is the Mirassol row's position and not the Vitória row's, so it is
 * filed under `179144` and `13421` has none.
 *
 * So: **exact name plus exact date of birth is not a unique key in this
 * division.** It is a very good filter and it is not an identifier. Any later
 * pass that adds entries in bulk should check for a duplicated article before
 * trusting a per-entry green, because that failure is invisible one row at a
 * time.
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
  "104494": "Carlos Terán",
  "127557": "Gastón Benavídez",
  "22166": "Juan Felipe Aguirre", // Juan Aguirre
  "178353": "Juan Portilla",
  "56226": "Julimar",
  "1386": "Léo Pelé", // Léo
  "153853": "Lucas Esquivel",
  "8357": "Luiz Gustavo (futebolista, 1987)", // Luiz Gustavo
  "187426": "Mycael",
  "1662": "Santos (futebolista)", // Santos
  "8606": "Stiven Mendoza",

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
  "8395": "Junior Alonso", // Júnior Alonso
  "2283": "Lyanco",
  "7569": "Mateo Cassierra",
  "285292": "Mateus Iseppe",
  "1447": "Maycon de Andrade Barberan", // Maycon
  "141379": "Natanael (futebolista, 2002)", // Natanael
  "123350": "Reinier",
  "1671": "Renan Lodi",
  "178854": "Victor Hugo (futebolista)", // Victor Hugo Gomes
  "1773": "Vitor Hugo Franchescoli de Souza", // Vitor Hugo

  // Bahia
  "1661": "Ademir da Silva Santos Júnior", // Ademir Santos
  "136393": "Caio Alexandre",
  "142131": "Cristian Olivera",
  "18478": "Erick Luis Conrado Carvalho", // Erick
  "203872": "Erick Pulga", // Erick
  "39954": "Everaldo Stum", // Everaldo
  "1548": "Éverton Ribeiro",
  "1073": "Gilberto Moraes Junior", // Gilberto
  "1566": "Iago Borduchi",
  "1547": "Jean Lucas",
  "1296": "João Paulo Silva Martins", // João Paulo
  "140873": "Luciano Juba",
  "191376": "Mateo Sanabria",
  "28422": "Michel Araújo", // Michel Araujo
  "107803": "Nicolás Acevedo",
  "110928": "Rodrigo Nestor",
  "250314": "Román Gómez",
  "1496": "Ronaldo Strada", // Ronaldo
  "8": "Willian José",

  // Botafogo
  "15904": "Alex Telles",
  "2096": "Allan Marques Loureiro", // Allan
  "250493": "Álvaro Montoro", // Alvaro Montoro
  "1723": "Arthur Cabral",
  "250332": "Cristhian Loor",
  "154595": "Cristian Medina",
  "149704": "Danilo (futebolista, 2001)", // Danilo dos Santos de Oliveira
  "1580": "Edenilson",
  "77": "Joaquín Correa",
  "206393": "Jordan Barrera",
  "12653": "Júnior Santos",
  "179157": "Léo Linck", // Leo Linck
  "8457": "Marçal (futebolista)", // Marçal
  "160792": "Mateo Ponte",
  "28433": "Nahuel Ferraresi",
  "3221": "Norberto Murara Neto", // Neto
  "13152": "Raul Jonas Steffens", // Raul
  "113671": "Santiago Rodríguez (futebolista)", // Santiago Rodríguez

  // Bragantino
  "1098": "Cleiton Schwengber", // Cleiton
  "43624": "Eduardo Santos",
  "1326": "Eduardo Sasha",
  "179156": "Fabinho (futebolista, 2002)", // Fabinho
  "11198": "Fernando dos Santos Pedro", // Fernando
  "1445": "Gabriel Girotto Franco", // Gabriel
  "179007": "Gustavo Marques",
  "131880": "Guzmán Rodríguez",
  "114353": "Isidro Pitta",
  "131279": "Andrés Hurtado", // José Hurtado
  "1439": "Juninho Capixaba",
  "1214": "Matheus Fernandes (futebolista)", // Matheus Fernandes
  "1435": "Pedro Henrique (futebolista)", // Pedro Henrique
  "39920": "Tiago Volpi",
  "154767": "Vanderlan",

  // Chapecoense
  "118377": "Camilo Reijers", // Camilo
  "138222": "Sebastião Ênio Santos de Almeida", // Ênio
  "1485": "Giovanni Augusto",
  "13922": "Jean Carlos",
  "13237": "Rafael Santos (futebolista)", // Rafael Santos
  "1274": "Rafael Thyere",
  "154554": "Vinicius Balieiro", // Vinicius
  "7838": "Yannick Bolasie",

  // Clube do Remo
  "90803": "Alef Manga",
  "56082": "Gabriel Poveda",
  "11194": "Gabriel Taliari",
  "12602": "Ivan Quaresma da Silva", // Ivan
  "113521": "Jáderson Flores dos Reis", // Jáderson
  "119621": "João Lucas (futebolista)", // João Lucas
  "168986": "José Welison", // Jose Welison
  "1441": "Marllon Borges", // Marllon
  "19262": "Mayk",
  "1582": "Patrick (futebolista)", // Patrick
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
  "12678": "Bruno Melo",
  "13851": "Fernando Sobral",
  "249505": "Jacy", // Jacy Maranhão
  "249479": "JP Chermont", // João Pedro Chermont
  "259981": "Joaquín Lavega",
  "31609": "Josué Filipe Soares Pesqueira", // Josué
  "203383": "Lucas Ronier",
  "30539": "Maicon Pereira Roque", // Maicon
  "156724": "Pedro Rangel (goleiro)", // Pedro Rangel
  "16154": "Pedro Rocha Neves", // Pedro Rocha
  "1572": "Rodrigo Moledo",
  "22162": "Sebastián Gómez",
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
  "205585": "Keny Arroyo",
  "1246": "Lucas Romero",
  "1250": "Lucas Silva",
  "45865": "Lucas Villalba",
  "22040": "Luis Sinisterra",
  "178822": "Matheus Cunha Queiroz", // Matheus Cunha
  "1153": "Matheus Henrique",
  "45490": "Matheus Pereira (futebolista, 1996)", // Matheus Pereira
  "203390": "Otávio Costa", // Otávio
  "6532": "Walace",
  "49264": "Wanderson Maciel", // Wanderson
  "9418": "William de Asevedo Furtado", // William

  // Flamengo
  "11656": "Agustín Rossi",
  "2028": "Alex Sandro",
  "81896": "Andrew Ventura", // Andrew
  "1074": "Ayrton Lucas",
  "1317": "Bruno Henrique",
  "203359": "Daniel Sales",
  "7881": "Danilo Luiz da Silva",
  "1867": "Erick Pulgar",
  "1159": "Everton Cebolinha", // Éverton
  "203401": "Evertton Araújo", // Evertton
  "1244": "Giorgian de Arrascaeta", // Giorgian De Arrascaeta
  "56066": "Gonzalo Plata",
  "3165": "Guillermo Varela",
  "273193": "João Victor (futebolista, 2007)", // João Victor
  "29012": "Jorge Carrascal",
  "2094": "Jorge Luiz Frello Filho", // Jorginho
  "277520": "Caio Joshua Lana de Andrade", // Joshua
  "275020": "Léo Nannetti",
  "1408": "Léo Ortiz", // Leo Ortiz
  "11192": "Léo Pereira",
  "1543": "Lucas Paquetá",
  "8413": "Luiz Araújo",
  "168795": "Nicolás de la Cruz", // Nicolas de la Cruz
  "1077": "Pedro Guilherme Abreu dos Santos", // Pedro
  "178710": "Samuel Lino",
  "118": "Saúl Ñíguez", // Saúl
  "113807": "Vitão (futebolista)", // Vitão
  "249147": "Wallace Yan", // Yan

  // Fluminense
  "28614": "Agustín Canobbio",
  "1154": "Alisson (futebolista)", // Alisson
  "274161": "Davi Schuindt",
  "28561": "David Terans",
  "1230": "Fábio Deivson Lopes Maciel", // Fábio
  "245200": "Facundo Bernal",
  "76": "Paulo Henrique Ganso", // Ganso
  "15929": "Guilherme Arana",
  "145985": "Hércules (futebolista)", // Hércules
  "21689": "Hulk (futebolista)", // Hulk
  "97470": "Ignácio (futebolista)", // Ignácio
  "1215": "Igor Rabello",
  "77159": "Jefferson Savarino",
  "250800": "Jemmes",
  "157533": "John Kennedy (futebolista)", // John Kennedy
  "98654": "Freytes", // Juan Freytes
  "104480": "Julián Millán",
  "76910": "Lucho Acosta", // Luciano Acosta
  "136654": "Marcelo Pitaluga",
  "179177": "Martinelli (futebolista)", // Martinelli
  "61369": "Gustavo Nonato", // Nonato
  "8503": "Otávio Henrique", // Otávio
  "1546": "Renê (futebolista)", // Renê
  "273195": "Riquelme Felipe",
  "191363": "Rodrigo Castillo",
  "1107": "Samuel Xavier",
  "44235": "Vitor Eudes",
  "23333": "Yeferson Soteldo",

  // Grêmio
  "1148": "Arthur Melo", // Arthur
  "74729": "Caio Paulista",
  "37833": "Carlos Vinícius",
  "3219": "Cristian Pavón",
  "1087": "Dodi (futebolista)", // Dodi
  "147442": "Erick Noriega",
  "1436": "Fabián Balbuena",
  "33078": "Felipe Carballo",
  "8863": "Francis Amuzu",
  "168962": "Gabriel Grando", // Gabriel Chapeco
  "276279": "Gabriel Mec",
  "181463": "Gustavo Martins",
  "1387": "João Pedro Maturano dos Santos", // João Pedro
  "117570": "José Enamorado",
  "170674": "Juan Nardoni", // Juan Ignacio Nardoni
  "213173": "Leonel Pérez", // Leonel Perez
  "276278": "Luís Eduardo Guedes de Souza", // Luis Guedes
  "1178": "Marcos Rocha (futebolista)", // Marcos Rocha
  "1072": "Marlon Rodrigues Xavier", // Marlon
  "3467": "Martin Braithwaite",
  "46178": "Mathías Villasanti",
  "178482": "Miguel Monsalve",
  "168793": "Wagner Leonardo",
  "1138": "Walter Kannemann",
  "1170": "Weverton",
  "3230": "Willian",

  // Internacional
  "16481": "Alan Patrick",
  "114877": "Alan Rodríguez (futebolista uruguaio)", // Alan Rodríguez
  "1129": "Alerrandro",
  "133258": "Alexandro Bernabei",
  "129367": "Bruno Gomes",
  "1189": "Bruno Henrique Corsini", // Bruno Henrique
  "243622": "Clayton Sampaio", // Clayton
  "24740": "Félix Torres",
  "58": "Gabriel Mercado",
  "22061": "Johan Carbonero",
  "140872": "Matheus Bahia Santos", // Matheus Bahia
  "11680": "Rafael Santos Borré", // Rafael Borré
  "1091": "Richard Candido Coelho", // Richard
  "113611": "Rodrigo Villagra",
  "1550": "Ronaldo da Silva Souza", // Ronaldo
  "30386": "Sergio Rochet",
  "45372": "Bruno Tabata", // Tabata
  "8404": "Thiago Maia",
  "261682": "Yago Noal",

  // Mirassol
  "95982": "Alesson",
  "44810": "Alex Muralha",
  "13116": "André Luis Silva de Aguiar", // André Luis
  "179144": "Carlos Eduardo Ferreira de Souza", // Carlos Eduardo
  "183580": "Carlos Eduardo de Oliveira Alves", // Carlos Eduardo
  "272": "Gabriel Appelt Pires", // Gabriel
  "23363": "Lucas Mugni",
  "18732": "Negueba (futebolista, 1999)", // Negueba
  "1426": "Neto Moura",
  "1340": "Reinaldo Manoel da Silva", // Reinaldo
  "15914": "Tiquinho Soares",
  "1181": "Victor Luis",
  "1432": "Walter Leandro Capeloza Artune", // Walter

  // Palmeiras
  "183528": "Agustín Giay", // Agustin Giay
  "46454": "Alexander Barboza",
  "274216": "Allan (futebolista, 2004)", // Allan
  "33153": "Andreas Pereira",
  "115222": "Bruno Fuchs",
  "118029": "Carlos Miguel",
  "130957": "Emiliano Martínez (futebolista)", // Emiliano Martínez
  "2060": "Felipe Anderson",
  "1741": "Gustavo Gómez",
  "206776": "Jefté (futebolista)", // Jefte
  "22306": "Jhon Arias",
  "28740": "Joaquín Piquerez",
  "170698": "Flaco López", // José Manuel López
  "115559": "Khellven",
  "45173": "Lucas Evangelista (futebolista)", // Lucas Evangelista
  "249169": "Luighi", // Luighi Hanri
  "1562": "Marcelo Lomba",
  "1080": "Marlon Freitas",
  "119594": "Maurício (futebolista)", // Mauricio
  "170525": "Murilo Cerqueira",
  "140647": "Ramón Sosa",
  "181439": "Vitor Roque", // Vítor Roque

  // Santos
  "72714": "Adonis Frías",
  "122016": "Benjamín Rollheiser",
  "276239": "Gabriel Bontempo",
  "99380": "Gabriel Brazão",
  "139933": "Gabriel Menino",
  "45834": "Gonzalo Escobar (futebolista)", // Gonzalo Escobar
  "12616": "Igor Vinícius",
  "1849": "João Schmidt",
  "192844": "Lautaro Díaz", // Lautaro Diaz
  "1086": "Luan Peres",
  "1174": "Mayke",
  "8491": "Neymar",
  "280705": "Robinho Jr.", // Robson Júnior
  "1226": "Rony",
  "1156": "Thaciano",
  "2295": "Tomás Rincón",
  "1540": "Willian Arão",
  "169556": "Zé Ivaldo",
  "1380": "Zé Rafael",

  // São Paulo
  "46523": "Alan Franco",
  "1192": "Artur Victor", // Artur Guimaraes
  "171241": "Carlos Coronel",
  "9946": "Cauly",
  "3244": "Cédric Soares", // Cédric
  "168954": "Damián Bobadilla", // Damian Bobadilla
  "13860": "Danielzinho",
  "59844": "Enzo Díaz",
  "103499": "Ferreirinha (futebolista)", // Ferreira
  "149959": "Gonzalo Tapia",
  "177628": "Moreira (futebolista, 2004)", // João Moreira
  "3137": "Jonathan Calleri",
  "79609": "Sabino (futebolista, 1996)", // José Sabino
  "73058": "Luan Vinícius da Silva Santos", // Luan
  "8003": "Lucas Moura",
  "42901": "Luciano da Rocha Neves", // Luciano
  "85523": "Marcos Antônio (futebolista)", // Marcos Antônio
  "181372": "Dória (futebolista)", // Matheus Doria
  "169542": "Pablo Maia",
  "179023": "Rafael Pires Monteiro", // Rafael Monteiro
  "1832": "Rafael Tolói",
  "1338": "Robert Arboleda",
  "6475": "Wendell Nascimento Borges", // Wendell

  // Vasco da Gama
  "165615": "Adson Ferreira Soares", // Adson
  "202193": "Alan Saldivia",
  "1360": "Brenner Souza da Silva", // Brenner
  "22497": "Carlos Cuesta",
  "178432": "Andrés Gómez (futebolista)", // Carlos Gómez
  "181575": "Cuiabano (futebolista)", // Cuiabano
  "1169": "Daniel Fuzato",
  "1251": "David Corrêa da Fonseca", // David
  "103153": "Hugo Moura",
  "13192": "Jair (futebolista)", // Jair
  "178193": "Johan Rojas",
  "117822": "Lucas Piton",
  "85890": "Marino Hinestroza",
  "176241": "Matheus França", // Matheus Franca
  "171304": "Nuno Moreira",
  "169566": "Paulo Henrique (futebolista)", // Paulo Henrique
  "179017": "Robert Renan", // Robert
  "1172": "Tchê Tchê",
  "8402": "Thiago Mendes",

  // Vitória
  "40441": "Erick de Arruda Serafim", // Erick
  "2478": "Gabriel Vasconcellos", // Gabriel
  "61447": "Gabriel Baralhas",
  "95136": "Luan Cândido",
  "203646": "Matheuzinho (futebolista, 1997)", // Matheuzinho
  "179845": "Nathan (futebolista, 2002)", // Nathan
  "1602": "Neris (futebolista)", // Neris
  "115184": "Ramon Ramos Lima", // Ramon
  "12837": "Renato Kayzer",
  "44093": "Renzo López",
};
