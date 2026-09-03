import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import {
  clubProfile,
  finishes,
  markerFraction,
  medianFraction,
  axisCaption,
  axisFigure,
  axisPhrase,
  profileScatter,
  quadrantLabel,
  quadrantParts,
  SCATTER_PAIRS,
  rankLabel,
  valueLabel,
} from "@/scouts-core";
import { lastRoundWithResult } from "@/rank-history-core";
import { SEED_MATCHES } from "@/src/data/matches";
import { CLUB_SCOUTS, CLUB_SCOUTS_THROUGH_ROUND } from "@/src/data/club-scouts";
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

  // Both axes of THIS pairing derive from `matches` alone, so one-null-and-one-
  // not is unreachable here and this case can only ever exercise both-null. The
  // case below is the one that reaches the `||`, and it exists because the
  // volume × conversão pairing gave `conversion` an absence of its own.
});

test("a club that has taken no shot is left off the conversão scatter, not plotted at zero", () => {
  // **The case the `||` in `profileScatter` was written for, unreachable until
  // a conversão axis existed.** This club has played, so `finishes` is a real
  // 0 rather than null — but `conversion` is 0/0, which is an absence and not a
  // 0%. Half-measured, so it is left off: a dot at a real x and an invented y
  // is worse than no dot, because nothing on the drawing says which half was
  // measured.
  const mute = scouts("EEE", { goals: 0, shotsSaved: 0, shotsOff: 0, shotsWoodwork: 0 });
  assert.equal(rawValue0(mute), 0, "finishes must be a real zero, or this tests nothing");

  const division = [...spread(), mute];
  const scatter = profileScatter(division, "AAA", SCATTER_PAIRS["volume-conversao"]);
  assert.equal(scatter?.points.length, 4);
  assert.equal(scatter?.points.some((point) => point.clubCode === "EEE"), false);
});

/** `finishes` per match, read the way the module does, for the guard above. */
function rawValue0(entry: ClubScouts): number {
  const [row] = clubProfile([entry], entry.clubCode);
  return row?.value ?? -1;
}

test("each pairing names its own corners, and never the other one's", () => {
  const division = spread();
  const jogo = profileScatter(division, "DDD", SCATTER_PAIRS["ataque-defesa"]);
  const volume = profileScatter(division, "DDD", SCATTER_PAIRS["volume-conversao"]);

  assert.equal(jogo?.pair, "ataque-defesa");
  assert.equal(volume?.pair, "volume-conversao");
  assert.match(quadrantLabel(jogo!), /goleiro/);
  assert.match(quadrantLabel(volume!), /converte/);
  // The failure this guards is a scatter carrying one pairing's points under
  // the other's vocabulary, which renders a complete, plausible caption about
  // the wrong axes.
  assert.doesNotMatch(quadrantLabel(volume!), /goleiro/);
});

test("the two pairings register vertically: every club sits at the same x", () => {
  // Not a coincidence to be preserved by luck. Both pairings take x from the
  // same metric over the same division, so `axis` pads it identically and a
  // reader can trace one club straight down from one drawing to the other.
  // Change either pairing's x and the two stop lining up — which looks like
  // nothing and quietly makes the stacked layout misleading.
  const division = spread();
  const a = profileScatter(division, "AAA", SCATTER_PAIRS["ataque-defesa"]);
  const b = profileScatter(division, "AAA", SCATTER_PAIRS["volume-conversao"]);
  assert.ok(a && b);
  assert.equal(a.x.id, b.x.id);

  const at = (scatter: typeof a, code: string) =>
    scatter!.points.find((point) => point.clubCode === code)?.atX;
  for (const code of ["AAA", "BBB", "CCC", "DDD"]) {
    assert.equal(at(a, code), at(b, code), `${code} sits at two different x`);
  }
});

test("each pairing carries its own name, and it is the glossary's", () => {
  // The names are `CONTEXT.md`'s. They existed before the page rendered either,
  // which is why the title lives on the pair rather than at the call site: a
  // second place to name a pairing is a second place for it to drift.
  const jogo = profileScatter(spread(), "AAA", SCATTER_PAIRS["ataque-defesa"]);
  const volume = profileScatter(spread(), "AAA", SCATTER_PAIRS["volume-conversao"]);
  assert.equal(jogo?.title, "Ataque × defesa");
  assert.equal(volume?.title, "Volume × conversão");
});

test("no two pairings share a title, and none is empty", () => {
  // Two drawings stacked under one heading, on the same x axis, are told apart
  // by their titles and by nothing else — so a repeated or absent one is worse
  // than no title at all.
  const titles = Object.values(SCATTER_PAIRS).map((pair) => pair.title);
  assert.equal(new Set(titles).size, titles.length);
  for (const title of titles) assert.ok(title.trim().length > 0);
});

test("every pairing offers four distinct corners, named and glossed", () => {
  for (const pair of Object.values(SCATTER_PAIRS)) {
    const phrases = Object.values(pair.corners);
    // Both halves, separately. A `Set` of the four *objects* has four members
    // whatever they contain, so the shape that replaced four strings here would
    // pass a distinctness check on the values and prove nothing — which is the
    // direction this file's own comments warn a test must never fail in.
    assert.equal(
      new Set(phrases.map((phrase) => phrase.term)).size,
      4,
      `${pair.id} repeats a term`,
    );
    assert.equal(
      new Set(phrases.map((phrase) => phrase.gloss)).size,
      4,
      `${pair.id} repeats a gloss`,
    );
    for (const phrase of phrases) {
      assert.ok(phrase.term.length > 0);
      assert.ok(phrase.gloss.length > 0);
      // The term is what the caption sets in the page's own ink, on one line.
      // A gloss that has crept into it is a sentence rendered as a heading.
      assert.doesNotMatch(phrase.term, /:/);
    }
  }
});

