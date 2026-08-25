/**
 * check-stadium-photos.ts
 * -----------------------
 * Verify every stadium photograph in src/data/stadiums.ts still resolves on
 * Wikimedia Commons, and still carries the credit and licence recorded beside
 * it.
 *
 * This is `check-hymns.ts` for pictures, and it exists for a sharper reason
 * than a broken link. A hymn that is pulled renders as a dead link; a photo
 * whose licence has been corrected on Commons renders exactly as it did the day
 * it was written down, and the page goes on publishing an attribution that is
 * no longer the one the photographer is owed. Nothing in the build can see
 * that, because every fact being checked lives on somebody else's server.
 *
 * Five things are checked per stadium:
 *
 *   1. the file still exists — a deleted or renamed file is a broken image;
 *   2. it is still an image, and Commons will still render the thumbnail the
 *      page actually requests (`Special:FilePath?width=…`, fetched for real);
 *   3. the recorded `license` matches what Commons publishes today;
 *   4. the recorded `credit` matches Commons' `Attribution` where the
 *      photographer dictated one, and its `Artist` otherwise;
 *   5. `licenseUrl` points at creativecommons.org and agrees with the licence
 *      Commons names — a CC BY-SA 4.0 file linked to the CC BY 4.0 deed
 *      understates what a reader is being granted.
 *
 * What it cannot check is the one that matters most: **whether the photograph
 * is of the right ground.** A Wikipedia article's lead image is often the club
 * or stadium *logo* rather than a photo, and one candidate for the Nilton
 * Santos is described on Commons as a journalist posing outside it — both
 * resolve, both are correctly licensed, and both would pass every rule here.
 * So this prints the whole table, description included, rather than only the
 * failures: it narrows what a person has to look at, it does not replace
 * looking.
 *
 * Talks to Commons only, so it costs nothing from the football-data budget.
 * Pass an app URL to also check what a running deployment serves, which catches
 * a photo edited on disk but not yet shipped.
 *
 * Usage:
 *   npm run check-stadium-photos
 *   npm run check-stadium-photos https://brasileirao.mpbarbosa.com
 *
 * Exit codes:
 *   0  every photo resolves and its credit and licence still match Commons.
 *   1  at least one does not — the line says which and why.
 */
import { creditMatches, deedFor, fold, plain } from "@/commons-core";
import { STADIUMS } from "@/src/data/stadiums";
import { buildStadiums, PHOTO_WIDTHS } from "@/venue-core";
import type { Club, Match, StadiumPhoto } from "@/src/types";

const appUrl = process.argv[2];

/**
 * Commons asks reusers to identify themselves. An anonymous script hammering
 * the API is what its rate limiter is for, and being nameless is how this ends
 * up throttled for reasons nobody can diagnose from the output.
 */
const UA = "portal-brasileirao/1.0 (https://brasileirao.mpbarbosa.com; check-stadium-photos)";

const API = "https://commons.wikimedia.org/w/api.php";

interface CommonsFacts {
  license: string;
  /** The wording the photographer dictated, where they dictated one. */
  attribution: string;
  /** Who Commons says took it. */
  artist: string;
  description: string;
  mime: string;
}

const commons = async (file: string): Promise<CommonsFacts | null> => {
  const url =
    `${API}?action=query&format=json&origin=*` +
    `&titles=${encodeURIComponent(`File:${file}`)}` +
    `&prop=imageinfo&iiprop=extmetadata|mime` +
    `&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist|Attribution|ImageDescription`;

  const response = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Commons API answered ${response.status}`);

  const body = (await response.json()) as {
    query?: { pages?: Record<string, { missing?: string; imageinfo?: { mime?: string; extmetadata?: Record<string, { value: string }> }[] }> };
  };

  const page = Object.values(body.query?.pages ?? {})[0];
  // A missing file comes back as a page stub with `missing`, not as an error.
  if (!page || page.missing !== undefined) return null;

  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};

  return {
    license: plain(meta.LicenseShortName?.value ?? ""),
    attribution: plain(meta.Attribution?.value ?? ""),
    artist: plain(meta.Artist?.value ?? ""),
    description: plain(meta.ImageDescription?.value ?? ""),
    mime: info?.mime ?? "",
  };
};

/**
 * Fetch the exact address the page puts in `src`, and confirm Commons answers
 * with an image.
 *
 * The API says the file exists; this says the thumbnailer will actually render
 * it at the width asked for. Those are not the same claim — an existing file
 * whose renderer fails still shows a reader a broken box.
 */
const thumbnailRenders = async (photo: StadiumPhoto): Promise<string | null> => {
  // Commons directly, not `stadiumPhotoUrl` — since the photographs were
  // vendored that builds a path on *our* origin, and asking it here would check
  // our copy while claiming to check the source.
  const source = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(photo.file)}?width=${PHOTO_WIDTHS[0]}`;
  const response = await fetch(source, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) return `thumbnail answered ${response.status}`;

  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return `thumbnail served ${type || "no content type"}`;

  return null;
};

