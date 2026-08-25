/**
 * find-highlights.ts
 * ------------------
 * Find the "Melhores momentos" video for a finished match and print the entry
 * for src/data/highlights.ts.
 *
 * Run by hand on a workstation, like the other sync scripts. Production never
 * calls YouTube: the page falls back to an honest search when a match has no
 * curated link, so this is a way to upgrade that fallback, never a runtime
 * dependency.
 *
 * Usage:
 *   npx tsx scripts/find-highlights.ts 554976              # one match
 *   npx tsx scripts/find-highlights.ts --round 24          # a whole round
 *   npx tsx scripts/find-highlights.ts --round 24 --write  # merge into the data file
 *   npx tsx scripts/find-highlights.ts 554976 --window 168  # widen the upload window
 *
 * --write only adds matches the file does not already carry, so hand-written
 * entries and their comments survive.
 *
 * The judgement lives in highlight-search-core.ts, which is unit-tested against
 * captured titles; this file only adds the network and the file writing.
 *
 * Exit codes:
 *   0  finished — including "found nothing", which is a normal outcome.
 *   1  bad arguments, or the fixtures could not be loaded.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  assess,
  DEFAULT_WINDOW_HOURS,
  bestPerChannel,
  KNOWN_CHANNELS,
  watchUrl,
  type Candidate,
  type Fixture,
  type Verdict,
} from "@/highlight-search-core";
import { hasHighlights } from "@/match-core";
import type { Club, Match } from "@/src/types";

const ROOT = process.cwd();
const SITE = process.env.PORTAL_URL ?? "https://brasileirao.mpbarbosa.com";
const DATA_FILE = path.join(ROOT, "src/data/highlights.ts");

// Without a browser user agent YouTube serves a stripped page with no results.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const args = process.argv.slice(2);
const write = args.includes("--write");
const roundFlag = args.indexOf("--round");
const round = roundFlag === -1 ? null : Number(args[roundFlag + 1]);
const windowFlag = args.indexOf("--window");
const windowHours =
  windowFlag === -1 ? DEFAULT_WINDOW_HOURS : Number(args[windowFlag + 1]);
const consumed = new Set([String(round), String(windowHours)]);
const ids = args.filter((arg) => /^\d+$/.test(arg) && !consumed.has(arg));

if (round !== null && (!Number.isInteger(round) || round < 1)) {
  console.error(`Error: --round must be a positive integer, got "${args[roundFlag + 1]}"`);
  process.exit(1);
}
if (!Number.isFinite(windowHours) || windowHours <= 0) {
  console.error(`Error: --window must be a positive number of hours, got "${args[windowFlag + 1]}"`);
  process.exit(1);
}
if (round === null && ids.length === 0) {
  console.error("Usage: npx tsx scripts/find-highlights.ts <match-id>... | --round <n> [--write]");
  process.exit(1);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Gap between requests. Unhurried on purpose: the backfill is a one-off, and
 *  going faster is what produces the redirect chains. */
const PACE_MS = 1500;

/**
 * Fetch with retries.
 *
 * A backfill makes a few thousand requests, so the rare failure is a certainty
 * rather than a risk: one run died on "redirect count exceeded" after two
 * fixtures and lost everything before it. Transient faults are retried with
 * backoff, and the caller decides what an exhausted retry means.
 */
const get = async (url: string, attempts = 5): Promise<string> => {
  let last: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9" },
        signal: AbortSignal.timeout(25_000),
      });
      // 4xx other than 429 will not improve on a retry.
      if (!response.ok && response.status !== 429 && response.status < 500) {
        throw new Error(`${response.status} ${response.statusText} for ${url}`);
      }
      if (response.ok) return await response.text();
      last = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      last = error;
      if (attempt === attempts) break;
    }
    // Backs off to ~45s in total. YouTube answers a burst by bouncing it
    // into a redirect chain until undici gives up, and that window outlasts a
    // few seconds of waiting — the fault is pace, not the request.
    await sleep(attempt * 3000);
  }

  throw last instanceof Error ? last : new Error(String(last));
};

/** YouTube ships the results as JSON inside the HTML; there is no free API and
 *  the data endpoint needs a key this project does not have. */
const searchYouTube = async (query: string): Promise<Candidate[]> => {
  const html = await get(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  );

  const blob = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!blob) return [];

  const found: Candidate[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    const video = record.videoRenderer as Record<string, any> | undefined;
    if (video?.videoId) {
      const title = (video.title?.runs ?? []).map((run: any) => run.text).join("");
      const owner = video.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
      if (title && owner) {
        found.push({ videoId: video.videoId, title, channelId: owner });
      }
    }
    Object.values(record).forEach(walk);
  };

  try {
    walk(JSON.parse(blob[1]));
  } catch {
    return [];
  }

  // The same video can appear more than once in a results page.
  const seen = new Set<string>();
  return found.filter((c) => !seen.has(c.videoId) && seen.add(c.videoId));
};

/** The exact instant, which the results page does not carry — it only says
 *  "há 2 dias", and two of these fixtures can both be "há 9 meses". */
const uploadedAt = async (videoId: string): Promise<string | undefined> => {
  const html = await get(watchUrl(videoId));
  return html.match(/"uploadDate":"([^"]+)"/)?.[1];
};

const loadSeason = async (): Promise<{ matches: Match[]; clubs: Club[] }> => {
  const body = await get(`${SITE}/api/matches`);
  const { data } = JSON.parse(body);
  return { matches: data.matches, clubs: data.clubs };
};

const label = (fixture: Fixture) =>
  `${fixture.homeCodeName} ${fixture.match.homeGoals} x ${fixture.match.awayGoals} ${fixture.awayCodeName}`;

