/**
 * eval-highlight-judge.ts
 * -----------------------
 * Measure the TypeSafe prototype judge (`highlight-judge-core.ts`) against the
 * rules in use (`highlight-search-core.ts`), on cases whose right answer is
 * already known.
 *
 *   npx tsx scripts/eval-highlight-judge.ts --round 24 --dry-run   # titles + one request, no TypeSafe call
 *   npx tsx scripts/eval-highlight-judge.ts --round 24             # needs TYPESAFE_API_KEY
 *   npx tsx scripts/eval-highlight-judge.ts --limit 40             # the first 40 curated fixtures
 *
 * **Where the labels come from.** Every link in `src/data/highlights.ts` was
 * accepted for its fixture, so each one is a POSITIVE case against its own
 * fixture. Three NEGATIVES are built from the same video, so the titles are
 * real and only the claim changes:
 *   - reverse   the same clubs with home and away swapped, the near-miss the
 *               rules exist for;
 *   - other     a fixture of the same round sharing neither club;
 *   - copa      the title with its competition rewritten to "COPA DO BRASIL" —
 *               the one synthetic title, labelled as such in the report.
 *
 * **What this cannot measure, stated rather than hidden.** The positives are
 * links the RULES found, so any title shape the rules cannot parse is absent
 * from them by construction: a rescue the model would make cannot appear, and
 * the rules score perfect recall on their own picks. The upload date is not
 * read here, since both judges take it from the same code; a case "passes"
 * when it clears everything before the date.
 *
 * Titles come from YouTube's oEmbed (no key, the endpoint `check-hymns` uses)
 * and are cached under `.cache/`, gitignored, so a rerun costs only the model.
 * The key is read from `TYPESAFE_API_KEY` and never printed.
 *
 * Exit codes: 0 finished; 1 bad arguments, or no key without --dry-run.
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { assess, KNOWN_CHANNELS, type Candidate, type Fixture, type Verdict } from "@/highlight-search-core";
import { judgeRequest, judgeVerdict, parseJudgeAnswers } from "@/highlight-judge-core";
import { youtubeVideoId, youtubeWatchUrl } from "@/youtube-core";
import { HIGHLIGHTS } from "@/src/data/highlights";
import { SEED_MATCHES } from "@/src/data/matches";
import { CLUBS_BY_CODE } from "@/src/data/clubs";
import type { Match } from "@/src/types";
import { askSystemOne, typesafeKey } from "./typesafe-api";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const at = args.indexOf(name);
  return at === -1 ? undefined : args[at + 1];
};
const dryRun = args.includes("--dry-run");
const round = flag("--round") === undefined ? null : Number(flag("--round"));
const limit = flag("--limit") === undefined ? null : Number(flag("--limit"));

if (round !== null && (!Number.isInteger(round) || round < 1)) {
  console.error(`Error: --round must be a positive integer, got "${flag("--round")}"`);
  process.exit(1);
}
if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
  console.error(`Error: --limit must be a positive integer, got "${flag("--limit")}"`);
  process.exit(1);
}

const key = typesafeKey();
if (!key && !dryRun) {
  console.error("Error: TYPESAFE_API_KEY is not set. Put it in .env, or run with --dry-run.");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── titles ─────────────────────────────────────────────────────────────────
const CACHE = path.join(process.cwd(), ".cache", "highlight-titles.json");
const titles: Record<string, string> = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, "utf8")) : {};

const titleOf = async (videoId: string): Promise<string | null> => {
  if (titles[videoId]) return titles[videoId];
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeWatchUrl(videoId))}&format=json`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  await sleep(400);
  if (!response.ok) return null; // gone or private: not a case, not a failure
  const { title } = (await response.json()) as { title: string };
  titles[videoId] = title;
  return title;
};

// ── cases ──────────────────────────────────────────────────────────────────
type Kind = "positive" | "reverse" | "other" | "copa";
interface Case {
  kind: Kind;
  candidate: Candidate;
  fixture: Fixture;
}

const fixtureFor = (match: Match): Fixture | null => {
  const home = CLUBS_BY_CODE.get(match.homeCode);
  const away = CLUBS_BY_CODE.get(match.awayCode);
  return home && away ? { match, homeCodeName: home.shortName, awayCodeName: away.shortName } : null;
};

const reversed = (fixture: Fixture): Fixture => ({
  match: {
    ...fixture.match,
    homeCode: fixture.match.awayCode,
    awayCode: fixture.match.homeCode,
    homeGoals: fixture.match.awayGoals,
    awayGoals: fixture.match.homeGoals,
  },
  homeCodeName: fixture.awayCodeName,
  awayCodeName: fixture.homeCodeName,
});

const withCopa = (title: string): string =>
  /BRASILEIR[ÃA]O(\s+(S[ÉE]RIE\s+A|BETANO))?(\s+\d{4})?/i.test(title)
    ? title.replace(/BRASILEIR[ÃA]O(\s+(S[ÉE]RIE\s+A|BETANO))?(\s+\d{4})?/i, "COPA DO BRASIL")
    : `${title} | COPA DO BRASIL`;

const channelId = (label: string): string =>
  KNOWN_CHANNELS.find((channel) => channel.label === label)?.id ?? "";

const byId = new Map(SEED_MATCHES.map((match) => [match.id, match]));
const selected = Object.keys(HIGHLIGHTS)
  .map((id) => byId.get(id))
  .filter((match): match is Match => !!match && (round === null || match.round === round))
  .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id))
  .slice(0, limit ?? undefined);

if (selected.length === 0) {
  console.error("No curated fixture matches that selection.");
  process.exit(0);
}

const cases: Case[] = [];
let missingTitles = 0;
for (const match of selected) {
  const fixture = fixtureFor(match);
  if (!fixture) continue;
  const other = SEED_MATCHES.find(
    (m) =>
      m.round === match.round &&
      m.id !== match.id &&
      ![m.homeCode, m.awayCode].some((code) => code === match.homeCode || code === match.awayCode),
  );
  const otherFixture = other ? fixtureFor(other) : null;

  for (const link of HIGHLIGHTS[match.id] ?? []) {
    const videoId = youtubeVideoId(link.url);
    if (!videoId) continue;
    const title = await titleOf(videoId).catch(() => null);
    if (!title) {
      missingTitles += 1;
      continue;
    }
    const candidate: Candidate = { videoId, title, channelId: channelId(link.channel) };
    cases.push({ kind: "positive", candidate, fixture });
    if (fixture.match.homeCode !== fixture.match.awayCode) {
      cases.push({ kind: "reverse", candidate, fixture: reversed(fixture) });
    }
    if (otherFixture) cases.push({ kind: "other", candidate, fixture: otherFixture });
    cases.push({ kind: "copa", candidate: { ...candidate, title: withCopa(title) }, fixture });
  }
}

mkdirSync(path.dirname(CACHE), { recursive: true });
writeFileSync(CACHE, JSON.stringify(titles, null, 1));

console.log(
  `${selected.length} fixture(s), ${cases.length} case(s)` +
    (missingTitles ? `; ${missingTitles} video(s) skipped — oEmbed refused (gone or private)` : ""),
);

if (dryRun) {
  console.log("\n--dry-run: the request for the first case, and no call to TypeSafe:\n");
  console.log(JSON.stringify(judgeRequest(cases[0].candidate, cases[0].fixture), null, 2));
  process.exit(0);
}

// ── judge ──────────────────────────────────────────────────────────────────
/** A case "passes" when it clears everything short of the upload date, which
 *  both judges read from the same code and which is not fetched here. */
