import type { ClubCode, ClubDiscord } from "@/src/types";

/**
 * HAND-MAINTAINED — no data provider carries a supporters' chat server at any
 * tier, so this is curated, like `club-reddit.ts` and `club-instagram.ts`.
 *
 * Keyed by **our** club code (the upstream numeric id), never by `tla`:
 * Corinthians and Coritiba both report `COR`, and dropping one club's
 * supporters into another club's server is the exact failure that keying on an
 * abbreviation produces.
 *
 * The value is an `invite` and the `guild` it resolved to. `discordUrl` in
 * `club-core.ts` derives the address from the invite, so the origin is written
 * once and a pasted invite's `?event=…` suffix does not persist; the guild id
 * is never rendered and exists so `check-club-discord` can assert **identity**
 * rather than resemblance — see `ClubDiscord` in `src/types.ts` for why a
 * vanity code makes that necessary.
 *
 * **A Discord server is the SUPPORTERS' and not the club's**, which is
 * `club-reddit.ts`' rule and not a second idea: the page does not file this
 * beside the **Site oficial** and the **Instagram do clube**, and the
 * screen-reader suffix says "comunidade de torcedores". Nothing here is a
 * club's own statement, and presenting one as if it were is the kind of wrong
 * that looks right.
 *
 * **AN INVITE CODE AND NEVER A GUILD ID, and this is the file's whole trap.**
 * What a person pastes is `discord.com/channels/<guild>/@home`, because that is
 * what the address bar shows while they are reading the server. It is not a
 * link to anything a stranger can open: it is an in-app pointer for somebody
 * who is **already a member**, and a non-member following it gets their own
 * Discord with no join affordance and no sign that anything was meant to
 * happen. `discordInvite` refuses that shape outright rather than lifting the
 * id out of it.
 *
 * The second half is that a guild id **cannot be checked against anything**,
 * measured 2026-09-09 rather than assumed: `widget.json` answers 403 unless
 * the server opted in, `/v10/guilds/<id>/preview` answers 401, and
 * `discord.com/channels/<id>/@home` answers **200 with `<title>Discord</title>`
 * for a real id and for two invented ones**, within 50 bytes of each other.
 * That is the Instagram trap `player-instagram.ts` records, met at a second
 * host. An invite is public — `api/v10/invites/<code>?with_counts=true` names
 * the guild with no auth and answers `Unknown Invite` (10006) for a code nobody
 * minted — which is what `scripts/check-club-discord.ts` rests on, and why
 * this file has a checker where `player-instagram.ts` deliberately has none.
 *
 * **Prefer an invite set to never expire, with no use limit.** Discord's
 * default is 7 days and 0 uses remaining after the first join, so an invite
 * copied without editing those two fields rots within a week — a link that was
 * correct when it was written and is dead when a reader arrives. That is the
 * failure the checker catches and the one nothing in the build can.
 *
 * **Coverage is deliberately PARTIAL and grows by hand**, like `club-reddit.ts`
 * and `broadcasts.ts`. A club with no entry renders no link rather than a
 * guessed one — and there is nothing to guess from here, since a server's
 * invite code is minted rather than derived from the club's name.
 *
 * **O comentário de uma entrada fica IMEDIATAMENTE acima da própria entrada, e
 * as entradas estão por ordem numérica de código.** As duas regras puxam em
 * sentidos opostos — escrever um comentário é acrescentar ao fim, inserir uma
 * entrada é pôr no meio — e o resultado é que um comentário acrescentado ao fim
 * aterra sobre a entrada de OUTRO clube. Aconteceu duas vezes antes de alguém
 * reparar: o bloco do FlaDiscord, que documenta a guild `956…` do Flamengo,
 * ficou por cima do Athletico-PR, e o do Palmeiras por cima do Bahia. Nada vai
 * ao vermelho por isso — um comentário não compila, não renderiza e não é
 * verificado por checker nenhum — e o custo é exatamente o que este ficheiro
 * existe para evitar: quem vier a seguir lê a prova do clube errado ao lado de
 * um id que não é o dela. Depois de inserir, confirme que cada bloco fica sobre
 * a sua entrada, o que se lê de uma vez:
 *
 *     awk '/^  \/\//{if(!c){c=1; first=NR": "$0}} /^  "[0-9]{4}":/{print first" ==> "$1; c=0}' \
 *       src/data/club-discord.ts
 */
