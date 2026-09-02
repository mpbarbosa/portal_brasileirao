import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  clubProfile,
  finishes,
  markerFraction,
  medianFraction,
  profileScatter,
  quadrantLabel,
  rankLabel,
  valueLabel,
} from "@/scouts-core";
import { CLUB_SCOUTS } from "@/src/data/club-scouts";
import { CLUBS } from "@/src/data/clubs";
import type { ClubScouts } from "@/src/types";

const scouts = (clubCode: string, over: Partial<ClubScouts> = {}): ClubScouts => ({
  clubCode,
  matches: 10,
  goals: 10,
  shotsSaved: 20,
  shotsOff: 60,
  shotsWoodwork: 10,
  tackles: 100,
  foulsCommitted: 100,
  yellowCards: 20,
  redCards: 0,
  saves: 30,
  ...over,
});

test("a goal is a finalização, so conversão cannot exceed 100%", () => {
  // The trap this guards: the source stops counting a shot once it is a goal,
  // so a total of the three shot columns alone omits every goal — and a club
  // that scored more than it missed would convert above 100%.
  const entry = scouts("AAA", { goals: 8, shotsSaved: 1, shotsOff: 1, shotsWoodwork: 0 });
  assert.equal(finishes(entry), 10);

  const [, conversion] = clubProfile([entry], "AAA");
  assert.equal(conversion?.id, "conversion");
  assert.equal(conversion?.value, 80);
});

test("rates divide by the counters' own matches, never by a live played count", () => {
  const [finalizacoes] = clubProfile([scouts("AAA", { matches: 20 })], "AAA");
  // 100 finalizações over 20 matches, not over whatever the table says today.
  assert.equal(finalizacoes?.value, 5);
});

test("a club with no matches counted has no perfil at all", () => {
  assert.deepEqual(clubProfile([scouts("AAA", { matches: 0 })], "AAA"), []);
});

test("a club absent from the division has no perfil", () => {
  assert.deepEqual(clubProfile([scouts("AAA")], "ZZZ"), []);
});

test("a club that has taken no shot has no conversão, and keeps every other row", () => {
  // 0/0 is an absence rather than 0%, which would rank a club that has not shot
  // below one that has shot and missed.
  const entry = scouts("AAA", { goals: 0, shotsSaved: 0, shotsOff: 0, shotsWoodwork: 0 });
  const rows = clubProfile([entry], "AAA");
  assert.equal(rows.some((row) => row.id === "conversion"), false);
  assert.equal(rows.some((row) => row.id === "tackles"), true);
});

test("rank counts clubs strictly above, so a tie shares a place", () => {
  const division = [
    scouts("AAA", { tackles: 300 }),
    scouts("BBB", { tackles: 200 }),
    scouts("CCC", { tackles: 200 }),
    scouts("DDD", { tackles: 100 }),
  ];
  const rankOf = (code: string) =>
    clubProfile(division, code).find((row) => row.id === "tackles")?.rank;

  assert.equal(rankOf("AAA"), 1);
  assert.equal(rankOf("BBB"), 2);
  assert.equal(rankOf("CCC"), 2);
  // The place after a two-way tie is 4th, the way a league table reads one.
  assert.equal(rankOf("DDD"), 4);
});

test("a club yet to play is left out of the ranking rather than sorted last", () => {
  const division = [scouts("AAA"), scouts("BBB"), scouts("ZZZ", { matches: 0 })];
  const row = clubProfile(division, "AAA").find((entry) => entry.id === "tackles");
  assert.equal(row?.of, 2);
});

test("the marker runs from the division's floor to its ceiling, not from zero", () => {
  // The measured reason: from zero these values crowd the top of the track and
  // twenty clubs look alike. A marker is a position, so it owes no zero.
  const division = [
    scouts("AAA", { tackles: 100 }),
    scouts("BBB", { tackles: 150 }),
    scouts("CCC", { tackles: 200 }),
  ];
  const at = (code: string) =>
    markerFraction(clubProfile(division, code).find((row) => row.id === "tackles")!);

  assert.equal(at("AAA"), 0);
  assert.equal(at("BBB"), 0.5);
  assert.equal(at("CCC"), 1);
});

test("a division level on a metric puts every marker mid-track, claiming no leader", () => {
  const division = [scouts("AAA"), scouts("BBB")];
  const row = clubProfile(division, "AAA").find((entry) => entry.id === "tackles")!;
  assert.equal(markerFraction(row), 0.5);
  assert.equal(medianFraction(row), 0.5);
});

