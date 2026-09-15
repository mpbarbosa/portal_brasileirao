/**
 * check-club-youtube.ts
 * ---------------------
 * Verify every club's YouTube channel in src/data/club-youtube.ts still opens
 * the channel it was written against.
 *
 * **Exact, like `check-club-discord` and unlike `check-club-twitter`**, and the
 * difference is a property of the host, measured 2026-09-15 without a session:
 * a handle nobody holds answers **404**, and a real one answers **200 with the
 * channel's own id in the page** (`"externalId":"UC…"`), beside its name and a
 * canonical `/channel/UC…` address. So the run compares the id the handle opens
 * against the id recorded, and catches what no name rule could: a channel that
 * changed its handle, leaving the old one for somebody else to claim.
 *
 * **A 200 alone proves nothing, and that is the trap.** An invented
 * `/channel/UC…` address also answers 200 — with no id, no name and no
 * canonical in it. A handle page that arrives without an id (a consent page, a
 * layout change) is therefore reported as inconclusive and fails the run, rather
 * than passing because the status looked right.
 *
 * Checked per club:
 *
 *   1. an entry exists, its handle survives `youtubeChannelHandle` unchanged and
 *      its channel is shaped like an id;
 *   2. `https://www.youtube.com/@<handle>` answers — a 404 means the handle is
 *      gone;
 *   3. the id that page states is the recorded channel.
 *
 * The channel's name is printed beside every row, passes included, because the
 * id says it is the same channel and only a person can say it is still the
 * club's.
 *
 * Usage:
 *   npx tsx scripts/check-club-youtube.ts
 *   npx tsx scripts/check-club-youtube.ts https://brasileirao.mpbarbosa.com
 *
 * Exit codes:
 *   0  every club's handle opens the channel recorded for it.
 *   1  at least one does not — the line says which and why.
 */
import { isYoutubeChannelId, youtubeChannelHandle, youtubeChannelUrl } from "@/youtube-core";
import { CLUB_YOUTUBE } from "@/src/data/club-youtube";
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
  return new Map(body.data.map((club) => [club.code, club.youtube]));
};

/** The id and name a channel page states about itself, or nulls where it does not. */
const readChannel = (html: string): { id: string | null; name: string | null } => ({
  id: /"externalId":"(UC[A-Za-z0-9_-]{22})"/.exec(html)?.[1] ?? null,
  name: /<meta property="og:title" content="([^"]*)"/.exec(html)?.[1] ?? null,
});

const check = async (club: Club, live: Map<string, string | undefined> | null): Promise<Row> => {
  const entry = CLUB_YOUTUBE[club.code];
  const problems: string[] = [];
  let name = "";

  if (!entry) {
    problems.push("no channel recorded");
  } else if (youtubeChannelHandle(entry.handle) !== entry.handle) {
    problems.push(`"${entry.handle}" is not a usable channel handle`);
  } else if (!isYoutubeChannelId(entry.channel)) {
    problems.push(`"${entry.channel}" is not a channel id`);
  } else {
    try {
      const response = await fetch(youtubeChannelUrl(entry.handle)!, {
        headers: { "Accept-Language": "pt-BR" },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 404) {
        problems.push("404 — no channel holds this handle any more");
      } else if (response.status !== 200) {
        problems.push(`HTTP ${response.status} — YouTube did not answer, so this run proves nothing about it`);
      } else {
        const page = readChannel(await response.text());
        name = page.name ?? "";
        if (!page.id) {
          problems.push("answered 200 with no channel id — a consent page or a layout change; inconclusive");
        } else if (page.id !== entry.channel) {
          problems.push(`opens channel ${page.id} ("${name}"), recorded as ${entry.channel}`);
        }
      }
    } catch (error) {
      problems.push((error as Error).message);
    }
  }

  if (live) {
    const there = live.get(club.code);
    if (there !== entry?.handle) {
      problems.push(`${appUrl} serves ${there ? `"${there}"` : "no channel"} — deploy is behind`);
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

// Sequential on purpose: a burst at a host that owes us nothing is how a check
// earns a rate limit, which this run would then report as twenty failures.
const rows: Row[] = [];
for (const club of clubs) rows.push(await check(club, live));

for (const row of rows) {
  const mark = row.problems.length ? "FAIL" : "ok  ";
  console.log(`${mark} ${row.club.shortName.padEnd(14)} ${(row.handle ? `@${row.handle}` : "—").padEnd(22)} ${row.name}`);
  for (const problem of row.problems) console.log(`       -> ${problem}`);
}

const failed = rows.filter((row) => row.problems.length);
console.log(`\n${rows.length - failed.length}/${rows.length} channels verified`);

if (failed.length) {
  console.log("The id check is exact; the name is for you to read — it says WHICH channel it is,");
  console.log("where the check only says it is the same one.");
  process.exit(1);
}