const passes = (verdict: Verdict): boolean =>
  verdict.status === "unconfirmed" && verdict.reason === "upload date not read yet";
const held = (verdict: Verdict): boolean => verdict.status === "unconfirmed" && !passes(verdict);

interface Row {
  kind: Kind;
  title: string;
  fixture: string;
  rules: Verdict;
  model: Verdict;
}

const rows: Row[] = [];
let inputTokens = 0;
let failures = 0;
const CONCURRENCY = 4;

for (let at = 0; at < cases.length; at += CONCURRENCY) {
  const batch = cases.slice(at, at + CONCURRENCY);
  const results = await Promise.all(
    batch.map(async (item) => {
      let answers = null;
      try {
        const response = await askSystemOne(judgeRequest(item.candidate, item.fixture), key!);
        inputTokens += response.usage?.input_tokens ?? 0;
        answers = parseJudgeAnswers(response.answers);
      } catch (error) {
        failures += 1;
        console.error(`! ${item.candidate.videoId} (${item.kind}): ${(error as Error).message}`);
      }
      return {
        kind: item.kind,
        title: item.candidate.title,
        fixture: `${item.fixture.homeCodeName} x ${item.fixture.awayCodeName}`,
        rules: assess(item.candidate, item.fixture),
        model: judgeVerdict(item.candidate, item.fixture, answers),
      };
    }),
  );
  rows.push(...results);
  process.stdout.write(`\r${rows.length}/${cases.length}`);
}
process.stdout.write("\n");

