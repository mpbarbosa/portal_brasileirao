/**
 * sync-stadium-photos.ts
 * ----------------------
 * Download every stadium photograph from Wikimedia Commons into
 * public/stadiums/, so the app serves them from its own origin.
 *
 * This is `sync-broadcaster-marks.ts` for photographs, and it exists for the
 * same reason. Hotlinking Commons works locally and fails in production:
 * Commons answers a browser's third or fourth request with 429, because it is
 * an archive rather than a CDN, and throttling is correct on their side. The
 * photographs shipped hotlinked; this is the sync that pays that back.
 *
 * **A single hotlinked image per page had not failed**, and that was the
 * argument for leaving it. The trouble with the argument is that it is a
 * property of today's design rather than of the code: a second photograph on
 * the page, a gallery, or an index of grounds each showing one, all restore the
 * shape that produced the 429, and none of them would look like a licensing or
 * performance decision to whoever writes them. Vendoring removes the question.
 *
 * **The licence rule here is deliberately looser than the marks'**, and the
 * difference is not an oversight. `sync-broadcaster-marks` refuses anything
 * that is not public domain, because a mark is drawn with no credit line beside
 * it and so the app can meet no attribution obligation. A photograph renders
 * its credit as a condition of being shown — `credit`, `license` and
 * `licenseUrl` are required fields on `StadiumPhoto` — so CC BY and CC BY-SA
 * are honestly serviceable here. `redistributable` in `commons-core.ts` draws
 * that line, and refuses any licence it cannot name rather than anything on a
 * blocklist: an unrecognised licence is one nobody has checked.
 *
 * The credit recorded in `stadiums.ts` is re-read from Commons on every run and
 * must still match, because vendoring makes this app the publisher of its copy.
 * A file whose attribution was corrected upstream after we copied it would
 * otherwise go on being served with the old wording for as long as nobody looks.
 *
 * Usage:
 *   npm run sync-stadium-photos
 *
 * Exit codes:
 *   0  every photograph written, with CREDITS.md.
 *   1  a download failed, a licence is not one we may republish, or a credit
 *      no longer matches Commons.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { creditMatches, deedFor, plain, redistributable } from "@/commons-core";
import { STADIUMS } from "@/src/data/stadiums";
import { PHOTO_WIDTHS } from "@/venue-core";

const OUT = path.join(process.cwd(), "public/stadiums");

/** Wikimedia asks for a real contact in the User-Agent, and answers generic
 *  ones with 403. */
const UA = "portal-brasileirao/1.0 (https://brasileirao.mpbarbosa.com; mpbarbosa@gmail.com)";

const API = "https://commons.wikimedia.org/w/api.php";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface CommonsFacts {
  license: string;
  attribution: string;
  artist: string;
  mime: string;
}

const commons = async (file: string): Promise<CommonsFacts | null> => {
  const url =
    `${API}?action=query&format=json` +
    `&titles=${encodeURIComponent(`File:${file}`)}` +
    `&prop=imageinfo&iiprop=extmetadata|mime` +
    `&iiextmetadatafilter=LicenseShortName|Artist|Attribution`;

  const response = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${response.status} reading ${file}`);

  const body = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        { missing?: string; imageinfo?: { mime?: string; extmetadata?: Record<string, { value: string }> }[] }
      >;
    };
  };

  const page = Object.values(body.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;

  const meta = page.imageinfo?.[0]?.extmetadata ?? {};
  return {
    license: plain(meta.LicenseShortName?.value ?? ""),
    attribution: plain(meta.Attribution?.value ?? ""),
    artist: plain(meta.Artist?.value ?? ""),
    mime: page.imageinfo?.[0]?.mime ?? "",
  };
};

/**
 * Fetch one rendering. `Special:FilePath` is used here and nowhere else now:
 * it reaches a file by **title**, which is what the data stores, and follows a
 * rename where the hashed `upload.wikimedia.org` path does not. That property
 * is worth a redirect in a script run by hand; it was not worth one on every
 * reader's page view, which is the whole point of this file.
 */
const download = async (file: string, width: number): Promise<Buffer> => {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${width}`;
  const response = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${response.status} downloading ${file} at ${width}px`);

  return Buffer.from(await response.arrayBuffer());
};

/** Annotated on the declaration, not just on the arrow: TypeScript only
 *  narrows past a never-returning call when the binding itself is typed. */
const fail: (message: string) => never = (message) => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

mkdirSync(OUT, { recursive: true });

interface Credit {
  slug: string;
  name: string;
  file: string;
  license: string;
  credit: string;
}

const credits: Credit[] = [];
let total = 0;

for (const [slug, facts] of Object.entries(STADIUMS)) {
  const photo = facts.photo;
  if (!photo) continue;

  const there = await commons(photo.file);
  if (!there) fail(`Commons has no File:${photo.file} — deleted or renamed (${slug})`);

  if (!there.mime.startsWith("image/")) {
    fail(`${photo.file} is ${there.mime || "an unknown media type"}, not an image`);
  }

  if (!redistributable(there.license)) {
    fail(
      `${photo.file} is "${there.license || "unlicensed"}", which this app may not republish.\n` +
        "  Hosting a copy makes us the publisher of it. Drop the entry, or replace\n" +
        "  the photograph with one under CC0, CC BY or CC BY-SA.",
    );
  }

  if (!creditMatches(photo.credit, there)) {
    fail(
      `${photo.file}: Commons now credits "${there.attribution || there.artist}",\n` +
        `  but stadiums.ts records "${photo.credit}". Update the data first — serving\n` +
        "  our own copy with a stale credit is the obligation this sync takes on.",
    );
  }

  for (const width of PHOTO_WIDTHS) {
    const bytes = await download(photo.file, width);
    writeFileSync(path.join(OUT, `${slug}-${width}.jpg`), bytes);
    total += bytes.length;
    console.log(`  ${slug}-${width}.jpg  ${(bytes.length / 1024).toFixed(0)}kB`);
    // Deliberately unhurried: the 429 that motivated this script is a reminder
    // that Commons is someone else's server.
    await sleep(1200);
  }

  credits.push({
    slug,
    name: facts.name,
    file: photo.file,
    license: there.license,
    credit: photo.credit,
  });
}

writeFileSync(
  path.join(OUT, "CREDITS.md"),
  `# Stadium photographs

Downloaded from Wikimedia Commons by \`scripts/sync-stadium-photos.ts\` and
served from this app's own origin rather than hotlinked — Commons rate-limits
third-party embedding, and rightly so.

Unlike \`public/marks/\`, these are **not** public domain. Each is used under the
licence named below, which requires the photographer to be credited wherever the
picture appears. That credit renders beneath the image on every stadium page as
a condition of showing it, and \`npm run check-stadium-photos\` re-reads each
licence and credit from Commons so this table cannot drift from what is served.

| File | Ground | Source on Commons | Licence | Credit |
| --- | --- | --- | --- | --- |
${credits
  .map(
    (c) =>
      `| \`${c.slug}-*.jpg\` | ${c.name} | [${c.file}](https://commons.wikimedia.org/wiki/File:${encodeURIComponent(c.file.replace(/ /g, "_"))}) | [${c.license}](${deedFor(c.license) ?? ""}) | ${c.credit} |`,
  )
  .join("\n")}
`,
);

console.log(
  `\nWrote ${credits.length} photographs × ${PHOTO_WIDTHS.length} widths ` +
    `(${(total / 1024 / 1024).toFixed(1)} MB) and CREDITS.md to public/stadiums/`,
);