/** What a deployment currently serves, keyed by stadium slug. Absent when no
 *  URL was passed, which is the ordinary case. */
const served = async (): Promise<Map<string, string | undefined> | null> => {
  if (!appUrl) return null;

  const response = await fetch(new URL("/api/matches", appUrl), {
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} from ${appUrl}/api/matches`);

  const body = (await response.json()) as { data: { matches: Match[]; clubs: Club[] } };

  // The stadium list is derived from the fixtures, exactly as the app derives
  // it — there is no stadium endpoint, for the reason venue-core.ts gives.
  const stadiums = buildStadiums(body.data.matches, body.data.clubs, STADIUMS);
  return new Map(stadiums.map((stadium) => [stadium.slug, stadium.photo?.file]));
};

interface Row {
  slug: string;
  name: string;
  photo: StadiumPhoto | undefined;
  description: string;
  problems: string[];
}

const check = async (
  slug: string,
  live: Map<string, string | undefined> | null,
): Promise<Row> => {
  const facts = STADIUMS[slug]!;
  const photo = facts.photo;
  const problems: string[] = [];
  let description = "";

  if (!photo) {
    problems.push("no photo recorded");
  } else {
    try {
      const there = await commons(photo.file);

      if (!there) {
        problems.push(`Commons has no File:${photo.file} — deleted or renamed`);
      } else {
        description = there.description;

        if (!there.mime.startsWith("image/")) {
          problems.push(`Commons reports ${there.mime || "no media type"}, not an image`);
        }

        if (fold(there.license) !== fold(photo.license)) {
          problems.push(`Commons now says "${there.license}", not "${photo.license}"`);
        }

        // `creditMatches` decides this, shared with `sync-stadium-photos`:
        // where the photographer dictated an attribution string that is the one
        // with legal force, otherwise the artist's name is what is owed. A
        // second copy of that judgement is how the checker comes to pass a file
        // the sync refuses.
        const owed = there.attribution || there.artist;
        if (owed && !creditMatches(photo.credit, there)) {
          problems.push(`Commons credits "${owed}", not "${photo.credit}"`);
        }
        if (!owed && fold(photo.license) !== "cc0") {
          problems.push("Commons names nobody to credit — check the file page by hand");
        }

        const deed = deedFor(there.license);
        if (!deed) {
          problems.push(`cannot check licenseUrl — "${there.license}" is a licence this script does not know`);
        } else if (deed !== photo.licenseUrl) {
          problems.push(`licenseUrl should be ${deed}`);
        }

        const rendered = await thumbnailRenders(photo);
        if (rendered) problems.push(rendered);
      }
    } catch (error) {
      problems.push((error as Error).message);
    }
  }

  if (live) {
    const there = live.get(slug);
    if (there !== photo?.file) {
      problems.push(
        `${appUrl} serves ${there ? `"${there}"` : "no photo"} — deploy is behind`,
      );
    }
  }

  return { slug, name: facts.name, photo, description, problems };
};

let live: Map<string, string | undefined> | null;
try {
  live = await served();
} catch (error) {
  console.error(`Error: could not read ${appUrl}/api/matches — ${(error as Error).message}`);
  process.exit(1);
}

// Sequential on purpose, as check-hymns is: nineteen requests take a few
// seconds, and a burst at a host that owes us nothing is how a check earns a
// rate limit.
const rows: Row[] = [];
for (const slug of Object.keys(STADIUMS).sort()) {
  rows.push(await check(slug, live));
}

for (const row of rows) {
  const mark = row.problems.length ? "FAIL" : "ok  ";
  console.log(`${mark} ${row.name.padEnd(26)} ${row.photo?.file ?? "—"}`);
  if (row.photo) console.log(`       alt: ${row.photo.alt}`);
  if (row.photo) console.log(`       ${row.photo.credit} · ${row.photo.license}`);
  if (row.description) console.log(`       commons: ${row.description.slice(0, 110)}`);
  for (const problem of row.problems) console.log(`       -> ${problem}`);
}

const failed = rows.filter((row) => row.problems.length);
console.log(`\n${rows.length - failed.length}/${rows.length} photos verified`);

if (failed.length) {
  console.log("A resolving file is not a photo of the right ground — open the ones you changed.");
  process.exit(1);
}
