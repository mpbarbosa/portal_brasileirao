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
 *   1. the stored value is a usable code — `discordInvite` accepts it;
 *   2. the invite resolves — `Unknown Invite` here means expired or revoked;
 *   3. it does not carry an expiry — a dated invite is a dated link;
 *   4. it still opens the guild the entry was written against.
 *
 * **The fourth is EXACT, where every other curated checker here is a hint**,
 * and that difference is the point rather than an inconsistency. `check-hymns`
 * asks whether a video's title names the club, because a title is all YouTube
 * offers; an invite resolves to a guild **id**, which is the identity itself.
 *
 * It had to be. This checker first asked whether the guild's *name* named the
 * club, and refused the only correct entry in the file: the server is called
 * **FlaDiscord**, which contains no word of "CR Flamengo". Supporters name
 * their servers the way supporters talk. A rule strict enough to be worth
 * something rejects that, and one loose enough to accept it accepts nearly
 * anything — a false negative, which is the direction a gate must never fail
 * in, and it was reached by trying to be careful.
 *
 * The id also catches the failure a name never could: a **vanity code is
 * transferable**. Discord releases one when a server drops below the boost
 * level that earned it, and whoever claims it next inherits our link — so
 * `discord.gg/flamengo` opening a different server is a live failure mode, and
 * a replacement server plausibly also calls itself something Fla-ish.
 *
 * The whole table is still printed, passes included, because the guild's name
 * and member count are what a person reads to decide the entry is still the
 * community they meant — the check says it is the same server, not that the
 * server is still worth linking to.
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

interface InviteMeta {
  guild?: { id?: string; name?: string };
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
  const entry = CLUB_DISCORD[club.code];
  const code = discordInvite(entry?.invite);
  const problems: string[] = [];
  let guild = "";
  let members = "";

  if (!code) {
    problems.push(`"${entry?.invite}" is not a usable invite code`);
  } else {
    try {
      const meta = await lookup(code);
      guild = meta.guild?.name ?? "";
      members = meta.approximate_member_count ? `${meta.approximate_member_count} membros` : "";

      // An invite with an expiry is a link with a date on it. The file asks for
      // "never expire, no use limit" precisely so this never has anything to
      // say; when it does, the entry is already rotting.
      if (meta.expires_at) problems.push(`invite expires ${meta.expires_at}`);

      // THE check. Exact, and against the id rather than the name — see this
      // file's header for why a name rule refused the one correct entry in the
      // file, and for the vanity transfer a name rule cannot see at all.
      const reached = meta.guild?.id;
      if (!reached) {
        problems.push("invite resolved without naming a guild");
      } else if (reached !== entry.guild) {
        problems.push(`opens guild ${reached} ("${guild}"), recorded as ${entry.guild}`);
      }
    } catch (error) {
      problems.push((error as Error).message);
    }
  }

  if (live) {
    const there = live.get(club.code);
    if (there !== entry?.invite) {
      problems.push(`${appUrl} serves ${there ? `"${there}"` : "no invite"} — deploy is behind`);
    }
  }

  return { club, code: entry?.invite, guild, members, problems };
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
  console.log("The guild check is exact; the name and member count are for you to read —");
  console.log("they say WHICH community it is, where the check only says it is the same one.");
  process.exit(1);
}
