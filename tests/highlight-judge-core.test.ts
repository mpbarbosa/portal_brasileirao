import assert from "node:assert/strict";
import { test } from "node:test";

import type { Candidate, Fixture } from "@/highlight-search-core";
import {
  judgeRequest,
  judgeVerdict,
  parseJudgeAnswers,
  THRESHOLDS,
  type JudgeAnswers,
} from "@/highlight-judge-core";
import type { Match } from "@/src/types";

const GE = "UCgCKagVhzGnZcuP9bSMgMCg";

/** Palmeiras 4 x 1 Vasco, rodada 24 — a scoreline that is not a draw, so a
 *  reversed reading is distinguishable from a correct one. */
const MATCH: Match = {
  id: "554977",
  round: 24,
  kickoff: "2026-08-23T19:00:00Z",
  status: "FINISHED",
  homeCode: "1769",
  awayCode: "1780",
  homeGoals: 4,
  awayGoals: 1,
};
const FIXTURE: Fixture = { match: MATCH, homeCodeName: "Palmeiras", awayCodeName: "Vasco da Gama" };

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  videoId: "0ceAn6TLVtE",
  title: "PALMEIRAS 4 X 1 VASCO | MELHORES MOMENTOS | 24ª RODADA BRASILEIRÃO 2026",
  channelId: GE,
  uploadedAt: "2026-08-23T22:10:00-03:00",
  ...overrides,
});

const sure: JudgeAnswers = {
  highlights: { noul: 0.97 },
  fixture: { choice: "this_fixture", confidence: 0.95 },
  other_competition: { noul: 0.03 },
};
const answers = (overrides: Partial<JudgeAnswers> = {}): JudgeAnswers => ({ ...sure, ...overrides });

test("a confident reading inside the upload window is accepted", () => {
  const verdict = judgeVerdict(candidate(), FIXTURE, sure);
  assert.equal(verdict.status, "accepted");
});

test("the upload date still decides: last season's video is refused however sure the model is", () => {
  const verdict = judgeVerdict(candidate({ uploadedAt: "2025-08-24T22:10:00-03:00" }), FIXTURE, sure);
  assert.equal(verdict.status, "rejected");
});

// The case above is refused as "before kickoff" and never reaches the window,
// so it passed with the window check deleted. This one reaches it.
test("an upload after the window closes is refused", () => {
  const verdict = judgeVerdict(candidate({ uploadedAt: "2026-09-02T12:00:00Z" }), FIXTURE, sure);
  assert.equal(verdict.status, "rejected");
  assert.match(verdict.reason, /window is/);
});

test("without an upload date a clean reading is held, never accepted", () => {
  const verdict = judgeVerdict(candidate({ uploadedAt: undefined }), FIXTURE, sure);
  assert.equal(verdict.status, "unconfirmed");
  assert.equal(verdict.reason, "upload date not read yet");
});

test("an unknown channel is refused before the model's answer is read", () => {
  const verdict = judgeVerdict(candidate({ channelId: "UCsomebodyElse0000000000" }), FIXTURE, sure);
  assert.equal(verdict.status, "rejected");
});

test("a scoreline the title states is checked in code, not by the model", () => {
  const verdict = judgeVerdict(
    candidate({ title: "PALMEIRAS 2 X 1 VASCO | MELHORES MOMENTOS" }),
    FIXTURE,
    sure,
  );
  assert.equal(verdict.status, "rejected");
  assert.match(verdict.reason, /score 2-1/);
});

test("a round or season stated in the title is checked in code", () => {
  assert.equal(
    judgeVerdict(candidate({ title: "PALMEIRAS 4 X 1 VASCO | MELHORES MOMENTOS | 12ª RODADA" }), FIXTURE, sure)
      .status,
    "rejected",
  );
  assert.equal(
    judgeVerdict(candidate({ title: "PALMEIRAS 4 X 1 VASCO | MELHORES MOMENTOS | BRASILEIRÃO 2025" }), FIXTURE, sure)
      .status,
    "rejected",
  );
});