export const CLUB_DISCORD: Record<ClubCode, ClubDiscord> = {
  // Flucord — "Maior servidor não oficial sobre o Fluminense Football Club no
  // discord!", 4 053 membros, sem expiração. Vanity, **confirmada por DUAS
  // ligações independentes**: o convite recebido (um código cunhado por um
  // membro) e a vanity própria da guild, `discord.gg/fluminense`, resolvem
  // ambas para a guild `964558466712735764` — a força de prova do Flamengo, e
  // não a da Palmeiras, que não teve uma segunda ligação a confirmar a
  // primeira.
  "1765": { invite: "fluminense", guild: "964558466712735764" },
  // AthletiCord #600 — 622 membros, sem expiração. Um código cunhado, não uma
  // vanity, e **veio da listagem pública do Disboard** em vez de ser cunhado
  // para nós: uma listagem parte-se se o convite morrer, portanto é permanente
  // por necessidade dela e não por favor nosso. O primeiro convite oferecido
  // para esta entrada expirava a 2026-10-10 e o `check-club-discord` recusou-o
  // pela cláusula de expiração — que até aí nunca tinha disparado contra um
  // convite real.
  //
  // **Clube corroborado por três vias, nenhuma delas o trocadilho do nome.**
  // "AthletiCord" sugere Athletico-PR pelo `h`, e isso é ortografia, que é o
  // que este ficheiro recusa como identidade em todo o lado. O que estabelece
  // o clube: as etiquetas da listagem (`ATHLETICO-PARANAENSE`, `FURACÃO`,
  // `ATLETICO-PR`), a mensagem de boas-vindas do próprio servidor — "Fala,
  // Furacão! … vive o Athletico 24h", "AQUI É FURACÃO" — e o escudo. *Furacão*
  // é do Athletico-PR e de mais ninguém; *rubro-negro* sozinho não servia,
  // porque o Flamengo também é.
  //
  // **O convite original (`cYyWz3RR4k`) expirou** — `check-club-discord`
  // passou a reportar "Invite is expired." em 2026-09-13, apesar do
  // `expires_at: null` registado quando foi guardado: um convite de listagem
  // pode ser trocado pelo próprio servidor a qualquer momento, sem aviso a
  // quem o guardou. Substituído pelo convite corrente da MESMA listagem do
  // Disboard (`AthletiCord #600`, etiqueta `furacão`, bump há 2 dias em
  // 2026-09-13): `2cgqNvYvBU`, confirmado a resolver para a mesma guild
  // `1395888999276613632` via `api/v10/invites`, 617 membros,
  // `expires_at: null`.
  "1768": { invite: "2cgqNvYvBU", guild: "1395888999276613632" },
  // Palmeiras • ＯＢＳＥＳＳÃＯ — 20 010 membros, sem expiração. Vanity, como a
  // do Flamengo.
  //
  // **Sem âncora independente, ao contrário do Flamengo**, cuja guild foi
  // confirmada contra o `channels/<guild>` que originou a entrada. Aqui só veio
  // o convite, portanto a prova de que este é o servidor certo é o próprio
  // servidor a dizê-lo: "O servidor não oficial da Sociedade Esportiva
  // Palmeiras é o espaço ideal para os palmeirenses se reunirem…". Nomeia o
  // clube pelo nome legal E diz **não oficial**, que é precisamente o sufixo
  // "comunidade de torcedores" que a ligação carrega.
  "1769": { invite: "palmeiras", guild: "794150101504491530" },
  // Cruzeiro E.C. #1,7k — 1 682 membros, sem expiração. **Vanity** (o próprio
  // `vanity_url_code` retornado pela API é igual ao código do convite), o que
  // por si só implica sem expiração e sem limite de usos — nenhuma das duas
  // condições precisou de confirmação à parte, ao contrário de um convite
  // cunhado. Corroborado pela própria descrição do servidor: "Servidor não
  // oficial do Cruzeiro Esporte Clube!" — nomeia o clube e diz **não oficial**,
  // exatamente o par que o sufixo "comunidade de torcedores" carrega.
  "1771": { invite: "cruzeiro-e-c-1k-1168068145848799313", guild: "1168068145848799313" },
  // Chapecoense — 112 membros, sem expiração. Um código **cunhado**, não uma
  // vanity (`vanity_url_code` é `null`), portanto a ausência de expiração teve
  // de ser confirmada à parte, ao contrário da do Cruzeiro, onde a vanity já a
  // implicava.
  //
  // **A confirmação de que «sem expiração» foi escolhido e não é o `null` de um
  // convite acabado de cunhar: o convite é velho.** O id do objeto do convite
  // (`1486502306210910208`) decodifica como snowflake para 2026-03-25 e a
  // guild (`1486146679458496606`) para 2026-03-24 — cerca de seis meses antes
  // desta leitura. O padrão do Discord é 7 dias, portanto um convite deixado no
  // padrão estaria morto desde março. É a cláusula de expiração do
  // `check-club-discord` respondida pelo relógio em vez de pela nossa palavra,
  // que é o que faltou ao primeiro convite do Athletico-PR.
  //
  // **Sem âncora independente**, como o Palmeiras e o Bahia. O URL que originou
  // a entrada era `discadia.com/chapecoense/`, uma **listagem**, e essa não
  // serve de segunda ligação por duas razões medidas em 2026-09-17: responde
  // 200 com ~800 B de desafio JS (`cosmic`) tanto para `chapecoense` como para
  // um id inventado — o par indistinguível que o `player-instagram.ts` regista
  // — e a página que de facto renderiza é um portão «Verify to Join» com
  // captcha, que ninguém aqui atravessa. A listagem corrobora quando muito o
  // **nome**; não sabe dizer a guild, que é a única coisa que este ficheiro
  // guarda como identidade.
  //
  // Então a prova é o servidor a dizê-lo de si próprio, a forma do Palmeiras:
  // "O maior servidor **não oficial** da Associação Chapecoense de Futebol."
  // Nomeia o clube pelo nome legal E diz não oficial — o par exato que o sufixo
  // "comunidade de torcedores" carrega. As etiquetas do perfil dizem o mesmo
  // sem ortografia: `Chapecoense`, `Futebol`, `Maior de Santa Catarina`.
  //
  // **112 membros é de longe o menor do ficheiro** (o seguinte são os 617 do
  // Athletico-PR). Está registado aqui para que ninguém leia o número como
  // sinal de convite mal resolvido mais tarde: a guild responde, o clube está
  // estabelecido, e a Chapecoense é um clube pequeno com uma torcida pequena
  // no Discord.
  "1772": { invite: "85ufbuxHbK", guild: "1486146679458496606" },
  // EC Bahia — vanity, 10 286 membros, sem expiração. Mesma forma de prova que
  // a do Palmeiras: só veio o convite, então o que estabelece o servidor certo
  // é ele próprio a dizê-lo — "O servidor não-oficial do Esporte Clube Bahia. O
  // time mais vencedor e popular da região Nordeste do Brasil." Nomeia o clube
  // pelo nome legal E diz **não-oficial**, o mesmo par que o Palmeiras dá.
  "1777": { invite: "bahia", guild: "1297362681409568798" },
  // FlaDiscord — "O maior servidor não oficial do Flamengo, sendo a casa da
  // torcida no Discord", 49 862 membros, sem expiração. A vanity, so the code
  // is a word rather than the usual eight characters.
  //
  // **Confirmed by GUILD ID and not by its name**, which is the stronger check
  // and the one available here: the invite resolves to guild
  // `956003357129076746`, the same server as the `channels/<guild>` address
  // this entry was raised from. A name match could not have said that — the
  // server calls itself *FlaDiscord*, which contains no word of "CR Flamengo".
  "1783": { invite: "flamengo", guild: "956003357129076746" },
};
