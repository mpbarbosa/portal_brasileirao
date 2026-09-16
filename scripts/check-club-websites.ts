/**
 * check-club-websites.ts
 * ----------------------
 * Verify every club's "site oficial" still opens something that is that club's.
 *
 * **The only checker here whose subject is GENERATED data.** Every other
 * `check-*` script watches a file a person curated; this one watches
 * `clubs.ts`, which `sync-seed-data` writes from football-data's
 * `/competitions/BSA/teams` — plus `club-website-overrides.ts`, which corrects
 * it. That is deliberate rather than an inconsistency: the failure it looks for
 * is a third-party domain changing hands, and whether our copy of that address
 * was typed by a person or by a script has nothing to do with whether it rots.
 *
 * It reads the **corrected** list, so a club this repo has already fixed
 * passes. That is `check-player-wikipedia`'s rule — it reads the overridden
 * squad, because a gate that refuses an entry for being correct is worse than
 * no gate.
 *
 * **It is a hint and not a proof, and the honest form of that is three
 * verdicts rather than two.** A website carries no id to compare, so unlike
 * `check-club-discord` and `check-club-youtube` this cannot establish
 * ownership; all it can ask is whether the page still names the club.
 * `club-website-core.ts` holds that judgement and its measurements.
 *
 *   ok      the page names the club
 *   ?       the page said too little to ask — a client-rendered shell, or a
 *           host that refused us. Reported, never failed: three of the twenty
 *           are permanently in this state, and a checker that cries wolf every
 *           month is one nobody reads.
 *   FAIL    the page answered, said plenty, and named some other subject.
 *
 * Only FAIL exits non-zero. `curated-data.yml` is always green and carries a
 * failure to an issue, which is the right venue for "somebody else's domain
 * changed hands" and the wrong one for a red build on an unrelated commit.
 *
 *   npm run check-club-websites
 *   npm run check-club-websites -- https://brasileirao.mpbarbosa.com
 *
 * The optional origin additionally asserts the deploy serves the same address,
 * which is what catches the correction having been applied at four of its five
 * sites — see `tests/e2e/club-website.spec.ts` for why five.
 */
import { CLUBS } from "@/src/data/clubs";
import { CLUB_WEBSITE_OVERRIDES } from "@/src/data/club-website-overrides";
import { withWebsiteOverrides } from "@/club-core";
import { siteVerdict, type SiteVerdict } from "@/club-website-core";
import type { Club } from "@/src/types";

// Several club sites answer a scripted request differently from a browser's —
// or not at all. This is the same string `check-club-twitter` sends, and it is
// about being served the page a reader gets rather than about pretending to be
// anyone.
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const appUrl = process.argv[2];

interface Row {
  club: Club;
  website?: string;
  landed?: string;
  verdict: SiteVerdict | "no-site" | "error";
  /** The deploy serves a different address from the one this checkout holds. */
  behind: boolean;
  problems: string[];
}

/** What the deploy serves, so a correction applied at four of five sites shows. */
const served = async (): Promise<Map<string, string | undefined> | null> => {
  if (!appUrl) return null;

  const response = await fetch(new URL("/api/clubs", appUrl));
  if (!response.ok) throw new Error(`${response.status} from ${appUrl}/api/clubs`);

  const body = (await response.json()) as { data?: { code: string; website?: string }[] };
  return new Map((body.data ?? []).map((club) => [club.code, club.website]));
};

const check = async (club: Club, live: Map<string, string | undefined> | null): Promise<Row> => {
  const problems: string[] = [];
  const website = club.website;
  let verdict: Row["verdict"] = "no-site";
  let landed: string | undefined;

  if (!website) {
    // Not a failure: a club may genuinely have no site, and `withClubDetails`
    // omits the key rather than inventing one.
    problems.push("no website recorded");
  } else {
    try {
      const response = await fetch(website, {
        headers: { "user-agent": UA },
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      landed = response.url;

      if (!response.ok) {
        // A redirect is the recorded value still working, and is followed
        // above; a 4xx or 5xx tells us nothing about whose site this is.
        verdict = "inconclusive";
        problems.push(`HTTP ${response.status} — the host did not answer, so this run proves nothing`);
      } else {
        verdict = siteVerdict(await response.text(), club.shortName);
        if (verdict === "no-name") {
          problems.push(
            `answered 200 and never names "${club.shortName}" — the domain may have changed hands`,
          );
        }
      }
    } catch (error) {
      verdict = "error";
      problems.push((error as Error).message);
    }
  }

  let behind = false;
  if (live) {
    const there = live.get(club.code);
    if (there !== website) {
      behind = true;
      problems.push(`${appUrl} serves ${there ? there : "no website"} — deploy is behind, or a site is uncorrected`);
    }
  }

  return { club, website, landed, verdict, behind, problems };
};

let live: Map<string, string | undefined> | null;
try {
  live = await served();
} catch (error) {
  console.error(`Error: could not read ${appUrl}/api/clubs — ${(error as Error).message}`);
  process.exit(1);
}

const clubs = withWebsiteOverrides(CLUBS, CLUB_WEBSITE_OVERRIDES).sort((a, b) =>
  a.shortName.localeCompare(b.shortName, "pt-BR"),
);

// Sequential on purpose: twenty unrelated hosts owe us nothing, and a burst is
// how a check earns a rate limit it would then report as twenty failures.
const rows: Row[] = [];
for (const club of clubs) rows.push(await check(club, live));

const MARK: Record<Row["verdict"], string> = {
  "names-club": "ok  ",
  inconclusive: "?   ",
  "no-name": "FAIL",
  error: "FAIL",
  "no-site": "?   ",
};

/**
 * A row fails if the page named somebody else, if the fetch threw, or if the
 * deploy serves a different address — that last one whatever the page said,
 * since it means a correction did not reach every one of its five sites.
 */
const isFailure = (row: Row): boolean =>
  row.verdict === "no-name" || row.verdict === "error" || row.behind;

for (const row of rows) {
  const mark = isFailure(row) ? "FAIL" : MARK[row.verdict];
  const shown = row.website ? row.website.replace(/^https:\/\//, "") : "—";
  const moved = row.landed && row.landed !== row.website ? ` -> ${row.landed}` : "";
  console.log(`${mark} ${row.club.shortName.padEnd(14)} ${shown}${moved}`);
  for (const problem of row.problems) console.log(`       -> ${problem}`);
}

const failed = rows.filter(isFailure);
const unsure = rows.filter((row) => !isFailure(row) && row.verdict !== "names-club");
const named = rows.length - failed.length - unsure.length;

console.log(`\n${named}/${rows.length} sites still name their club, ${unsure.length} inconclusive, ${failed.length} to look at`);
console.log("A name match narrows what you have to read. It does not prove the site is the club's —");
console.log("there is no id to compare, which is why this is a hint where the Discord check is exact.");

if (failed.length) process.exit(1);
