/**
 * HAND-MAINTAINED — the **apelido** a player is known by, where it is not the
 * name the provider lists him under. Shown **beside** that name, never in place
 * of it: `squads.ts`, the artilharia and the gols all carry the provider's or
 * CBF's spelling, and a reader who meets "Gabriel Barbosa" on one page and
 * "Gabigol" alone on the next is reading two players.
 *
 * Keyed by **player id**, like `player-instagram.ts` beside it, and never by
 * name: the division carries several Gabriels, and an apelido attached to a
 * name would follow every one of them.
 *
 * **This is not `player-overrides.ts`.** That file corrects a name that is not
 * a name at all and refuses to prefer one real name to another; an apelido is
 * neither a correction nor a preference, it is a second name printed alongside
 * the first. Putting it there would make the override's `name` rule mean two
 * things.
 *
 * The bar is that the apelido is how the press and the club refer to the
 * player — not a nickname a fan forum uses. An entry that merely restates the
 * listed name is refused by `tests/player-core.test.ts`, as is one naming an id
 * no longer in the snapshot.
 *
 * Coverage is **partial and always will be**; a player absent here shows his
 * listed name alone.
 */
export const PLAYER_NICKNAMES: Record<string, string> = {
  // Gabriel Barbosa Almeida, Santos, born 1996-08-30 — the id and date
  // `squads.ts` carries. "Gabigol" since his first spell at Santos; it is the
  // name on the back of his shirt and the one every broadcast uses.
  "1327": "Gabigol",
};
