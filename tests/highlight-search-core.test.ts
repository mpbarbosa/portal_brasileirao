import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assess,
  bestPerChannel,
  namesClub,
  namesOtherCompetition,
  normalize,
  parseTitle,
  type Candidate,
  type Fixture,
} from "@/highlight-search-core";
import type { Match } from "@/src/types";

const GE = "UCgCKagVhzGnZcuP9bSMgMCg";
const CAZE = "UCZiYbVptd3PVPf4f6eR6UaQ";
const UOL = "UC3KHYFWeB0WimMBfm3NEahQ";

/** Internacional 0 x 0 Atlético-MG, rodada 24 — the fixture whose search
 *  results contain a same-score, same-order repeat from the previous season. */
const MATCH: Match = {
  id: "554976",
  round: 24,
  kickoff: "2026-08-22T21:30:00Z",
  status: "FINISHED",
  homeCode: "6684",
  awayCode: "1766",
  homeGoals: 0,
  awayGoals: 0,
};

const FIXTURE: Fixture = {
  match: MATCH,
  homeCodeName: "Internacional",
  awayCodeName: "Atlético-MG",
};

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  videoId: "4hGzHO6domw",
  title: "INTERNACIONAL 0 X 0 ATLÉTICO-MG | MELHORES MOMENTOS | 24ª RODADA | BRASILEIRÃO 2026",
  channelId: GE,
  uploadedAt: "2026-08-22T16:45:31-07:00",
  ...overrides,
});

test("accents, case and punctuation are not identity", () => {
  assert.equal(normalize("Atlético-MG"), "ATLETICOMG");
  assert.equal(normalize("SÃO PAULO"), "SAOPAULO");
  assert.equal(normalize("Grêmio"), "GREMIO");
});

test("the scoreline is read out of either channel's title shape", () => {
  const ge = parseTitle("INTERNACIONAL 0 X 0 ATLÉTICO-MG | MELHORES MOMENTOS | 24ª RODADA | BRASILEIRÃO 2026");
  const caze = parseTitle("MELHORES MOMENTOS: INTERNACIONAL 0 X 0 ATLÉTICO MINEIRO | BRASILEIRÃO 2026 | 24ª RODADA");

  for (const parsed of [ge, caze]) {
    assert.equal(parsed?.homeGoals, 0);
    assert.equal(parsed?.awayGoals, 0);
    assert.equal(parsed?.round, 24);
    assert.equal(parsed?.year, 2026);
  }
  // The CazéTV label must not be mistaken for the home club.
  assert.equal(normalize(caze?.home ?? ""), "INTERNACIONAL");
});

test("a title with no scoreline is not a highlights package", () => {
  assert.equal(parseTitle("Pré-jogo: Internacional x Atlético-MG ao vivo"), null);
  assert.equal(parseTitle(""), null);
});

test("a club is recognised through the spelling each channel uses", () => {
  assert.equal(namesClub("ATLÉTICO-MG", "1766", "Atlético-MG"), true);
  assert.equal(namesClub("ATLÉTICO MINEIRO", "1766", "Atlético-MG"), true);
  assert.equal(namesClub("REMO", "4287", "Clube do Remo"), true);
  assert.equal(namesClub("RED BULL BRAGANTINO", "4286", "Bragantino"), true);
});

test("clubs that look alike are kept apart", () => {
  // COR is both of these upstream, which is why club identity is the numeric id.
  assert.equal(namesClub("CORITIBA", "1779", "Corinthians"), false);
  assert.equal(namesClub("CORINTHIANS", "4241", "Coritiba"), false);
  // One letter apart, and both are real clubs.
  assert.equal(namesClub("ATHLETICO-PR", "1766", "Atlético-MG"), false);
  assert.equal(namesClub("ATLÉTICO-MG", "1768", "Athletico-PR"), false);
});

test("the rights-holder's own upload is accepted", () => {
  const verdict = assess(candidate(), FIXTURE);

  assert.equal(verdict.status, "accepted");
  assert.equal(verdict.channel, "ge tv");
  // Published right after the final whistle.
  assert.ok((verdict.hoursAfterKickoff ?? 0) > 2 && (verdict.hoursAfterKickoff ?? 0) < 3);
});

test("last season's identical fixture is rejected, not published", () => {
  // Same clubs, same 0-0, same order, same channel — a real result for this
  // search. Only the date and the stated round differ.
  const stale = candidate({
    videoId: "SmyPQqOtUCc",
    title: "INTERNACIONAL 0 X 0 ATLÉTICO-MG | MELHORES MOMENTOS | 31ª RODADA BRASILEIRÃO 2025",
    uploadedAt: "2025-11-02T16:55:08-08:00",
  });

  assert.equal(assess(stale, FIXTURE).status, "rejected");
});

