/**
 * HAND-MAINTAINED — the data provider carries no third-party identifiers at any
 * tier, so these are curated, like `player-wikipedia.ts` and
 * `player-instagram.ts`.
 *
 * Keyed by **player id** — the upstream numeric id as a string — never by name,
 * for the reason `player-instagram.ts` gives at length. This file is the
 * demonstration: Athletico-PR's two Dudus are `859083` and `1482354`, two men
 * ten years apart, and a name key would have to pick one of them.
 *
 * The value is the **Sofascore id alone**, exactly as `player-wikipedia.ts`
 * stores an article title. `sofascoreUrl` in `player-core.ts` builds the
 * address.
 *
 * The slug a Sofascore URL carries — `…/player/memphis-depay/138833` — is
 * deliberately **not** stored, because the site does not need it: `_` in the
 * slug position resolves by id and redirects to the canonical address. That is
 * Wikidata's own formatter for this identifier (P12302, `…/player/_/$1`), and
 * it was checked in a browser against eight of the ids below. Storing the slug
 * would add a second field that can rot on a rename while buying nothing, and
 * it is what makes this file a plain `Record<string, string>` like its two
 * neighbours.
 *
 * A locale prefix is not stored either, and cannot be: `/pt/player/_/138833` is
 * a 404, and `/pt/football/player/memphis-depay/138833` — the shape a reader
 * pastes — redirects to the unprefixed address anyway. Sofascore negotiates the
 * language itself, so a Brazilian reader lands in Portuguese without our help.
 *
 * Coverage is **partial**, like every curated file here — 427 of the 948 listed
 * players, spread across all twenty clubs. A player absent here renders no link.
 *
 * ## How these were checked
 *
 * Candidates came from Wikidata items carrying **P12302 (Sofascore player ID)**,
 * queried by the 859 distinct dates of birth in `squads.ts` and joined on exact
 * date of birth **plus** an exact normalised name — against the item's pt, pt-br
 * and en labels, its pt/en/es aliases, and its `ptwiki` title. 141 of the 427
 * did not need the name at all: their `ptwiki` title is the one
 * `player-wikipedia.ts` already records, and `check-player-wikipedia` has
 * verified that against the article's own stated birth date. Those ride on a
 * join somebody already read.
 *
 * A match was **dropped rather than guessed** wherever the evidence forked: two
 * Wikidata items sharing a name and a birth date, an item carrying two Sofascore
 * ids, or a name+date hit that lands on a different article than the one
 * `player-wikipedia.ts` records for that player. None of those fired, which is
 * the point of running the check rather than assuming it.
 *
 * Every match was then re-queried for citizenship (P27) and occupation (P106)
 * and compared against `squads.ts`. That found six disagreements and **three
 * were real**, all on the name+date path — Vitinho (ours Brazilian, the item
 * Italian), Matheus Reis and Alexandre Guedes. All three are dropped. The other
 * three were the join's own vocabulary: Wikidata says "Kingdom of the
 * Netherlands" and "Kingdom of Denmark" where the provider says the country, and
 * Alex Santana holds a Bulgarian passport the provider reports instead of his
 * Brazilian one.
 *
 * **There is no `check-player-sofascore` script, and that is a property of the
 * host rather than of diligence** — the same asymmetry `player-instagram.ts`
 * records. Sofascore is behind Cloudflare: every request from `curl` and from
 * the API host answers **403**, whatever the User-Agent, so a checker would have
 * nothing to read. Eight ids were opened in a real browser instead and each
 * resolved to the right player at the right club. Do not add an id from a search
 * result without opening it.
 */
