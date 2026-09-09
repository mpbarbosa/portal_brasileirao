import type { ClubCode } from "@/src/types";

/**
 * HAND-MAINTAINED — no data provider carries a supporters' chat server at any
 * tier, so this is curated, like `club-reddit.ts` and `club-instagram.ts`.
 *
 * Keyed by **our** club code (the upstream numeric id), never by `tla`:
 * Corinthians and Coritiba both report `COR`, and dropping one club's
 * supporters into another club's server is the exact failure that keying on an
 * abbreviation produces.
 *
 * The value is the **invite code alone** — `aBcD1234`, or a vanity name where
 * the server has one. `discordUrl` in `club-core.ts` derives the address, so
 * the origin is written once and a pasted invite's `?event=…` suffix does not
 * persist.
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
export const CLUB_DISCORD: Record<ClubCode, string> = {
  // Flamengo ("1783") is the first entry and is pending an invite: the URL it
  // was raised by is a `channels/<guild>` address, which the rule above
  // refuses. Nothing is written here until a `discord.gg/…` invite has been
  // read back through `check-club-discord`.
};
