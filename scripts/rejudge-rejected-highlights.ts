/**
 * rejudge-rejected-highlights.ts
 * ------------------------------
 * Put the candidates `find-highlights.ts` REFUSED in front of the TypeSafe
 * prototype judge, to see whether it would rescue any — the question
 * `eval-highlight-judge.ts` cannot ask, since its positives are links the
 * rules already accepted.
 *
 *   npx tsx scripts/find-highlights.ts --round 24 --dump r24.json
 *   npx tsx scripts/rejudge-rejected-highlights.ts r24.json [r28.json ...]
 *
 * Only candidates from a known channel are sent: the channel is a fact code
 * owns, so an unknown one is refused by both judges without asking anybody.
 * A candidate the model clears up to the date gets its watch page read for
 * the exact upload instant, and is then judged in full — so an "accepted"
 * here has passed the same date window the rules apply.
 *
 * There is no ground truth for a refused candidate. The report marks the ones
 * `src/data/highlights.ts` already carries for that fixture (curated by hand
 * after the rules refused them), and lists the rest for a person to read.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";

import { KNOWN_CHANNELS, type Fixture, type Verdict } from "@/highlight-search-core";
import { judgeRequest, judgeVerdict, parseJudgeAnswers, type JudgeAnswers } from "@/highlight-judge-core";
import { youtubeVideoId, youtubeWatchUrl } from "@/youtube-core";
import { HIGHLIGHTS } from "@/src/data/highlights";
import { askSystemOne, typesafeKey } from "./typesafe-api";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: npx tsx scripts/rejudge-rejected-highlights.ts <dump.json>...");
  process.exit(1);
}
const key = typesafeKey();
if (!key) {
  console.error("Error: TYPESAFE_API_KEY is not set.");
  process.exit(1);
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const uploadedAt = async (videoId: string): Promise<string | undefined> => {
  const response = await fetch(youtubeWatchUrl(videoId), {
    headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" },
    signal: AbortSignal.timeout(25_000),
  });
  await sleep(1500);
  if (!response.ok) return undefined;
  return (await response.text()).match(/"uploadDate":"([^"]+)"/)?.[1];
};

const known = new Set(KNOWN_CHANNELS.map((channel) => channel.id));
const items = files.flatMap((file) =>
  (JSON.parse(readFileSync(file, "utf8")) as { fixture: Fixture; verdicts: Verdict[] }[]).flatMap(
    ({ fixture, verdicts }) =>
      verdicts
        .filter((v) => v.status === "rejected" && known.has(v.candidate.channelId))
        .map((rules) => ({ fixture, rules })),
  ),
);

const curated = (fixture: Fixture, videoId: string): boolean =>
  (HIGHLIGHTS[fixture.match.id] ?? []).some((link) => youtubeVideoId(link.url) === videoId);

console.log(`${items.length} refused candidate(s) from known channels`);
const started = Date.now();
let inputTokens = 0;
let calls = 0;
let failures = 0;

interface Row {
  fixture: Fixture;
  rules: Verdict;
  answers: JudgeAnswers | null;
  model: Verdict;
}
const rows: Row[] = [];
const CONCURRENCY = 4;

for (let at = 0; at < items.length; at += CONCURRENCY) {
  const batch = items.slice(at, at + CONCURRENCY);
  rows.push(
    ...(await Promise.all(
      batch.map(async ({ fixture, rules }) => {
        const candidate = { ...rules.candidate, uploadedAt: undefined };
        let answers = null;
        try {
          const response = await askSystemOne(judgeRequest(candidate, fixture), key);
          calls += 1;
          inputTokens += response.usage?.input_tokens ?? 0;
          answers = parseJudgeAnswers(response.answers);
        } catch (error) {
          failures += 1;
          console.error(`! ${candidate.videoId}: ${(error as Error).message}`);
        }
        return { fixture, rules, answers, model: judgeVerdict(candidate, fixture, answers) };
      }),
    )),
  );
  process.stdout.write(`\r${rows.length}/${items.length}`);
}
process.stdout.write("\n");
const modelSeconds = (Date.now() - started) / 1000;

// Only what the model cleared up to the date costs a page fetch, as in find-highlights.
for (const row of rows) {
  if (row.model.status !== "unconfirmed" || row.model.reason !== "upload date not read yet") continue;
  const at = await uploadedAt(row.rules.candidate.videoId).catch(() => undefined);
  row.model = judgeVerdict({ ...row.rules.candidate, uploadedAt: at }, row.fixture, row.answers);
}

const reasonKey = (reason: string) => reason.replace(/\([^)]*\)/, "").replace(/[0-9.]+/g, "#").trim();
const table = new Map<string, { accepted: number; held: number; rejected: number }>();
for (const row of rows) {
  const k = reasonKey(row.rules.reason);
  const entry = table.get(k) ?? { accepted: 0, held: 0, rejected: 0 };
  entry[row.model.status === "unconfirmed" ? "held" : row.model.status] += 1;
  table.set(k, entry);
}

console.log("\nrules refused because…                     | model: accepted held rejected");
for (const [k, v] of [...table].sort((a, b) => b[1].accepted + b[1].held - (a[1].accepted + a[1].held))) {
  console.log(`${k.slice(0, 44).padEnd(44)} | ${String(v.accepted).padStart(15)} ${String(v.held).padStart(4)} ${String(v.rejected).padStart(8)}`);
}

const show = (label: string, list: Row[]) => {
  if (!list.length) return;
  console.log(`\n${label} (${list.length}):`);
  for (const row of list) {
    const tag = curated(row.fixture, row.rules.candidate.videoId) ? " [JÁ CURADO À MÃO]" : "";
    const f = row.fixture;
    console.log(
      `  ${f.match.id} ${f.homeCodeName} ${f.match.homeGoals}x${f.match.awayGoals} ${f.awayCodeName} r${f.match.round} ← [${row.rules.channel}] ${row.rules.candidate.title}${tag}`,
    );
    console.log(`      rules: ${row.rules.reason}`);
    console.log(`      model: ${row.model.status} — ${row.model.reason}`);
  }
};
show("MODEL ACCEPTED what the rules refused", rows.filter((r) => r.model.status === "accepted"));
show("Held by the model (a person would look)", rows.filter((r) => r.model.status === "unconfirmed"));

console.log(
  `\n${calls} call(s), ${inputTokens} input tokens ≈ US$ ${((inputTokens / 1e6) * 0.042).toFixed(5)}, ` +
    `${modelSeconds.toFixed(1)}s of model time` +
    (failures ? `; ${failures} failed and were held` : ""),
);