test("the median is the middle of an even division, not one of its halves", () => {
  const division = [
    scouts("AAA", { tackles: 100 }),
    scouts("BBB", { tackles: 200 }),
    scouts("CCC", { tackles: 300 }),
    scouts("DDD", { tackles: 400 }),
  ];
  const row = clubProfile(division, "AAA").find((entry) => entry.id === "tackles")!;
  // 10, 20, 30 and 40 per match, so the median is 25 rather than either middle
  // club's own 20 or 30 — and 25 is halfway from 10 to 40.
  assert.equal(row.median, 25);
  assert.equal(medianFraction(row), 0.5);
});

test("labels are pt-BR: a decimal comma for a rate, no decimal for a percentage", () => {
  const division = [scouts("AAA", { matches: 3, tackles: 40 })];
  const rows = clubProfile(division, "AAA");
  assert.equal(valueLabel(rows.find((row) => row.id === "tackles")!), "13,3");
  assert.equal(valueLabel(rows.find((row) => row.id === "conversion")!), "10%");
});

test("rankLabel names the division it ranked within", () => {
  const division = [scouts("AAA"), scouts("BBB"), scouts("CCC")];
  const row = clubProfile(division, "AAA").find((entry) => entry.id === "tackles")!;
  assert.equal(rankLabel(row), `${row.rank}º de 3`);
});

/* -------------------------------------------------- ataque × defesa ------- */

/** A division spread across both axes, so the medians fall somewhere useful. */
const spread = (): ClubScouts[] => [
  scouts("AAA", { shotsOff: 40, saves: 10 }),
  scouts("BBB", { shotsOff: 60, saves: 30 }),
  scouts("CCC", { shotsOff: 80, saves: 50 }),
  scouts("DDD", { shotsOff: 100, saves: 70 }),
];

test("exactly one point is the subject, and every club is plotted", () => {
  const scatter = profileScatter(spread(), "BBB");
  assert.equal(scatter?.points.length, 4);
  assert.equal(scatter?.points.filter((point) => point.subject).length, 1);
  assert.equal(scatter?.points.find((point) => point.subject)?.clubCode, "BBB");
});

test("a scatter of two clubs is not a scatter", () => {
  // A statement about a distribution needs one. Two dots and a median line is a
  // chart shaped like an argument nobody can make, so the section omits it and
  // keeps the strip.
  assert.equal(profileScatter([scouts("AAA"), scouts("BBB")], "AAA"), null);
});

test("a club absent from the division gets no scatter rather than an empty one", () => {
  assert.equal(profileScatter(spread(), "ZZZ"), null);
});

test("the domain is padded, so no club is drawn on the frame", () => {
  // Unpadded, the highest and lowest clubs land exactly on the edge and half of
  // each mark is painted outside the box — and a reader cannot tell "at the
  // edge of the division" from "clipped".
  const scatter = profileScatter(spread(), "AAA");
  for (const point of scatter?.points ?? []) {
    assert.ok(point.atX > 0 && point.atX < 1, `atX ${point.atX}`);
    assert.ok(point.atY > 0 && point.atY < 1, `atY ${point.atY}`);
  }
  // And the padding is real rather than incidental: the domain's ends sit
  // outside every club, not on the nearest one.
  const xs = (scatter?.points ?? []).map((point) => point.x);
  assert.ok((scatter?.x.min ?? 0) < Math.min(...xs));
  assert.ok((scatter?.x.max ?? 0) > Math.max(...xs));
});

test("a club with nothing measured is left off rather than plotted at zero", () => {
  const division = [...spread(), scouts("EEE", { matches: 0 })];
  const scatter = profileScatter(division, "AAA");
  assert.equal(scatter?.points.length, 4);
  assert.equal(scatter?.points.some((point) => point.clubCode === "EEE"), false);

  // **This does not cover the `||` in `profileScatter`, and saying so is the
  // point.** An earlier version of this case was named for "either axis
  // missing" and passed against a mutation that plotted a half-measured club,
  // because both of today's axes derive from `matches` alone — so one-null-and-
  // one-not is unreachable and the test could only ever exercise both-null.
  // The `||` stays because it stops being defensive the moment an axis is
  // `conversion`, which carries an absence of its own (no shot taken); it is
  // simply not something this suite can reach today. A vacuous assertion is
  // worse than a missing one, because it reads as cover.
});

