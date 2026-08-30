/**
 * check-player-wikipedia.ts
 * -------------------------
 * Verify every article in src/data/player-wikipedia.ts still describes the
 * player it is filed under.
 *
 * A curated link is a claim about somebody else's server, and nothing in the
 * build can tell when it stops being true: an article is renamed, merged into a
 * list, or turned into a disambiguation page when a second player of the name
 * arrives. The card keeps rendering a link that looks exactly as it did the day
 * it was written.
 *
 * **This check exists because it can.** Its sibling `player-instagram.ts` has
 * no checker and cannot have one — Instagram serves the identical JavaScript
 * shell for a real handle and an invented one, so a script could only ever
 * report "200 OK" and confirm nothing. Wikipedia answers a machine honestly,
 * which is the whole difference. Do not read the absence of one script and the
 * presence of the other as inconsistency.
 *
 * Four things are checked per player, in one batched API call per 20:
 *
 *   1. the stored value is a usable title — `wikipediaUrl` accepts it;
 *   2. the article resolves, following redirects — a rename shows up here, and
 *      the fix is to store the new title rather than make every reader hop;
 *   3. it is not a disambiguation page — the failure that arrives on its own,
 *      years later, when a second Gabriel gets an article;
 *   4. its intro states the **same birth date** as `src/data/squads.ts`.
 *
 * The fourth is the one that catches the failure worth catching, and it is not
 * hypothetical. Of the 160 candidates this file was built from, three failed
 * exactly here: the article for "Willian Oliveira" opened "6 de junho de 1989"
 * against a squad list saying 1993-05-16, because it is about a different
 * Willian. A title match cannot see that. A birth date can.
 *
 * pt-BR writes the first of the month as an ordinal, so `1º de abril` and
 * `1.º de abril` are accepted alongside `1 de abril`. Bruno Fuchs is the
 * player this exists for; without it he reads as a mismatch every run.
 *
 * Runs against no local server and costs nothing from the football-data budget:
 * the Portuguese Wikipedia is the only host it talks to. Like `check-hymns`, it
 * prints the whole table rather than only the failures — a date match narrows
 * what a person has to read, it does not replace reading it.
 *
 * Usage:
 *   npx tsx scripts/check-player-wikipedia.ts
 *
 * Exit codes:
 *   0  every recorded article resolves and states the right birth date.
 *   1  at least one does not — the line says which and why.
 */
import { wikipediaUrl } from "@/club-core";
import { PLAYER_WIKIPEDIA } from "@/src/data/player-wikipedia";
import { SEED_SQUADS } from "@/src/data/squads";
import type { Player } from "@/src/types";

const API = "https://pt.wikipedia.org/w/api.php";
const AGENT = "portal-brasileirao/1.0 (https://brasileirao.mpbarbosa.com)";

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/**
 * Every way pt-BR writes one date. The first of the month is an ordinal, and
 * articles disagree on whether it carries the period.
 */
const writtenDates = (iso: string): string[] => {
  const [year, month, day] = iso.split("-");
  const name = MONTHS[Number(month) - 1];
  const forms = Number(day) === 1 ? ["1", "1º", "1.º"] : [String(Number(day))];
  return forms.map((form) => `${form} de ${name} de ${year}`);
};

interface Row {
  id: string;
  name: string;
  club: string;
  title: string;
  resolved: string;
  problems: string[];
}

const players = new Map<string, { player: Player; club: string }>();
for (const squad of SEED_SQUADS) {
  for (const player of squad.players) {
    players.set(player.id, { player, club: squad.club.shortName });
  }
}

interface ApiPage {
  title: string;
  missing?: boolean;
  extract?: string;
  pageprops?: { disambiguation?: string };
}

