/**
 * check-club-twitter.ts
 * ---------------------
 * Verify every club's X handle in src/data/club-twitter.ts still names an
 * account.
 *
 * **Existence, not identity — and the difference is the whole of what a reader
 * should take from a green run.** X answers a profile address with **200** when
 * the account exists and **404** when it does not, measured 2026-09-15 without
 * a session and without a browser user agent. That is more than Instagram gives,
 * whose shell is byte-identical for a real handle and an invented one, and it is
 * why this file exists where `check-player-instagram` deliberately does not.
 *
 * It is less than Discord gives, and `check-club-discord` is exact where this is
 * not: the 200 page carries no title, no Open Graph tags and not even the handle
 * in the served bytes, so nothing here can read *whose* account answered. A
 * handle a club abandons and somebody else registers answers 200 exactly as the
 * club's did. What the run catches is an account deleted or renamed out from
 * under the link — the rot that happens without anybody editing this
 * repository. **A suspended account is not caught**: `x.com/Chapecoense` read
 * "Conta suspensa" in a browser and answered 200 to a script, measured
 * 2026-09-15. Its page is about a seventh the size of a live profile's, and a
 * byte count is a guess this checker declines to make.
 *
 * Two things per club:
 *
 *   1. the stored value is a usable handle — `twitterHandle` accepts it, which
 *      also refuses X's own app paths (`home`, `search`, `i`…), each of which
 *      answers 200 and would otherwise pass check 2;
 *   2. `https://x.com/<handle>` answers 200. A 404 is a definite failure; any
 *      other status is reported as inconclusive, and still fails the run,
 *      because a checker that goes quiet when the host refuses to answer is one
 *      nobody can tell from a checker that passed.
 *
 * Pass an app URL to also check what a running deployment serves:
 *
 * Usage:
 *   npx tsx scripts/check-club-twitter.ts
 *   npx tsx scripts/check-club-twitter.ts https://brasileirao.mpbarbosa.com
 *
 * Exit codes:
 *   0  every club has a handle and every handle names an existing account.
 *   1  at least one does not — the line says which and why.
 */
import { twitterHandle, twitterUrl } from "@/club-core";
import { CLUB_TWITTER } from "@/src/data/club-twitter";
import { CLUBS } from "@/src/data/clubs";
import type { Club } from "@/src/types";

const appUrl = process.argv[2];

interface Row {
  club: Club;
  handle: string | undefined;
  problems: string[];
}

/** What a deployment currently serves, keyed by club code. Absent when no URL
 *  was passed, which is the ordinary case. */
const served = async (): Promise<Map<string, string | undefined> | null> => {
  if (!appUrl) return null;

  const response = await fetch(new URL("/api/clubs", appUrl), {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${response.status} from ${appUrl}/api/clubs`);

  const body = (await response.json()) as { data: Club[] };
  return new Map(body.data.map((club) => [club.code, club.twitter]));
};

const check = async (club: Club, live: Map<string, string | undefined> | null): Promise<Row> => {
  const stored = CLUB_TWITTER[club.code];
  const problems: string[] = [];
  const url = twitterUrl(stored);

  if (!stored) {
    problems.push("no handle recorded");
  } else if (!url) {
    problems.push(`"${stored}" is not a usable X handle`);
  } else {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (response.status === 404) {
        problems.push("404 — no account by this handle: deleted or renamed");
      } else if (response.status !== 200) {
        problems.push(`HTTP ${response.status} — X did not answer, so this run proves nothing about it`);
      }
    } catch (error) {
      problems.push((error as Error).message);
    }
  }

  if (live) {
    const there = live.get(club.code);
    if (there !== stored) {
      problems.push(`${appUrl} serves ${there ? `"${there}"` : "no handle"} — deploy is behind`);
    }
  }

  return { club, handle: stored, problems };
};

let live: Map<string, string | undefined> | null;
try {
  live = await served();
} catch (error) {
  console.error(`Error: could not read ${appUrl}/api/clubs — ${(error as Error).message}`);
  process.exit(1);
}

const clubs = [...CLUBS].sort((a, b) => a.shortName.localeCompare(b.shortName, "pt-BR"));

// Sequential on purpose: a burst at a host that owes us nothing is how a check
// earns a rate limit, which this run would then report as twenty failures.
const rows: Row[] = [];
for (const club of clubs) rows.push(await check(club, live));

for (const row of rows) {
  const mark = row.problems.length ? "FAIL" : "ok  ";
  const shown = twitterHandle(row.handle);
  console.log(`${mark} ${row.club.shortName.padEnd(14)} ${shown ? `@${shown}` : "—"}`);
  for (const problem of row.problems) console.log(`       -> ${problem}`);
}

const failed = rows.filter((row) => row.problems.length);
console.log(`\n${rows.length - failed.length}/${rows.length} handles name an existing account`);
console.log("An existing account is not proof it is the club's — open the profile to know that.");

if (failed.length) process.exit(1);