test("the medians fall inside the padded domain", () => {
  const scatter = profileScatter(spread(), "AAA");
  assert.ok((scatter?.x.medianAt ?? 0) > 0 && (scatter?.x.medianAt ?? 1) < 1);
  assert.ok((scatter?.y.medianAt ?? 0) > 0 && (scatter?.y.medianAt ?? 1) < 1);
});

test("the quadrant is read off both medians, and names four different games", () => {
  const seen = new Set<string>();
  for (const code of ["AAA", "BBB", "CCC", "DDD"]) {
    const scatter = profileScatter(spread(), code);
    assert.ok(scatter);
    seen.add(quadrantLabel(scatter));
  }
  // This division runs both axes together, so it can only reach the two
  // diagonal corners — which is the point of asserting the count rather than
  // the words: a label that ignored one axis would collapse them.
  assert.equal(seen.size, 2);

  // One club moved off the diagonal reaches a third.
  const crossed = [
    scouts("AAA", { shotsOff: 40, saves: 10 }),
    scouts("BBB", { shotsOff: 60, saves: 30 }),
    scouts("CCC", { shotsOff: 80, saves: 50 }),
    scouts("DDD", { shotsOff: 100, saves: 5 }),
  ];
  const scatter = profileScatter(crossed, "DDD");
  assert.ok(scatter);
  assert.match(quadrantLabel(scatter), /finaliza muito e o goleiro trabalha pouco/);
});

test("the quadrant describes the game rather than appraising it", () => {
  // A verdict is what two rates cannot support. `_Avoid_` in CONTEXT.md says so
  // for the row labels; this is the same rule one drawing along.
  for (const code of ["AAA", "DDD"]) {
    const scatter = profileScatter(spread(), code);
    assert.ok(scatter);
    const label = quadrantLabel(scatter);
    assert.doesNotMatch(label, /melhor|pior|bom|ruim|fraco|forte/i);
  }
});

/* ------------------------------------------------------- the committed data */

test("every club in the division has counters, and they name real clubs", () => {
  // Asserting the *data*, the way `player-photos.test.ts` does: the compiler is
  // satisfied by an empty list, which renders as a Painel with no Perfil.
  assert.equal(CLUB_SCOUTS.length, CLUBS.length);

  const codes = new Set(CLUBS.map((club) => club.code));
  for (const entry of CLUB_SCOUTS) {
    assert.ok(codes.has(entry.clubCode), `${entry.clubCode} is not a club in this division`);
    assert.ok(entry.matches > 0, `${entry.clubCode} covers no match`);
  }
  assert.equal(new Set(CLUB_SCOUTS.map((entry) => entry.clubCode)).size, CLUBS.length);
});

test("every club's perfil renders six rows within footballing bounds", () => {
  // A band rather than a value, so this cannot go red on a routine sync: it
  // catches a column that has moved, which is the failure that writes numbers
  // instead of throwing.
  for (const club of CLUBS) {
    const rows = clubProfile(CLUB_SCOUTS, club.code);
    assert.equal(rows.length, 6, `${club.shortName} has ${rows.length} rows`);

    const value = (id: string) => rows.find((row) => row.id === id)?.value ?? NaN;
    assert.ok(value("finishes") > 3 && value("finishes") < 30, club.shortName);
    assert.ok(value("conversion") > 2 && value("conversion") < 40, club.shortName);
    assert.ok(value("tackles") > 3 && value("tackles") < 40, club.shortName);
    assert.ok(value("cards") > 0 && value("cards") < 10, club.shortName);
  }
});

test("each metric ranks all twenty clubs, and somebody is first", () => {
  for (const id of ["finishes", "conversion", "tackles", "fouls", "cards", "saves"]) {
    const ranks = CLUBS.map(
      (club) => clubProfile(CLUB_SCOUTS, club.code).find((row) => row.id === id)?.rank,
    );
    assert.equal(ranks.filter((rank) => rank === 1).length >= 1, true, `${id} has no leader`);
    for (const rank of ranks) {
      assert.ok(rank && rank >= 1 && rank <= CLUBS.length, `${id} rank ${rank} is out of range`);
    }
  }
});

test("every club in the division is on the scatter, and finds itself", () => {
  for (const club of CLUBS) {
    const scatter = profileScatter(CLUB_SCOUTS, club.code);
    assert.ok(scatter, `${club.shortName} has no scatter`);
    assert.equal(scatter.points.length, CLUBS.length, club.shortName);
    assert.equal(scatter.points.filter((point) => point.subject).length, 1, club.shortName);
    assert.ok(quadrantLabel(scatter).length > 0, club.shortName);
  }
});