const fetchBatch = async (titles: string[]): Promise<{
  pages: Map<string, ApiPage>;
  redirects: Map<string, string>;
}> => {
  const url = new URL(API);
  url.search = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", redirects: "1",
    prop: "extracts|pageprops", exintro: "1", explaintext: "1",
    titles: titles.join("|"),
  }).toString();

  const response = await fetch(url, { headers: { "User-Agent": AGENT } });
  if (!response.ok) throw new Error(`${response.status} from pt.wikipedia.org`);

  const body = (await response.json()) as {
    query?: { pages?: ApiPage[]; redirects?: { from: string; to: string }[] };
  };

  const pages = new Map<string, ApiPage>();
  for (const page of body.query?.pages ?? []) pages.set(page.title.toLowerCase(), page);

  const redirects = new Map<string, string>();
  for (const hop of body.query?.redirects ?? []) redirects.set(hop.from.toLowerCase(), hop.to);

  return { pages, redirects };
};

const entries = Object.entries(PLAYER_WIKIPEDIA);
const rows: Row[] = [];

// Batched twenty at a time and awaited in sequence: the API takes fifty titles
// per call, and a burst at a host that owes us nothing is how a check earns a
// rate limit.
for (let start = 0; start < entries.length; start += 20) {
  const batch = entries.slice(start, start + 20);
  let result: Awaited<ReturnType<typeof fetchBatch>>;
  try {
    result = await fetchBatch(batch.map(([, title]) => title));
  } catch (error) {
    console.error(`Error: could not read the MediaWiki API — ${(error as Error).message}`);
    process.exit(1);
  }

  for (const [id, title] of batch) {
    const known = players.get(id);
    const problems: string[] = [];

    const key = title.toLowerCase();
    const page = result.pages.get(result.redirects.get(key)?.toLowerCase() ?? key);
    const intro = page?.extract ?? "";

    if (!wikipediaUrl(title)) problems.push("not a usable article title");
    if (!known) {
      // Not fatal on its own: the seed goes stale with every transfer window,
      // and a player leaving the division does not make the article wrong.
      problems.push(`no longer in src/data/squads.ts — cannot check the birth date`);
    }
    if (!page || page.missing) {
      problems.push("no such article");
    } else {
      if (page.pageprops?.disambiguation !== undefined) {
        problems.push("this is a disambiguation page, not a player");
      }
      const moved = result.redirects.get(key);
      if (moved) problems.push(`renamed — store "${moved}" instead of "${title}"`);
      if (!intro) problems.push("article has no intro to check the birth date against");

      const dob = known?.player.dateOfBirth;
      // Case-folded, because some articles capitalise the month — Alexander
      // Barboza's opens "16 de Março de 1995". Same class of false negative as
      // the `1º` ordinal above, and the same fix: widen how the date may be
      // *written*, never what counts as a match. Folding case cannot make two
      // different dates equal, so the check loses nothing.
      const haystack = intro?.toLowerCase();
      if (haystack && dob && !writtenDates(dob).some((written) => haystack.includes(written.toLowerCase()))) {
        problems.push(`intro does not state ${writtenDates(dob)[0]} — this may be another player of the name`);
      }
      if (intro && known && !dob) {
        problems.push("squads.ts carries no birth date for this player — nothing to check against");
      }
    }

    rows.push({
      id,
      name: known?.player.name ?? "(not in squads.ts)",
      club: known?.club ?? "—",
      title,
      resolved: page?.title ?? "",
      problems,
    });
  }
}

rows.sort((a, b) => a.club.localeCompare(b.club, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));

for (const row of rows) {
  const mark = row.problems.length ? "FAIL" : "ok  ";
  console.log(`${mark} ${row.club.padEnd(14)} ${row.name.padEnd(24)} ${row.resolved || row.title}`);
  for (const problem of row.problems) console.log(`       -> ${problem}`);
}

const failed = rows.filter((row) => row.problems.length);
console.log(`\n${rows.length - failed.length}/${rows.length} articles verified`);

if (failed.length) {
  console.log("Open the articles above before editing: a birth date is strong evidence, not proof.");
  process.exit(1);
}