// ── report ─────────────────────────────────────────────────────────────────
const KINDS: Kind[] = ["positive", "reverse", "other", "copa"];
const tally = (judge: "rules" | "model", kind: Kind) => {
  const subset = rows.filter((row) => row.kind === kind);
  return {
    pass: subset.filter((row) => passes(row[judge])).length,
    held: subset.filter((row) => held(row[judge])).length,
    rejected: subset.filter((row) => row[judge].status === "rejected").length,
    total: subset.length,
  };
};

console.log("\nA positive should PASS; every other kind should be REJECTED. Held = sent to a person.\n");
console.log("kind       expected  | rules: pass held rej | model: pass held rej");
for (const kind of KINDS) {
  const r = tally("rules", kind);
  const m = tally("model", kind);
  const expected = kind === "positive" ? "pass" : "reject";
  const synthetic = kind === "copa" ? " (synthetic title)" : "";
  console.log(
    `${kind.padEnd(10)} ${expected.padEnd(9)} | ${String(r.pass).padStart(10)} ${String(r.held).padStart(4)} ${String(r.rejected).padStart(3)} | ${String(m.pass).padStart(11)} ${String(m.held).padStart(4)} ${String(m.rejected).padStart(3)}  of ${r.total}${synthetic}`,
  );
}

// The rows worth reading: the model wrong where a mistake publishes a link, or
// wrong where it throws a real one away, and every disagreement between judges.
const wrongPass = rows.filter((row) => row.kind !== "positive" && passes(row.model));
const wrongReject = rows.filter((row) => row.kind === "positive" && row.model.status === "rejected");
const disagree = rows.filter((row) => passes(row.rules) !== passes(row.model));

const show = (label: string, list: Row[]) => {
  if (!list.length) return;
  console.log(`\n${label} (${list.length}):`);
  for (const row of list.slice(0, 25)) {
    console.log(`  [${row.kind}] ${row.fixture} ← ${row.title.slice(0, 70)}`);
    console.log(`      rules: ${row.rules.status} — ${row.rules.reason}`);
    console.log(`      model: ${row.model.status} — ${row.model.reason}`);
  }
  if (list.length > 25) console.log(`  … and ${list.length - 25} more`);
};
show("MODEL PASSED A NEGATIVE — would publish a wrong link", wrongPass);
show("MODEL REJECTED A POSITIVE — would lose a right link", wrongReject);
show("Judges disagree", disagree.filter((row) => !wrongPass.includes(row) && !wrongReject.includes(row)));

// $0.042 per million input tokens, output free — docs.typesafe.ai/models.md, read 2026-09-29.
console.log(
  `\n${inputTokens} input tokens ≈ US$ ${((inputTokens / 1e6) * 0.042).toFixed(5)}` +
    (failures ? `; ${failures} request(s) failed and were counted as held` : ""),
);