/*
 * `docs/perfil-ataque.md` — the append-only log of editorial readings.
 *
 * Two rules are checked here and a third deliberately is not. **Freshness is
 * not a test**: "a sync landed with no fresh reading" would put a prose file in
 * front of a release (`test:unit` runs in `check`, and `deploy` needs it), and
 * its only remedy is for somebody to write a paragraph — so whoever met it
 * could satisfy it without being able to fix it, which is filler by design. The
 * reminder is printed by `sync-cartola-scouts.ts` instead, where it reaches the
 * person who has the rates in front of them.
 *
 * What survives is what a person can fix in the edit they just made.
 */
const LOG_PATH = path.join(import.meta.dirname, "..", "docs", "perfil-ataque.md");

/**
 * Read on call, never at module scope.
 *
 * A `readFileSync` evaluated at import takes the **whole file** down when the
 * document is missing or renamed — measured rather than reasoned: `pass 0`,
 * `fail 1`, with the reporter naming this test file rather than the document,
 * and every other case in this file — none of which has anything to do with the
 * log — vanishing with it. Lazily, the same absence fails these two and names
 * the document.
 *
 * **The count that stood here is deliberately gone rather than corrected.** It
 * was right when written and had a shelf life of one merge: two open PRs were
 * both adding cases to this very file, so whichever landed first would have made
 * it wrong with nothing going red. `pass 0` and `fail 1` stay because neither
 * can move — zero is zero, and one file is one file. That is `node:sqlite`'s shape in `openStore`: a static read at import
 * makes an absent dependency everyone's problem instead of the one caller's.
 *
 * Read twice rather than cached, because two reads of a small file are cheaper
 * than a cache that reintroduces the coupling it was written to remove.
 */
const perfilLog = (): string => {
  try {
    return readFileSync(LOG_PATH, "utf8");
  } catch (cause) {
    assert.fail(
      `docs/perfil-ataque.md could not be read (${String(cause)}). It is the ` +
        `append-only log of Perfil readings; if it was renamed, these two cases move ` +
        `with it. Only they depend on it — nothing else in this file does.`,
    );
  }
};

/** Every `## Rodada N` heading, in the order the file lists them. */
const logRounds = (log: string): number[] =>
  [...log.matchAll(/^## Rodada (\d+)\b/gm)].map((match) => Number(match[1]));

test("the perfil log is newest-first, and no rodada is written twice", () => {
  const rounds = logRounds(perfilLog());
  assert.ok(rounds.length > 0, "docs/perfil-ataque.md has no `## Rodada N` entry at all");

  // Strictly descending covers both halves at once: out-of-order and duplicate.
  // The failure this guards is not hypothetical — COORDINATION.md acquired two
  // insertion conventions the moment one session prepended wrongly, because
  // nothing there but prose asked for an order.
  for (let i = 1; i < rounds.length; i += 1) {
    assert.ok(
      (rounds[i] ?? 0) < (rounds[i - 1] ?? 0),
      `docs/perfil-ataque.md: rodada ${rounds[i]} is listed below rodada ${rounds[i - 1]}, ` +
        `so the file is no longer newest-first. Move your entry directly under the ` +
        `\`---\` that follows the rules, above every existing \`## Rodada\` heading.`,
    );
  }
});

test("the perfil log restates no figure the page already computes", () => {
  // Rule 1: this file names clubs and shapes; `scouts-core` states the figures.
  // A rate written into prose is frozen the moment the next sync runs, and it
  // would be a second, worse answer sitting beside the page's own.
  //
  // Scoped to the entries: the rules above them have to be able to quote a
  // shape without tripping their own gate.
  const log = perfilLog();
  const firstEntry = log.search(/^## Rodada \d+\b/m);
  assert.ok(firstEntry >= 0);
  const entries = log.slice(firstEntry);

  const banned: [RegExp, string][] = [
    [/\d+(?:[.,]\d+)?\s*%/, "a percentage"],
    [/\d+[.,]\d+/, "a decimal — a per-jogo rate"],
    [/\d+º/, "a rank, which `rankLabel` already renders"],
  ];

  for (const [pattern, what] of banned) {
    const hit = entries.match(pattern);
    assert.equal(
      hit,
      null,
      `docs/perfil-ataque.md quotes ${what} (${hit?.[0]}). The page computes it, so ` +
        `this file must not restate it — the next \`sync-cartola-scouts\` would make it ` +
        `wrong. Write the comparison instead: "finaliza mais que os dois líderes e ` +
        `converte pior que qualquer um deles".`,
    );
  }
});