export const PLAYER_SOFASCORE: Record<string, string> = {
  // Athletico-PR
  "104494": "974512",  // Carlos Terán
  "1584": "859083",    // Dudu
  "211606": "1482354", // Dudu
  "127557": "981452",  // Gastón Benavídez
  "202198": "1464519", // Isaac
  "1083": "243651",    // Jádson
  "22166": "925173",   // Juan Aguirre
  "178353": "2441724", // Juan Portilla
  "56226": "1167536",  // Julimar
  "1386": "360940",    // Léo
  "153853": "1087079", // Lucas Esquivel
  "8357": "29735",     // Luiz Gustavo
  "187426": "1128850", // Mycael
  "8606": "354510",    // Stiven Mendoza

  // Atlético-MG
  "24670": "822729",   // Alan Franco
  "179174": "1122552", // Alan Minda
  "24673": "881844",   // Ángelo Preciado
  "16476": "241488",   // Bernard
  "1182": "147464",    // Dudu
  "1695": "870748",    // Everson
  "178929": "1117032", // Gabriel Delfim
  "72781": "559036",   // Gustavo Scarpa
  "82534": "913598",   // Igor Gomes
  "218742": "1464929", // Iván Román
  "8395": "333275",    // Júnior Alonso
  "2283": "797893",    // Lyanco
  "7569": "832708",    // Mateo Cassierra
  "1447": "831778",    // Maycon
  "141379": "1046805", // Natanael
  "123350": "978562",  // Reinier
  "1671": "851150",    // Renan Lodi
  "131258": "914487",  // Ruan
  "46266": "871273",   // Tomás Cuello
  "213331": "1485090", // Tomás Pérez
  "178854": "1170954", // Victor Hugo Gomes
  "1773": "794838",    // Vitor Hugo

  // Bahia
  "1661": "922546",    // Ademir Santos
  "136393": "1008832", // Caio Alexandre
  "142131": "1068987", // Cristian Olivera
  "13419": "810715",   // David Duarte
  "275590": "2050427", // Dell
  "18478": "874063",   // Erick
  "1548": "145063",    // Éverton Ribeiro
  "181587": "1117710", // Gabriel Xavier
  "1073": "261687",    // Gilberto
  "1566": "869644",    // Iago Borduchi
  "1547": "927975",    // Jean Lucas
  "1205": "871705",    // Kanu
  "140873": "1017264", // Luciano Juba
  "249151": "1634148", // Luiz Gustavo
  "179535": "1174196", // Marcos Victor
  "191376": "1182233", // Mateo Sanabria
  "107803": "959620",  // Nicolás Acevedo
  "110928": "905461",  // Rodrigo Nestor
  "250314": "1807816", // Román Gómez
  "1496": "840106",    // Ronaldo
  "262357": "1633616", // Ruan Pablo
  "8": "123223",       // Willian José

  // Botafogo
  "15904": "312110",   // Alex Telles
  "250493": "1650770", // Alvaro Montoro
  "1723": "870762",    // Arthur Cabral
  "171861": "215956",  // Bastos
  "203361": "1440798", // Bernardo Valim
  "151999": "1069328", // Caio Roque
  "250332": "1470452", // Cristhian Loor
  "154595": "1003010", // Cristian Medina
  "149704": "1064039", // Danilo dos Santos de Oliveira
  "1580": "221636",    // Edenilson
  "206227": "1482359", // Jhoan Hernández
  "77": "249929",      // Joaquín Correa
  "206393": "1899902", // Jordan Barrera
  "12653": "922559",   // Júnior Santos
  "37418": "990193",   // Kaio Pantaleão
  "179157": "1119887", // Leo Linck
  "274539": "1482356", // Lucas Camilo
  "165989": "1109864", // Lucas Villalba
  "8457": "143593",    // Marçal
  "160792": "1099163", // Mateo Ponte
  "169234": "1106779", // Matheus Martins
  "3221": "84844",     // Neto
  "203397": "1463909", // Newton
  "113671": "975216",  // Santiago Rodríguez

  // Bragantino
  "142936": "1018093", // Bruno Praxedes
  "280896": "2032806", // Davi Gomes
  "1326": "143846",    // Eduardo Sasha
  "82776": "950545",   // Eric Ramires
  "179156": "1117513", // Fabinho
  "192621": "1463904", // Gustavinho
  "179007": "1174764", // Gustavo Marques
  "131880": "997239",  // Guzmán Rodríguez
  "178206": "1170680", // Henry Mosquera
  "166367": "1112896", // Ignacio Sosa
  "114353": "979861",  // Isidro Pitta
  "144471": "990454",  // João Neto
  "131279": "987589",  // José Hurtado
  "1439": "870556",    // Juninho Capixaba
  "169236": "1067641", // Lucas Barbosa
  "1214": "840150",    // Matheus Fernandes
  "1435": "551774",    // Pedro Henrique
  "39920": "243509",   // Tiago Volpi
  "154767": "1067640", // Vanderlan

  // Chapecoense
  "73828": "942061",   // Anderson
  "138222": "1015935", // Ênio
  "1485": "82680",     // Giovanni Augusto
  "171073": "973845",  // Higor Meritao
  "13922": "850475",   // Jean Carlos
  "22136": "789931",   // Kevin Ramírez
  "169460": "1108007", // Mancha
  "19255": "942054",   // Marcos Vinicius
  "150815": "1050353", // Maurício Garcez
  "299874": "1184312", // Miguel Carvalho
  "1274": "354894",    // Rafael Thyere
  "105065": "846362",  // Walter Clar
  "7838": "46620",     // Yannick Bolasie

  // Clube do Remo
  "90803": "954719",   // Alef Manga
  "180287": "818441",  // Braian Cufré
  "12960": "852534",   // Carlinhos
  "147477": "1086482", // Diego Hernández
  "141427": "1018777", // Eduardo Melo
  "154674": "1089140", // Franco Catarozzi
  "56082": "937806",   // Gabriel Poveda
  "11194": "933955",   // Gabriel Taliari
  "113521": "869639",  // Jáderson
  "169720": "1018779", // Jája Silva
  "119621": "981019",  // João Lucas
  "37366": "362966",   // João Pedro
  "168986": "551422",  // Jose Welison
  "13899": "864016",   // Léo Andrade
  "113224": "981350",  // Leonel Picco
  "13394": "870902",   // Marcelo Rangel
  "1441": "221206",    // Marllon
  "83595": "953736",   // Matheus Alexandre
  "19262": "944459",   // Mayk
  "15992": "32985",    // Panagiotis Tachtsidis
  "139932": "1015291", // Patrick de Paula
  "291067": "2024892", // Rafael Monti
  "3738": "355802",    // Víctor Cantillo
  "168807": "808785",  // Vitor Bueno
  "1465": "363688",    // Yago Pikachu
  "73778": "943044",   // Zé Ricardo

  // Corinthians
  "1609": "358166",    // Alex Santana
  "56574": "828839",   // Allan
  "3789": "115182",    // André Carrillo
  "285271": "1647612", // André Luiz
  "16342": "148155",   // André Ramalho
  "169688": "981703",  // Bidu
  "1577": "845178",    // Charles
  "46376": "311462",   // Fabrizio Angileri
  "33145": "124737",   // Gabriel Paulista
  "1301": "243181",    // Gustavo Henrique
  "120089": "1017827", // Hugo
  "82991": "950454",   // Hugo Souza
  "3325": "205508",    // Jesse Lingard
  "192626": "1396009", // Kaio César
  "179167": "1002609", // Matheus Donelli
  "1614": "795268",    // Matheus Pereira
  "13710": "931540",   // Matheuzinho
  "8472": "138833",    // Memphis Depay
  "137557": "985809",  // Pedro Milans
  "40134": "866911",   // Pedro Raul
  "60058": "994454",   // Rodrigo Garro
  "1325": "905463",    // Yuri Alberto

  // Coritiba
  "169022": "937552",  // Breno Lopes
  "12678": "870851",   // Bruno Melo
  "203388": "1588326", // Éberth
  "129391": "995294",  // Fabinho
  "1706": "931574",    // Felipe Jonatan
  "13851": "931479",   // Fernando Sobral
  "259981": "1122737", // Joaquín Lavega
  "1193": "787607",    // Keno
  "30539": "44691",    // Maicon
  "156724": "1092614", // Pedro Rangel
  "179086": "1194689", // Renato Marques
  "1572": "72080",     // Rodrigo Moledo
  "19958": "989091",   // Rodrigo Rodrigues
  "22162": "925142",   // Sebastián Gómez
  "1184": "378590",    // Thiago Santos
  "12670": "330057",   // Tinga
  "12781": "295167",   // Willian Oliveira

  // Cruzeiro
  "169004": "817650",  // Bruno Rodrigues
  "1431": "27756",     // Cássio
  "40067": "866847",   // Chico
  "118245": "981733",  // Christian
  "1266": "840220",    // Fabrício Bruno
  "1434": "25554",     // Fágner
  "297547": "2028294", // Felipe Morais
  "1815": "611876",    // Gerson
  "115095": "978638",  // João Marcelo
  "181633": "1112484", // Kaiki Bruno
  "91310": "954888",   // Kaio Jorge
  "276255": "1887796", // Kaua Prates
  "205585": "1482431", // Keny Arroyo
  "1246": "263477",    // Lucas Romero
  "1250": "245159",    // Lucas Silva
  "45865": "260077",   // Lucas Villalba
  "22040": "836070",   // Luis Sinisterra
  "169277": "1116954", // Marquinhos
  "178822": "1105835", // Matheus Cunha
  "1153": "912786",    // Matheus Henrique
  "45490": "377238",   // Matheus Pereira
  "6532": "553686",    // Walace
  "49264": "247483",   // Wanderson
  "9418": "604274",    // William

  // Flamengo
  "11656": "1140986",  // Agustín Rossi
  "2028": "84854",     // Alex Sandro
  "81896": "947893",   // Andrew
  "1074": "818473",    // Ayrton Lucas
  "1317": "795291",    // Bruno Henrique
  "203359": "1459762", // Daniel Sales
  "7881": "124992",    // Danilo Luiz da Silva
  "1131": "856123",    // Emerson Royal
  "1867": "590262",    // Erick Pulgar
  "1159": "386198",    // Éverton
  "1244": "333587",    // Giorgian De Arrascaeta
  "56066": "937937",   // Gonzalo Plata
  "3165": "311456",    // Guillermo Varela
  "272828": "1482346", // João Pedro
  "29012": "590392",   // Jorge Carrascal
  "2094": "132874",    // Jorginho
  "1408": "869643",    // Leo Ortiz
  "11192": "358548",   // Léo Pereira
  "1543": "839981",    // Lucas Paquetá
  "8413": "840451",    // Luiz Araújo
  "168795": "877513",  // Nicolas de la Cruz
  "1077": "840219",    // Pedro
  "178710": "874705",  // Samuel Lino
  "118": "116955",     // Saúl
  "113807": "876625",  // Vitão

  // Fluminense
  "28614": "846413",   // Agustín Canobbio
  "1154": "291723",    // Alisson
  "28561": "586662",   // David Terans
  "1230": "17785",     // Fábio
  "245200": "1177404", // Facundo Bernal
  "76": "116853",      // Ganso
  "12594": "928134",   // Guga
  "15929": "1127439",  // Guilherme Arana
  "169278": "1106144", // Gustavo Ramalho
  "145985": "1104068", // Hércules
  "21689": "34705",    // Hulk
  "97470": "958382",   // Ignácio
  "1215": "753662",    // Igor Rabello
  "77159": "874739",   // Jefferson Savarino
  "250800": "1527129", // Jemmes
  "157533": "1087399", // John Kennedy
  "98654": "962187",   // Juan Freytes
  "76910": "548030",   // Luciano Acosta
  "136654": "1093974", // Marcelo Pitaluga
  "179177": "1067671", // Martinelli
  "61369": "922566",   // Nonato
  "274162": "1884792", // Oliver
  "8503": "552686",    // Otávio
  "1546": "243113",    // Renê
  "273195": "1884803", // Riquelme Felipe
  "191363": "1182504", // Rodrigo Castillo
  "1107": "795773",    // Samuel Xavier
  "44235": "927666",   // Vitor Eudes
  "278024": "2082072", // Wesley Natã
  "23333": "789960",   // Yeferson Soteldo

  // Grêmio
  "74729": "931591",   // Caio Paulista
  "37833": "891920",   // Carlos Vinícius
  "3219": "358956",    // Cristian Pavón
  "1087": "870804",    // Dodi
  "147442": "1020375", // Erick Noriega
  "1436": "339447",    // Fabián Balbuena
  "33078": "805038",   // Felipe Carballo
  "8863": "901889",    // Francis Amuzu
  "168962": "1111770", // Gabriel Chapeco
  "181463": "1105796", // Gustavo Martins
  "1387": "605528",    // João Pedro
  "117570": "974558",  // José Enamorado
  "170674": "989862",  // Juan Ignacio Nardoni
  "213173": "1471214", // Leonel Perez
  "1178": "82576",     // Marcos Rocha
  "1072": "870787",    // Marlon
  "3467": "66471",     // Martin Braithwaite
  "46178": "1139775",  // Mathías Villasanti
  "178482": "1066620", // Miguel Monsalve
  "116177": "980327",  // Tetê
  "168793": "976235",  // Wagner Leonardo
  "1170": "243529",    // Weverton
  "3230": "31417",     // Willian

  // Internacional
  "16481": "124997",   // Alan Patrick
  "114877": "874576",  // Alan Rodríguez
  "1129": "923948",    // Alerrandro
  "133258": "989200",  // Alexandro Bernabei
  "153573": "1084963", // Braian Aguirre
  "129367": "995071",  // Bruno Gomes
  "1189": "345113",    // Bruno Henrique
  "24740": "881848",   // Félix Torres
  "58": "128376",      // Gabriel Mercado
  "22061": "925125",   // Johan Carbonero
  "168882": "1106151", // Kayky
  "192652": "1464309", // Paulinho
  "11680": "560116",   // Rafael Borré
  "278143": "1888163", // Raykkonen
  "113611": "978563",  // Rodrigo Villagra
  "1550": "824152",    // Ronaldo
  "30386": "581060",   // Sergio Rochet
  "8404": "358550",    // Thiago Maia
  "165600": "1106487", // Victor Gabriel
  "169553": "982405",  // Vitinho

  // Mirassol
  "95982": "871015",   // Alesson
  "44810": "340113",   // Alex Muralha
  "179043": "883207",  // Antonio Galeano
  "183580": "76507",   // Carlos Eduardo
  "103163": "880132",  // Chico
  "12931": "794874",   // Daniel Borges
  "1617": "874195",    // Igor Cariús
  "181603": "1009030", // Igor Formiga
  "103442": "863297",  // João Victor
  "121909": "988851",  // José Aldo
  "23363": "249881",   // Lucas Mugni
  "18732": "872007",   // Negueba
  "1426": "559034",    // Neto Moura
  "1348": "874723",    // Shaylon
  "15914": "789100",   // Tiquinho Soares
  "1181": "252781",    // Victor Luis
  "13516": "925871",   // Willian Machado

  // Palmeiras
  "183528": "1106603", // Agustin Giay
  "46454": "801044",   // Alexander Barboza
  "274216": "1835889", // Allan
  "33153": "285949",   // Andreas Pereira
  "115222": "973737",  // Bruno Fuchs
  "118029": "973738",  // Carlos Miguel
  "130957": "973533",  // Emiliano Martínez
  "2060": "152276",    // Felipe Anderson
  "1741": "220833",    // Gustavo Gómez
  "206776": "1116665", // Jefte
  "22306": "844096",   // Jhon Arias
  "28740": "881110",   // Joaquín Piquerez
  "170698": "1094179", // José Manuel López
  "115559": "984896",  // Khellven
  "45173": "331397",   // Lucas Evangelista
  "287767": "1884646", // Luis Pacheco
  "1562": "34141",     // Marcelo Lomba
  "1080": "840202",    // Marlon Freitas
  "119594": "986233",  // Mauricio
  "170525": "874729",  // Murilo Cerqueira
  "1490": "885179",    // Paulinho
  "281587": "1634976", // Rafael Coutinho
  "140647": "1015733", // Ramón Sosa
  "249222": "1485294", // Riquelme Fillipi
  "181439": "1150391", // Vítor Roque

  // Santos
  "72714": "940699",   // Adonis Frías
  "83705": "949687",   // Álvaro Barreal
  "28708": "923803",   // Christian Oliva
  "1327": "358554",    // Gabriel Barbosa
  "276239": "1656036", // Gabriel Bontempo
  "99380": "905448",   // Gabriel Brazão
  "139933": "974556",  // Gabriel Menino
  "45834": "840500",   // Gonzalo Escobar
  "12616": "840119",   // Igor Vinícius
  "1849": "244591",    // João Schmidt
  "192844": "992093",  // Lautaro Diaz
  "1086": "842098",    // Luan Peres
  "1174": "273329",    // Mayke
  "8491": "124712",    // Neymar
  "293967": "2082091", // Rafael Gonzaga
  "280705": "2191860", // Robson Júnior
  "1156": "872039",    // Thaciano
  "2295": "46798",     // Tomás Rincón
  "276230": "2039241", // Vinícius Lira
  "1540": "242213",    // Willian Arão
  "169556": "844602",  // Zé Ivaldo
  "1380": "329069",    // Zé Rafael

  // São Paulo
  "46523": "875402",   // Alan Franco
  "45459": "925072",   // André Silva
  "1192": "841128",    // Artur Guimaraes
  "171241": "800150",  // Carlos Coronel
  "9946": "255873",    // Cauly
  "3244": "44760",     // Cédric
  "168954": "1015261", // Damian Bobadilla
  "13860": "356514",   // Danielzinho
  "59844": "932937",   // Enzo Díaz
  "149959": "1002947", // Gonzalo Tapia
  "3137": "340519",    // Jonathan Calleri
  "8003": "149710",    // Lucas Moura
  "13647": "797225",   // Lucas Ramon
  "276282": "2162243", // Lucca Marques
  "42901": "282557",   // Luciano
  "276272": "2035326", // Maik
  "85523": "905453",   // Marcos Antônio
  "192632": "1466551", // Matheus Belém
  "181372": "243155",  // Matheus Doria
  "169542": "1120721", // Pablo Maia
  "179023": "33132",   // Rafael Monteiro
  "1832": "82943",     // Rafael Tolói
  "1338": "338937",    // Robert Arboleda

  // Vasco da Gama
  "165615": "1105970", // Adson
  "202193": "1112908", // Alan Saldivia
  "1360": "884980",    // Brenner
  "22497": "839095",   // Carlos Cuesta
  "178432": "1160386", // Carlos Gómez
  "181575": "1160554", // Cuiabano
  "1169": "863276",    // Daniel Fuzato
  "103153": "973293",  // Hugo Moura
  "178193": "1173373", // Johan Rojas
  "179586": "595598",  // Léo Jardim
  "119622": "1069729", // Lucas Freitas
  "117822": "982174",  // Lucas Piton
  "85890": "972587",   // Marino Hinestroza
  "176241": "1116593", // Matheus Franca
  "171304": "851285",  // Nuno Moreira
  "169566": "1021721", // Paulo Henrique
  "1172": "840398",    // Tchê Tchê
  "8402": "329303",    // Thiago Mendes

  // Vitória
  "32156": "823831",   // Aitor Cantalapiedra
  "77470": "929200",   // Cacá
  "103621": "871032",  // Caique
  "127239": "992791",  // Claudinho
  "250521": "1650040", // Diego Tarzia
  "179171": "1124220", // Dudu
  "40441": "895650",   // Erick
  "61447": "922575",   // Gabriel Baralhas
  "103300": "879899",  // Junior Ramos
  "166758": "1032938", // Kike Saverio
  "95136": "905459",   // Luan Cândido
  "169696": "982558",  // Lucas Arcanjo
  "179845": "1116955", // Nathan
  "247158": "911263",  // Pedro Henrique
  "115184": "980761",  // Ramon
  "12837": "814723",   // Renato Kayzer
  "44093": "926513",   // Renzo López
  "21166": "927166",   // Riccieli
  "19142": "931521",   // Ronald
  "140876": "905464",  // Yuri Sena
  "181537": "1188028", // Zé Vitor
};