test("a repeat with nothing but the date to give it away is still rejected", () => {
  // Strip the round and year that made the case easy: proximity to kickoff is
  // what has to carry the decision.
  const stale = candidate({
    title: "INTERNACIONAL 0 X 0 ATLÉTICO-MG | MELHORES MOMENTOS | BRASILEIRÃO",
    uploadedAt: "2025-11-02T16:55:08-08:00",
  });

  const verdict = assess(stale, FIXTURE);
  assert.equal(verdict.status, "rejected");
  assert.match(verdict.reason, /before kickoff/);
});

test("highlights cannot predate the match", () => {
  const preview = candidate({ uploadedAt: "2026-08-22T18:00:00Z" });

  const verdict = assess(preview, FIXTURE);
  assert.equal(verdict.status, "rejected");
  assert.match(verdict.reason, /before kickoff/);
});

test("a cup tie days later is rejected by its competition", () => {
  // The same two clubs can meet again inside the upload window, so date alone
  // would not separate them.
  const cup = candidate({
    title: "INTERNACIONAL 0 X 0 ATLÉTICO-MG | MELHORES MOMENTOS | COPA DO BRASIL",
    uploadedAt: "2026-08-24T23:00:00Z",
  });

  const verdict = assess(cup, FIXTURE);
  assert.equal(verdict.status, "rejected");
  assert.match(verdict.reason, /COPADOBRASIL/);
  assert.equal(namesOtherCompetition("… | LIBERTADORES 2026"), "LIBERTADORES");
});

test("a club named after a state competition is not mistaken for one", () => {
  // "ATLÉTICO MINEIRO" contains "MINEIRO", and "Corinthians Paulista" contains
  // "PAULISTA". Reading the raw title throws away every match these clubs play.
  const title = "MELHORES MOMENTOS: INTERNACIONAL 0 X 0 ATLÉTICO MINEIRO | BRASILEIRÃO 2026 | 24ª RODADA";

  assert.equal(namesOtherCompetition(title, parseTitle(title)), null);

  const caze = candidate({
    videoId: "lhEf7WoBd3k",
    title,
    channelId: CAZE,
    uploadedAt: "2026-08-23T00:20:00Z",
  });
  assert.equal(assess(caze, FIXTURE).status, "accepted");
});

test("the reverse fixture is named as such", () => {
  const reversed = candidate({
    title: "ATLÉTICO-MG 0 X 0 INTERNACIONAL | MELHORES MOMENTOS | 24ª RODADA | BRASILEIRÃO 2026",
  });

  assert.match(assess(reversed, FIXTURE).reason, /reverse fixture/);
});

test("a different scoreline is a different match", () => {
  const other = candidate({
    title: "INTERNACIONAL 1 X 2 ATLÉTICO-MG | MELHORES MOMENTOS | 24ª RODADA | BRASILEIRÃO 2026",
  });

  assert.match(assess(other, FIXTURE).reason, /score 1-2/);
});

test("a reupload is rejected however well it imitates the channel", () => {
  // Identical title, everything right except the one thing that is identity.
  assert.equal(assess(candidate({ channelId: "UCimpostor" }), FIXTURE).status, "rejected");
});

test("a candidate whose date is unread is held, never accepted", () => {
  // Everything visible on the search page passes. Accepting here is exactly how
  // last season's video gets published.
  const verdict = assess(candidate({ uploadedAt: undefined }), FIXTURE);

  assert.equal(verdict.status, "unconfirmed");
});

test("each channel contributes its closest upload, once", () => {
  const short = { ...candidate(), uploadedAt: "2026-08-23T02:00:00Z" };
  const prompt = { ...candidate(), videoId: "prompt", uploadedAt: "2026-08-22T23:45:00Z" };
  const caze = { ...candidate(), videoId: "caze", channelId: CAZE, uploadedAt: "2026-08-23T00:30:00Z" };

  const picked = bestPerChannel([short, prompt, caze].map((c) => assess(c, FIXTURE)));

  assert.deepEqual(
    picked.map((v) => [v.channel, v.candidate.videoId]),
    [
      ["ge tv", "prompt"],
      ["CazéTV", "caze"],
    ],
  );
});

test("links are ordered by preference, not by name", () => {
  // Alphabetical order would lead with CazéTV; the reader should meet ge tv
  // first, and UOL Esporte last.
  const uol = { ...candidate(), videoId: "uol", channelId: UOL, uploadedAt: "2026-08-23T00:10:00Z" };
  const caze = { ...candidate(), videoId: "caze", channelId: CAZE, uploadedAt: "2026-08-23T00:30:00Z" };

  const picked = bestPerChannel([uol, caze, candidate()].map((c) => assess(c, FIXTURE)));

  assert.deepEqual(
    picked.map((v) => v.channel),
    ["ge tv", "CazéTV", "UOL Esporte"],
  );
});

test("nothing accepted yields nothing, rather than a best guess", () => {
  assert.deepEqual(bestPerChannel([assess(candidate({ channelId: "x" }), FIXTURE)]), []);
});
