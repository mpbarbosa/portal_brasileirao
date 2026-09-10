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
 */
export const CLUB_DISCORD: Record<ClubCode, ClubDiscord> = {
  // FlaDiscord — "O maior servidor não oficial do Flamengo, sendo a casa da
  // torcida no Discord", 49 862 membros, sem expiração. A vanity, so the code
  // is a word rather than the usual eight characters.
  //
  // **Confirmed by GUILD ID and not by its name**, which is the stronger check
  // and the one available here: the invite resolves to guild
  // `956003357129076746`, the same server as the `channels/<guild>` address
  // this entry was raised from. A name match could not have said that — the
  // server calls itself *FlaDiscord*, which contains no word of "CR Flamengo".
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
  "1768": { invite: "cYyWz3RR4k", guild: "1395888999276613632" },
  "1769": { invite: "palmeiras", guild: "794150101504491530" },
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
  "1783": { invite: "flamengo", guild: "956003357129076746" },
};
