/**
 * check-club-discord.ts
 * ---------------------
 * Verify every club's Discord invite in src/data/club-discord.ts still opens
 * that club's server.
 *
 * A curated link is a claim about somebody else's host, and nothing in the
 * build can tell when it stops being true. An invite is the worst of them for
 * that: Discord's default is **7 days and one use**, so an invite copied
 * without editing those two fields is dead by the time most readers arrive,
 * and the page goes on rendering a link that looks exactly as it did the day
 * it was written. That is this file's whole reason to exist — the rot here is
 * scheduled rather than accidental.
 *
 * So it asks Discord directly, through the invite endpoint, which answers
 * unauthenticated with the guild behind a live code and `Unknown Invite` for
 * one that has expired or never existed. Four things are checked per club:
 *
 *   1. the stored value is a usable code — `discordUrl` accepts it;
 *   2. the invite resolves — `Unknown Invite` here means expired or revoked;
 *   3. it does not carry an expiry — a dated invite is a dated link;
 *   4. the guild's name names *this* club.
 *
 * The fourth is the one worth having, and it is deliberately loose. An invite
 * code is minted rather than derived, so nothing about the string says which
 * server it opens — a code pasted into the wrong club's row is invisible in
 * review and renders a working link on both pages, which is exactly the
 * failure `no two clubs share an article` guards one file over. A name match
 * narrows what a person has to read rather than replacing them, so the whole
 * table is printed, passes included.
 *
 * **This checker can exist because the value is an invite, and could not if it
 * were a guild id.** Measured 2026-09-09: `widget.json` answers 403 unless the
 * server opted in, `/v10/guilds/<id>/preview` answers 401, and
 * `discord.com/channels/<id>/@home` answers 200 with `<title>Discord</title>`
 * for a real id and for invented ones alike. That is the Instagram trap
 * `src/data/player-instagram.ts` records, and it is why that file has no
 * checker and this one does.
 *
 * Runs against no local server and costs nothing from the football-data
 * budget: Discord is the only host it talks to. Pass an app URL to also check
 * what a running deployment serves, which catches an invite edited on disk but
 * not yet shipped:
 *
 * Usage:
 *   npx tsx scripts/check-club-discord.ts
 *   npx tsx scripts/check-club-discord.ts https://brasileirao.mpbarbosa.com
 *
 * Exit codes:
 *   0  every recorded invite resolves and names its club.
 *   1  at least one does not — the line says which and why.
 */
import { discordInvite } from "@/club-core";
import { CLUB_DISCORD } from "@/src/data/club-discord";
import { CLUBS } from "@/src/data/clubs";
import type { Club } from "@/src/types";

const appUrl = process.argv[2];

/** Accents off, case off. A server names itself "Naçao" and "Nacao" by turns,
 *  and one of them would otherwise read as the wrong club. */
const fold = (value: string): string =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * The words that would identify this club in a server's name. A supporters'
 * server is named by supporters, so it may be "Nação Rubro-Negra" rather than
 * "Flamengo" — the short name and the nickname-bearing words of the registered
 * name are what a match can plausibly be found in.
 */
const clubWords = (club: Club): string[] =>
  [...new Set([...fold(club.shortName).split(/[^a-z0-9]+/), ...fold(club.name).split(/[^a-z0-9]+/)])]
    .filter((word) => word.length > 3);

interface InviteMeta {
  guild?: { name?: string };
  expires_at?: string | null;
  approximate_member_count?: number;
  message?: string;
}

interface Row {
  club: Club;
  code: string | undefined;
  guild: string;
  members: string;
  problems: string[];
}

const lookup = async (code: string): Promise<InviteMeta> => {
  const endpoint = `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
  const body = (await response.json()) as InviteMeta;

  // Discord answers 404 with `{"message":"Unknown Invite","code":10006}` for a
  // code that has expired, been revoked or never existed — one state, three
  // causes, and the endpoint cannot tell them apart. Neither can this.
  if (!response.ok) {
    throw new Error(`${body.message ?? `HTTP ${response.status}`} — invite expired, revoked or wrong`);
  }
  return body;
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
  return new Map(body.data.map((club) => [club.code, club.discord]));
};

const check = async (club: Club, live: Map<string, string | undefined> | null): Promise<Row> => {
  const stored = CLUB_DISCORD[club.code];
  const code = discordInvite(stored);
  const problems: string[] = [];
  let guild = "";
  let members = "";

  if (!code) {
    problems.push(`"${stored}" is not a usable invite code`);
  } else {
    try {
      const meta = await lookup(code);
      guild = meta.guild?.name ?? "";
      members = meta.approximate_member_count ? `${meta.approximate_member_count} membros` : "";

      // An invite with an expiry is a link with a date on it. The file asks for
      // "never expire, no use limit" precisely so this never has anything to
      // say; when it does, the entry is already rotting.
      if (meta.expires_at) problems.push(`invite expires ${meta.expires_at}`);

      const words = clubWords(club);
      if (guild && !words.some((word) => fold(guild).includes(word))) {
        problems.push(`server "${guild}" names none of ${words.join(", ")}`);
      }
    } catch (error) {
      problems.push((error as Error).message);
    }
  }

  if (live) {
    const there = live.get(club.code);
    if (there !== stored) {
      problems.push(`${appUrl} serves ${there ? `"${there}"` : "no invite"} — deploy is behind`);
    }
  }

  return { club, code: stored, guild, members, problems };
};

let live: Map<string, string | undefined> | null;
try {
  live = await served();
} catch (error) {
  console.error(`Error: could not read ${appUrl}/api/clubs — ${(error as Error).message}`);
  process.exit(1);
}

// Only the clubs that HAVE an entry, unlike `check-hymns`: coverage here is
// partial by design, so printing fourteen "no invite recorded" lines would
// bury the rows that mean something.
const recorded = [...CLUBS]
  .filter((club) => CLUB_DISCORD[club.code])
  .sort((a, b) => a.shortName.localeCompare(b.shortName, "pt-BR"));

if (recorded.length === 0) {
  console.log("No Discord invites recorded yet — nothing to check.");
  process.exit(0);
}

// Sequential on purpose. A burst at a host that owes us nothing is how a check
// earns a rate limit — `check-hymns`' rule, and Discord's limits are tighter.
const rows: Row[] = [];
for (const club of recorded) rows.push(await check(club, live));

for (const row of rows) {
  const mark = row.problems.length ? "FAIL" : "ok  ";
  const meta = [row.guild, row.members].filter(Boolean).join(" | ");
  console.log(`${mark} ${row.club.shortName.padEnd(14)} ${(row.code ?? "—").padEnd(20)} ${meta}`);
  for (const problem of row.problems) console.log(`       -> ${problem}`);
}

const failed = rows.filter((row) => row.problems.length);
console.log(`\n${rows.length - failed.length}/${rows.length} invites verified`);

if (failed.length) {
  console.log("Read the server names above before editing: a name match is evidence, not proof.");
  process.exit(1);
}
