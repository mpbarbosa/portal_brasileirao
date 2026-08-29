/**
 * Display names for the handful of players football-data reports under a broken
 * one. Hand-maintained and keyed by **player id**, like `player-instagram.ts`
 * and `player-wikipedia.ts` beside it.
 *
 * The id is what makes an entry safe to apply. A table keyed by name would
 * rename everybody who shares the string, and the division carries two Dudus at
 * one club — the same collision `comparePlayers` breaks ties on.
 *
 * **This is not a place to prefer one spelling of a name to another.** The
 * provider's name is what the app shows, nicknames and single names and all; an
 * entry here says the recorded value is *not a name at all* — a placeholder, a
 * duplicated surname, a test string somebody typed into a database and never
 * took out. Anything short of that is our taste against theirs, and theirs is
 * what every other football site shows the same reader.
 *
 * **`src/data/squads.ts` cannot carry the correction itself.** It is generated,
 * so `sync-seed-data` overwrites a hand-edit on its next run and says nothing;
 * overriding at serve time is what survives the regeneration. That is also why
 * `tests/player-core.test.ts` asserts every entry here still disagrees with the
 * squad list — the day upstream fixes a name, the seed regenerates and the
 * override becomes a silent no-op nobody would otherwise think to delete.
 *
 * Each entry records **what upstream serves** as well as what the player is
 * really called, because once the wrong string is off the page there is nothing
 * left to check the correction against.
 */
export const PLAYER_NAME_OVERRIDES: Record<string, string> = {
  // Upstream serves "Felipexxx": `firstName` empty, `lastName` "Felipe", and a
  // placeholder suffix on the composed name. Read from /v4/persons/249314 on
  // 2026-08-29, whose own `lastUpdated` is 2026-03-19 — so it is their standing
  // record rather than a stale snapshot of ours. Corinthians' fourth
  // goalkeeper, shirt 40, born 2005-03-05, which is the date pt.wikipedia gives
  // for "Felipe Longo" and the date `squads.ts` already carries for this id.
  "249314": "Felipe Longo",
};
