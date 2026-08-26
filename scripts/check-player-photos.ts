/**
 * check-player-photos.ts
 * ----------------------
 * Verify every photograph in src/data/player-photos.ts is still one the app may
 * publish, still credited as its photographer requires, and still served.
 *
 * The obligation this checks is not decoration. Vendoring the bytes makes this
 * app the **publisher** of its copy, and every licence in use except CC0 asks
 * for the photographer by name wherever the picture appears. A credit corrected
 * upstream after we copied it goes on being served in the old wording for as
 * long as nobody looks, and nothing in the build can see that.
 *
 * Four things per photograph:
 *
 *   1. Commons still has the file — a deletion or rename shows up here;
 *   2. its licence is still one `redistributable` will name, and the recorded
 *      deed URL is still the one that licence points at;
 *   3. the recorded credit still matches what Commons publishes, preferring the
 *      `Attribution` the photographer dictated over the `Artist` field;
 *   4. our own vendored copy exists at every width in `PLAYER_PHOTO_WIDTHS`.
 *
 * The fourth is the one that catches a data entry added without re-running the
 * sync: the card would ask for `/players/8472-64.jpg`, get the SPA shell back
 * from the catch-all route, and render a broken image. Nothing else notices.
 *
 * **It cannot check that the picture shows the right person**, and no script
 * can. That is why `player-photos.ts` says every file was opened and looked at,
 * and why the whole table prints here rather than only the failures — this
 * narrows what a person reads, it does not replace them. The description
 * Commons carries is printed for exactly that purpose.
 *
 * Talks to Commons only, so it costs nothing from the football-data budget.
 * Pass an app URL to also check what a running deployment serves, which catches
 * photographs synced on disk but never shipped:
 *
 * Usage:
 *   npx tsx scripts/check-player-photos.ts
 *   npx tsx scripts/check-player-photos.ts https://brasileirao.mpbarbosa.com
 *
 * Exit codes:
 *   0  every photograph is publishable, correctly credited and served.
 *   1  at least one is not — the line says which and why.
 */
import { existsSync } from "node:fs";
import path from "node:path";

import { creditMatches, deedFor, redistributable } from "@/commons-core";
import { PLAYER_PHOTO_WIDTHS, playerPhotoUrl } from "@/player-core";
import { commonsFacts, pause, userAgent } from "@/scripts/commons-api";
import { PLAYER_PHOTOS } from "@/src/data/player-photos";
import { SEED_SQUADS } from "@/src/data/squads";

const appUrl = process.argv[2]?.replace(/\/$/, "");
const CALLER = "check-player-photos";
const VENDORED = path.join(process.cwd(), "public/players");

const named = new Map<string, { name: string; club: string }>();
for (const squad of SEED_SQUADS) {
  for (const player of squad.players) {
    named.set(player.id, { name: player.name, club: squad.club.shortName });
  }
}

/**
 * Whether the deployment actually serves the image at that address.
 *
 * The SPA catch-all answers **200 with the HTML shell** for a path that is not
 * a file, so a status check alone would pass a photograph that was never
 * synced. The content type is what tells them apart.
 */
const served = async (url: string): Promise<string | null> => {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent(CALLER) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return `${url} answered ${response.status}`;

  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    return `${url} served ${type || "no content type"} — the SPA shell, so it was never synced`;
  }
  return null;
};

interface Row {
  id: string;
  who: string;
  file: string;
  license: string;
  credit: string;
  description: string;
  alt: string;
  problems: string[];
}

const rows: Row[] = [];

for (const [id, photo] of Object.entries(PLAYER_PHOTOS)) {
  const problems: string[] = [];
  const known = named.get(id);

  let there = null;
  try {
    there = await commonsFacts(photo.file, CALLER);
  } catch (error) {
    problems.push(`could not reach Commons — ${(error as Error).message}`);
  }

  if (there === null && !problems.length) {
    problems.push("Commons has no such file — deleted or renamed");
  }

  if (there) {
    if (!there.mime.startsWith("image/")) {
      problems.push(`Commons says this is ${there.mime || "an unknown media type"}, not an image`);
    }
    if (!redistributable(there.license)) {
      problems.push(`"${there.license || "unlicensed"}" is not a licence this app may republish`);
    }
    const deed = deedFor(there.license);
    if (deed && photo.licenseUrl !== deed) {
      problems.push(`licence deed is ${deed}, but the data records ${photo.licenseUrl}`);
    }
    if (there.license && photo.license !== there.license) {
      problems.push(`Commons now says ${there.license}, the data says ${photo.license}`);
    }
    if (!creditMatches(photo.credit, there)) {
      problems.push(
        `Commons credits "${there.attribution || there.artist}", the data says "${photo.credit}"`,
      );
    }
  }

  for (const width of PLAYER_PHOTO_WIDTHS) {
    const file = path.join(VENDORED, `${id}-${width}.jpg`);
    if (!existsSync(file)) {
      problems.push(`public/players/${id}-${width}.jpg is missing — run npm run sync-player-photos`);
    }
    if (appUrl) {
      const problem = await served(`${appUrl}${playerPhotoUrl(id, width)}`);
      if (problem) problems.push(problem);
    }
  }

  rows.push({
    id,
    who: known ? `${known.name} · ${known.club}` : `(not in squads.ts)`,
    file: photo.file,
    license: there?.license ?? photo.license,
    credit: photo.credit,
    description: there?.description ?? "",
    alt: photo.alt,
    problems,
  });

  await pause(300);
}

rows.sort((a, b) => a.who.localeCompare(b.who, "pt-BR"));

for (const row of rows) {
  console.log(`${row.problems.length ? "FAIL" : "ok  "} ${row.who.padEnd(34)} ${row.file}`);
  console.log(`       alt: ${row.alt}`);
  console.log(`       ${row.credit} · ${row.license}`);
  if (row.description) console.log(`       commons: ${row.description.slice(0, 150)}`);
  for (const problem of row.problems) console.log(`       -> ${problem}`);
}

const failed = rows.filter((row) => row.problems.length);
console.log(`\n${rows.length - failed.length}/${rows.length} photographs verified`);

if (failed.length) {
  console.log("A licence check is not a look at the picture: open the ones you change.");
  process.exit(1);
}
