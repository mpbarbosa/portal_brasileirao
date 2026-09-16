/**
 * check-club-facebook.ts
 * ----------------------
 * Verify every club's Facebook page in src/data/club-facebook.ts still opens
 * the page it was written against.
 *
 * **Exact about identity, like `check-club-youtube` — and blind about absence,
 * which YouTube is not.** Both halves measured 2026-09-15 without a session:
 *
 * - A real username answers **200 with the page's own id in it**
 *   (`"userID":"…"`), beside its name and its canonical `og:url`. So the run
 *   compares the id against the one recorded, and that is not caution for its
 *   own sake: `facebook.com/flamengo` answers 200 with **a stranger's page**.
 * - A username nobody holds **also answers 200**, with no id and no name — the
 *   same bare shell Facebook serves a request it declines. A deleted page and a
 *   refused request therefore cannot be told apart, and both are reported as
 *   failures for a person to open, never as passes.
 *
 * **Do not give it a browser's User-Agent.** Facebook answered a Chrome
 * User-Agent with **400** for every page, real and invented alike, while curl's
 * and Node's own defaults got the page. Whether a GitHub-hosted runner is served
 * the same way was not measurable from a workstation; if the monthly run calls
 * every page inconclusive at once, suspect that before suspecting the data.
 *
 * Checked per club:
 *
 *   1. an entry exists, its username survives `facebookHandle` unchanged and its
 *      page id is shaped like one;
 *   2. `https://www.facebook.com/<username>/` answers 200 with a page in it;
 *   3. the id that page states is the recorded one;
 *   4. the page's own address spells the username as recorded — Facebook
 *      resolves a username case-insensitively, so a stale spelling still works
 *      and would otherwise never be noticed.
 *
 * The page's name is printed beside every row, passes included, because the id
 * says it is the same page and only a person can say it is still the club's.
 *
 * Usage:
 *   npx tsx scripts/check-club-facebook.ts
 *   npx tsx scripts/check-club-facebook.ts https://brasileirao.mpbarbosa.com
 *
 * Exit codes:
 *   0  every club's username opens the page recorded for it.
 *   1  at least one does not, or Facebook did not say — the line says which.
 */
import { facebookHandle, facebookUrl, isFacebookPageId } from "@/club-core";
import { CLUB_FACEBOOK } from "@/src/data/club-facebook";
import { CLUBS } from "@/src/data/clubs";
import type { Club } from "@/src/types";

const appUrl = process.argv[2];

interface Row {
  club: Club;
  handle: string | undefined;
  name: string;
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
  return new Map(body.data.map((club) => [club.code, club.facebook]));
};

/** Facebook writes non-ASCII in its meta tags as hex references (`Gr&#xea;mio`). */
const decode = (text: string): string =>
  text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&");

/** The id, username and name a page states about itself, or nulls where it does not. */
const readPage = (html: string): { id: string | null; handle: string | null; name: string | null } => {
  const title = /<meta property="og:title" content="([^"]*)"/.exec(html)?.[1];
  return {
    id: /"userID":"(\d+)"/.exec(html)?.[1] ?? null,
    handle: /<meta property="og:url" content="https:\/\/www\.facebook\.com\/([^"/?#]+)\/?"/.exec(html)?.[1] ?? null,
    name: title === undefined ? null : decode(title),
  };
};

const check = async (club: Club, live: Map<string, string | undefined> | null): Promise<Row> => {
  const entry = CLUB_FACEBOOK[club.code];
  const problems: string[] = [];
  let name = "";

  if (!entry) {
    problems.push("no page recorded");
  } else if (facebookHandle(entry.handle) !== entry.handle) {
    problems.push(`"${entry.handle}" is not a usable Facebook username`);
  } else if (!isFacebookPageId(entry.page)) {
    problems.push(`"${entry.page}" is not a page id`);
  } else {
    try {
      // No User-Agent of our own: a browser's is answered with 400. See above.
      const response = await fetch(facebookUrl(entry.handle)!, {
        headers: { "Accept-Language": "pt-BR" },
        signal: AbortSignal.timeout(25_000),
      });
      if (response.status !== 200) {
        problems.push(`HTTP ${response.status} — Facebook did not answer, so this run proves nothing about it`);
      } else {
        const page = readPage(await response.text());
        name = page.name ?? "";
        if (!page.id) {
          problems.push(
            "answered 200 with no page in it — a username nobody holds, or a request Facebook declined; open it",
          );
        } else if (page.id !== entry.page) {
          problems.push(`opens page ${page.id} ("${name}"), recorded as ${entry.page}`);
        } else if (page.handle && page.handle !== entry.handle) {
          problems.push(`the page now spells its address "${page.handle}"; re-spell the entry`);
        }
      }
    } catch (error) {
      problems.push((error as Error).message);
    }
  }

  if (live) {
    const there = live.get(club.code);
    if (there !== entry?.handle) {
      problems.push(`${appUrl} serves ${there ? `"${there}"` : "no page"} — deploy is behind`);
    }
  }

  return { club, handle: entry?.handle, name, problems };
};

let live: Map<string, string | undefined> | null;
try {
  live = await served();
} catch (error) {
  console.error(`Error: could not read ${appUrl}/api/clubs — ${(error as Error).message}`);
  process.exit(1);
}

const clubs = [...CLUBS].sort((a, b) => a.shortName.localeCompare(b.shortName, "pt-BR"));

// Sequential and spaced on purpose: a burst at a host that owes us nothing is
// how a check earns a refusal, which this run cannot tell from a missing page.
const rows: Row[] = [];
for (const club of clubs) {
  rows.push(await check(club, live));
  await new Promise((resolve) => setTimeout(resolve, 1_500));
}

for (const row of rows) {
  const mark = row.problems.length ? "FAIL" : "ok  ";
  console.log(`${mark} ${row.club.shortName.padEnd(14)} ${(row.handle ?? "—").padEnd(24)} ${row.name}`);
  for (const problem of row.problems) console.log(`       -> ${problem}`);
}

const failed = rows.filter((row) => row.problems.length);
console.log(`\n${rows.length - failed.length}/${rows.length} pages verified`);

if (failed.length) {
  console.log("The id check is exact; the name is for you to read — it says WHICH page it is,");
  console.log("where the check only says it is the same one.");
  process.exit(1);
}