test("the corner's two halves are the label a screen reader hears", () => {
  // `quadrantLabel` composes from `quadrantParts` rather than comparing the
  // medians a second time, so the sentence in the drawing's `aria-label` and
  // the two pieces printed beside it cannot name different corners.
  //
  // Read what this does and does not hold: it catches a second comparison that
  // picks a *different* corner — a swapped `xOnly`/`yOnly`, a `>` where the
  // other says `>=` — for any club these fixtures place off a median. It
  // cannot catch a duplicate that happens to agree, which is why the
  // composition lives in the module rather than being asserted here.
  for (const code of ["AAA", "BBB", "CCC", "DDD"]) {
    const scatter = profileScatter(spread(), code);
    assert.ok(scatter);
    const parts = quadrantParts(scatter);
    assert.ok(parts);
    assert.equal(quadrantLabel(scatter), `${parts.term}: ${parts.gloss}`);
  }
});

test("a reading's number and its unit compose back into the phrase", () => {
  // The caption sets the figure and the unit at different weights, so it takes
  // them apart — and `axisPhrase` is built from the same two pieces. The
  // failure this refuses is the split drifting from the sentence: a caption
  // reading "3,1 defesas" beside a `<title>` reading "3,1 defesas do goleiro
  // por jogo", where the shorter one looks like a deliberate abbreviation.
  const scatter = profileScatter(spread(), "AAA", SCATTER_PAIRS["volume-conversao"]);
  assert.ok(scatter);

  for (const [axis, value] of [
    [scatter.x, 10.4],
    [scatter.y, 17.8],
  ] as const) {
    const { figure, noun } = axisFigure(axis, value);
    assert.equal(`${figure} ${noun}`, axisPhrase(axis, value));
    // The figure is the number alone: everything a caption renders quietly is
    // in `noun`, including the unit's own preposition.
    assert.doesNotMatch(figure, /[a-zç]/i);
    assert.ok(noun.length > 0);
  }

  // And the percentage axis still never says "por jogo" — the bug that reads
  // as a typo and is a claim about what the figure counts, now checkable on
  // the half a caption prints beside the number.
  assert.equal(axisFigure(scatter.y, 17.8).noun, "de conversão");
  assert.equal(axisFigure(scatter.x, 10.4).noun, "finalizações por jogo");
});

test("a percentage axis is never captioned 'por jogo'", () => {
  const scatter = profileScatter(spread(), "AAA", SCATTER_PAIRS["volume-conversao"]);
  assert.ok(scatter);
  // The bug this refuses reads as a typo and is a claim about what the figure
  // counts: "18% de conversão por jogo".
  assert.equal(axisCaption(scatter.x), "Finalizações por jogo");
  assert.equal(axisCaption(scatter.y), "Conversão");
  assert.match(axisPhrase(scatter.x, 10.4), /^10,4 finalizações por jogo$/);
  assert.match(axisPhrase(scatter.y, 17.8), /^18% de conversão$/);
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

test("the counters never reach further than the seed that measured them", () => {
  // The denominator comes from our own fixture list and the numerators from
  // caRtola, and the two advance on different schedules. Sync a round the seed
  // has not recorded and every rate divides by a round too few — measured at
  // 4.3%–4.5% per club by reproducing the mismatch one round earlier.
  //
  // `sync-cartola-scouts.ts` refuses at write time; this catches a file that
  // got past it, and it is the assertion that would have gone red rather than
  // the sync's own goals band, which moves the *reassuring* way under exactly
  // this fault (7.0% -> 3.1%, further inside its -2%..15%).
  const seedLastRound = lastRoundWithResult(SEED_MATCHES);
  assert.ok(seedLastRound !== null, "the seed holds no finished match");
  assert.ok(
    CLUB_SCOUTS_THROUGH_ROUND <= (seedLastRound ?? 0),
    `club-scouts covers rodada ${CLUB_SCOUTS_THROUGH_ROUND} but the seed ends at ${seedLastRound}`,
  );
});

test("each club's match count is the seed's own, at the round the counters cover", () => {
  // The other direction, and the one the gate above cannot see: the seed moves
  // on and nobody re-runs the sync. `rank-history.ts` states that rule in prose
  // for itself; this is the same rule with something behind it.
  //
  // Note it does NOT cover the sync-against-a-lagging-seed case, because there
  // both sides read the same lagging seed and agree with each other. That is
  // what the test above and the script's own refusal are for. Saying so here
  // because two data tests in one file read as belt and braces, and these two
  // catch opposite faults.
  for (const entry of CLUB_SCOUTS) {
    const played = SEED_MATCHES.filter(
      (match) =>
        match.round <= CLUB_SCOUTS_THROUGH_ROUND &&
        match.status === "FINISHED" &&
        match.homeGoals !== null &&
        match.awayGoals !== null &&
        (match.homeCode === entry.clubCode || match.awayCode === entry.clubCode),
    ).length;
    assert.equal(entry.matches, played, `${entry.clubCode} counts ${entry.matches}, seed says ${played}`);
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