const investigate = async (fixture: Fixture): Promise<Verdict[]> => {
  const { match } = fixture;
  const query = `${fixture.homeCodeName} x ${fixture.awayCodeName} melhores momentos Brasileirão`;

  const candidates = await searchYouTube(query);
  let verdicts = candidates.map((c) => assess(c, fixture, windowHours));

  // A channel missing from the general results usually just ranked below the
  // fold; ask for it by name before concluding it published nothing.
  for (const { label } of KNOWN_CHANNELS) {
    if (verdicts.some((v) => v.channel === label && v.status !== "rejected")) continue;

    await sleep(PACE_MS);
    const extra = await searchYouTube(`${query} ${label}`);
    const known = new Set(candidates.map((c) => c.videoId));
    verdicts = verdicts.concat(
      extra.filter((c) => !known.has(c.videoId)).map((c) => assess(c, fixture, windowHours)),
    );
  }

  // Only the shortlist costs a page fetch: everything checkable from the
  // results page has already been checked.
  const shortlist = verdicts.filter((v) => v.status === "unconfirmed");
  const confirmed = new Map<string, Verdict>();
  for (const verdict of shortlist) {
    await sleep(PACE_MS);
    const at = await uploadedAt(verdict.candidate.videoId).catch(() => undefined);
    confirmed.set(
      verdict.candidate.videoId,
      assess({ ...verdict.candidate, uploadedAt: at }, fixture, windowHours),
    );
  }

  const final = verdicts.map((v) => confirmed.get(v.candidate.videoId) ?? v);

  console.log(`\n${label(fixture)} — rodada ${match.round}, ${match.kickoff}`);
  for (const verdict of final) {
    const mark = verdict.status === "accepted" ? "✓" : "·";
    const who = verdict.channel ?? "—";
    console.log(`  ${mark} [${who}] ${verdict.candidate.title.slice(0, 62)}`);
    console.log(`      ${verdict.reason}`);
  }

  const picked = bestPerChannel(final);
  if (picked.length === 0) console.log("  → nothing accepted; the page keeps its search fallback");

  return picked;
};

const entryFor = (fixture: Fixture, picked: Verdict[]): string =>
  [
    `  // ${label(fixture)}, rodada ${fixture.match.round}.`,
    `  "${fixture.match.id}": [`,
    ...picked.map(
      (v) => `    { url: "${watchUrl(v.candidate.videoId)}", channel: "${v.channel}" },`,
    ),
    `  ],`,
  ].join("\n");

const { matches, clubs } = await loadSeason().catch((error) => {
  console.error(`Error: could not load fixtures from ${SITE} — ${(error as Error).message}`);
  process.exit(1);
});

const byCode = new Map(clubs.map((club) => [club.code, club]));
const wanted = matches.filter((match) =>
  round !== null ? match.round === round : ids.includes(match.id),
);

const missing = ids.filter((id) => !wanted.some((m) => m.id === id));
if (missing.length) console.error(`Warning: no such match: ${missing.join(", ")}`);

const playable = wanted.filter(hasHighlights);
const skipped = wanted.length - playable.length;
if (skipped) console.log(`Skipping ${skipped} fixture(s) that have not finished.`);

const entries: string[] = [];
const failed: string[] = [];
for (const match of playable) {
  const home = byCode.get(match.homeCode);
  const away = byCode.get(match.awayCode);
  if (!home || !away) {
    console.error(`Warning: unknown club on match ${match.id}; skipping`);
    continue;
  }

  const fixture: Fixture = {
    match,
    homeCodeName: home.shortName,
    awayCodeName: away.shortName,
  };

  try {
    const picked = await investigate(fixture);
    if (picked.length) entries.push(entryFor(fixture, picked));
  } catch (error) {
    // One fixture's bad luck is not the run's. Name it loudly so it can be
    // retried on its own rather than silently missing from the season.
    failed.push(match.id);
    // undici wraps the real reason in `cause`, and the message alone is always
    // the useless "fetch failed" — which cost a diagnosis once already.
    const cause = (error as { cause?: { message?: string } }).cause?.message;
    console.error(
      `\n! ${label(fixture)} — ${(error as Error).message}${cause ? ` (${cause})` : ""}`,
    );
  }

  await sleep(PACE_MS);
}

console.log(`\n${"=".repeat(60)}`);
if (failed.length) {
  console.log(`${failed.length} fixture(s) failed and were skipped. Retry with:`);
  console.log(`  npx tsx scripts/find-highlights.ts ${failed.join(" ")}\n`);
}
if (entries.length === 0) {
  console.log("No entries found.");
  process.exit(0);
}

if (!write) {
  console.log("Add to src/data/highlights.ts:\n");
  console.log(entries.join("\n"));
  console.log("\nRe-run with --write to merge these in.");
  process.exit(0);
}

const source = readFileSync(DATA_FILE, "utf8");
const fresh = entries.filter((entry) => {
  const id = entry.match(/"(\d+)": \[/)?.[1];
  if (id && new RegExp(`"${id}":\\s*\\[`).test(source)) {
    console.log(`Keeping the existing entry for ${id}; --write never overwrites one.`);
    return false;
  }
  return true;
});

if (fresh.length === 0) {
  console.log("Nothing new to write.");
  process.exit(0);
}

// Splice in before the closing brace rather than regenerating the file: it is
// hand-maintained, and its comments are worth more than tidy ordering.
const close = source.lastIndexOf("};");
writeFileSync(DATA_FILE, `${source.slice(0, close)}${fresh.join("\n")}\n${source.slice(close)}`);
console.log(`Wrote ${fresh.length} entr${fresh.length === 1 ? "y" : "ies"} to src/data/highlights.ts`);
