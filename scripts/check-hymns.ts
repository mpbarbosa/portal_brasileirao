/**
 * check-hymns.ts
 * --------------
 * Verify every club's hymn link in src/data/club-hymns.ts still points at that
 * club's hymn.
 *
 * A curated link is a claim about somebody else's server, and nothing in the
 * build can tell when it stops being true: a video goes private, an id is
 * mistyped into another valid id, an upload is pulled. The page keeps rendering
 * a link that looks exactly as it did the day it was written.
 *
 * So this asks YouTube directly, through the oEmbed endpoint, which answers
 * with the title and the uploading channel for a public video and 4xx for one
 * that is gone. Three things are checked per club:
 *
 *   1. the stored value is a usable id — `hymnUrl` accepts it;
 *   2. the video resolves — a 401/403/404 here means it has been pulled;
 *   3. the title names *this* club, and says hino.
 *
 * The third is the one that catches the failure worth catching. Every id in the
 * file was picked from a search, and a search for a club's hymn returns near
 * misses that a URL cannot distinguish — the hymn of the *city* of Santos among
 * the club's, an older hymn a club replaced, another club's hymn entirely. That
 * check is deliberately loose: a title match cannot prove the recording is the
 * right one, so this narrows what a human has to read rather than replacing
 * them. The whole table is printed, passes included, for exactly that reason.
 *
 * The expected word is derived from the club's registered name rather than
 * listed here, so a club entering the division needs no edit to this file. It
 * is the longest word of `name` once abbreviations are dropped — "paranaense",
 * "mineiro", "corinthians" — which is the part of a name a video title carries
 * and the part that separates the two Atléticos.
 *
 * Runs against no local server and costs nothing from the football-data budget:
 * YouTube is the only host it talks to. Pass an app URL to also check what a
 * running deployment serves, which catches a hymn edited on disk but not yet
 * shipped:
 *
 * Usage:
 *   npx tsx scripts/check-hymns.ts
 *   npx tsx scripts/check-hymns.ts https://brasileirao.mpbarbosa.com
 *
 * Exit codes:
 *   0  every club's hymn resolves and names the club.
 *   1  at least one does not — the line says which and why.
 */
import { hymnUrl } from "@/club-core";
import { CLUB_HYMNS } from "@/src/data/club-hymns";
import { CLUBS } from "@/src/data/clubs";
import type { Club } from "@/src/types";

const appUrl = process.argv[2];

/** Accents off, case off. Titles spell "Atlético" both ways, and one of them
 *  would otherwise read as a missing club. */
const fold = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Club-name noise: legal forms and the prepositions between them. Dropping
 * these is what leaves "paranaense" standing in "CA Paranaense" rather than
 * "ca", and "remo" in "Clube do Remo".
 */
const NOISE = new Set([
  "ac", "af", "ca", "cr", "ec", "fbc", "fbpa", "fc", "fr", "rb", "sc", "se",
  "clube", "club", "esporte", "esportiva", "futebol", "foot", "ball",
  "sociedade", "associacao", "regatas", "atletico", "athletico",
  "da", "de", "do", "das", "dos", "e",
]);

/**
 * The word a video title must carry to be this club's.
 *
 * "Atlético" is noise here even though it is half of two clubs' names, and
 * that is the point: it is the half they share. What tells CA Mineiro from
 * CA Paranaense is the other word, so the shared one cannot be the evidence.
 */
const distinctiveWord = (club: Club): string =>
  fold(club.name)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1 && !NOISE.has(word))
    .sort((a, b) => b.length - a.length)[0] ?? fold(club.shortName);

interface Row {
  club: Club;
  id: string | undefined;
  title: string;
  channel: string;
  problems: string[];
}

const oembed = async (url: string): Promise<{ title: string; author_name: string }> => {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`oEmbed answered ${response.status} — video gone or private`);

  return response.json() as Promise<{ title: string; author_name: string }>;
};

/** What a deployment currently serves, keyed by club code. Absent when no URL
 *  was passed, which is the ordinary case. */
const served = async (): Promise<Map<string, string | undefined> | null> => {
  if (!appUrl) return null;

  const response = await fetch(new URL("/api/clubs", appUrl), {
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${response.status} from ${appUrl}/api/clubs`);

  const body = (await response.json()) as { data: Club[] };
  return new Map(body.data.map((club) => [club.code, club.hymn]));
};

const check = async (club: Club, live: Map<string, string | undefined> | null): Promise<Row> => {
  const id = CLUB_HYMNS[club.code];
  const url = hymnUrl(id);
  const problems: string[] = [];
  let title = "";
  let channel = "";

  if (!url) {
    problems.push(id ? `"${id}" is not a usable video id` : "no hymn recorded");
  } else {
    try {
      const meta = await oembed(url);
      title = meta.title;
      channel = meta.author_name;

      const word = distinctiveWord(club);
      if (!fold(title).includes(word)) problems.push(`title does not say "${word}"`);
      if (!/hino|hymno/.test(fold(title))) problems.push("title does not say hino");
    } catch (error) {
      problems.push((error as Error).message);
    }
  }

  if (live) {
    const there = live.get(club.code);
    if (there !== id) {
      problems.push(`${appUrl} serves ${there ? `"${there}"` : "no hymn"} — deploy is behind`);
    }
  }

  return { club, id, title, channel, problems };
};

let live: Map<string, string | undefined> | null;
try {
  live = await served();
} catch (error) {
  console.error(`Error: could not read ${appUrl}/api/clubs — ${(error as Error).message}`);
  process.exit(1);
}

// Sequential on purpose. Twenty requests take a few seconds, and a burst of
// twenty at a host that owes us nothing is how a check earns a rate limit.
const rows: Row[] = [];
for (const club of [...CLUBS].sort((a, b) => a.shortName.localeCompare(b.shortName, "pt-BR"))) {
  rows.push(await check(club, live));
}

for (const row of rows) {
  const mark = row.problems.length ? "FAIL" : "ok  ";
  const meta = row.title ? `${row.title} | ${row.channel}` : "";
  console.log(`${mark} ${row.club.shortName.padEnd(14)} ${(row.id ?? "—").padEnd(12)} ${meta}`);
  for (const problem of row.problems) console.log(`       -> ${problem}`);
}

const failed = rows.filter((row) => row.problems.length);
console.log(`\n${rows.length - failed.length}/${rows.length} hymns verified`);

if (failed.length) {
  console.log("Read the titles above before editing: a title match is evidence, not proof.");
  process.exit(1);
}