test("no answer from the model holds the candidate rather than accepting it", () => {
  assert.equal(judgeVerdict(candidate(), FIXTURE, null).status, "unconfirmed");
});

test("a confident reverse-fixture reading is refused", () => {
  const verdict = judgeVerdict(
    candidate({ title: "VASCO 1 X 4 PALMEIRAS | MELHORES MOMENTOS" }),
    FIXTURE,
    answers({ fixture: { choice: "reverse_fixture", confidence: 0.93 } }),
  );
  assert.equal(verdict.status, "rejected");
  assert.match(verdict.reason, /reverse fixture/);
});

test("a mirrored scoreline under an in-order club reading is held — the two disagree", () => {
  const verdict = judgeVerdict(candidate({ title: "PALMEIRAS 1 X 4 VASCO | MELHORES MOMENTOS" }), FIXTURE, sure);
  assert.equal(verdict.status, "unconfirmed");
});

test("another competition is refused when sure and held when merely possible", () => {
  const refused = judgeVerdict(
    candidate(),
    FIXTURE,
    answers({ other_competition: { noul: THRESHOLDS.otherCompetition } }),
  );
  assert.equal(refused.status, "rejected");

  const held = judgeVerdict(candidate(), FIXTURE, answers({ other_competition: { noul: 0.5 } }));
  assert.equal(held.status, "unconfirmed");
});

test("something that is plainly not a highlights package is refused", () => {
  const verdict = judgeVerdict(
    candidate({ title: "COLETIVA ABEL FERREIRA APÓS PALMEIRAS 4 X 1 VASCO" }),
    FIXTURE,
    answers({ highlights: { noul: 0.04 } }),
  );
  assert.equal(verdict.status, "rejected");
});

test("an unsure fixture reading is held for a person", () => {
  const verdict = judgeVerdict(
    candidate(),
    FIXTURE,
    answers({ fixture: { choice: "this_fixture", confidence: 0.55 } }),
  );
  assert.equal(verdict.status, "unconfirmed");
  assert.match(verdict.reason, /model unsure/);
});

test("a title with no scoreline is held even when the model is sure — the looser half, bounded", () => {
  const verdict = judgeVerdict(
    candidate({ title: "Os gols de Palmeiras e Vasco pelo Brasileirão" }),
    FIXTURE,
    sure,
  );
  assert.equal(verdict.status, "unconfirmed");
  assert.match(verdict.reason, /no scoreline/);
});

test("the request never shows the model the score, the kickoff or the video id", () => {
  const body = JSON.stringify(judgeRequest(candidate(), FIXTURE).state);
  assert.doesNotMatch(body, /homeGoals|awayGoals|kickoff|0ceAn6TLVtE/);
  const fixture = judgeRequest(candidate(), FIXTURE).state.fixture;
  assert.deepEqual(Object.keys(fixture).sort(), ["away", "competition", "home", "round", "season"]);
});

test("every question states its meaning in instructions, since ids never reach the model", () => {
  for (const question of Object.values(judgeRequest(candidate(), FIXTURE).questions)) {
    const { instructions } = question as { instructions: string };
    assert.ok(instructions.length > 40);
  }
});

test("parseJudgeAnswers refuses a payload it cannot read, field by field", () => {
  assert.equal(parseJudgeAnswers(null), null);
  assert.equal(parseJudgeAnswers({}), null);
  assert.equal(
    parseJudgeAnswers({
      highlights: { noul: 1.4 },
      fixture: { choice: "this_fixture", confidence: 0.9 },
      other_competition: { noul: 0 },
    }),
    null,
  );
  assert.equal(
    parseJudgeAnswers({
      highlights: { noul: 0.9 },
      fixture: { confidence: 0.9 },
      other_competition: { noul: 0 },
    }),
    null,
  );
  // Zero is a real probability, not an absence.
  assert.ok(
    parseJudgeAnswers({
      highlights: { noul: 0 },
      fixture: { choice: "different_match", confidence: 0 },
      other_competition: { noul: 0 },
    }),
  );
});
