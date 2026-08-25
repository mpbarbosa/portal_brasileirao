/**
 * sync-broadcaster-marks.ts
 * -------------------------
 * Download the broadcaster marks from Wikimedia Commons into public/marks/.
 *
 * Run by hand, like the other sync scripts, and rarely — a broadcaster
 * rebrands every few years. The app then serves the files from its own origin.
 *
 * Hotlinking Commons is what this exists to avoid. It works locally and fails
 * in production: Commons answers a browser's third or fourth request with 429,
 * so a reader sees some marks and empty plates where the rest should be.
 * Commons is an archive, not a CDN, and throttling is correct on their side.
 *
 * Redistributing the files is fine because each is public domain — a plain
 * wordmark is not original enough to copyright. The script re-reads the licence
 * from the API on every run and **refuses anything that is not public domain**,
 * so a file re-licensed upstream, or a new entry added carelessly, stops the
 * sync instead of quietly creating an obligation the app does not meet.
 *
 * Usage:
 *   npx tsx scripts/sync-broadcaster-marks.ts
 *
 * Exit codes:
 *   0  marks written.
 *   1  a download failed, or a file is not public domain.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { MARKS, type MarkSource } from "@/broadcast-core";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/marks");

/** Wikimedia asks for a real contact in the User-Agent, and answers generic
 *  ones with 403. */
const UA = "portal-brasileirao/1.0 (https://brasileirao.mpbarbosa.com; mpbarbosa@gmail.com)";

/** Wide enough to stay crisp at 3x on a mark that renders 18 pixels tall. */
const WIDTH = 240;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Credit {
  slug: string;
  commons: string;
  licence: string;
  artist: string;
}

const strip = (html: string) => html.replace(/<[^>]+>/g, "").trim();

const licenceOf = async (file: string): Promise<{ licence: string; artist: string }> => {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "extmetadata");
  url.searchParams.set("titles", `File:${file}`);

  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`${response.status} reading licence for ${file}`);

  const pages = (await response.json()).query.pages as Record<string, any>;
  const meta = Object.values(pages)[0]?.imageinfo?.[0]?.extmetadata ?? {};

  return {
    licence: meta.LicenseShortName?.value ?? "unknown",
    artist: strip(meta.Artist?.value ?? "unknown"),
  };
};

const download = async (file: string): Promise<Buffer> => {
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=${WIDTH}`;
  const response = await fetch(url, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`${response.status} downloading ${file}`);

  return Buffer.from(await response.arrayBuffer());
};

mkdirSync(OUT, { recursive: true });

// One entry per file, since two channel spellings can share a mark.
const wanted = new Map<string, MarkSource>();
for (const mark of Object.values(MARKS)) wanted.set(mark.slug, mark);

const credits: Credit[] = [];

for (const mark of wanted.values()) {
  const { licence, artist } = await licenceOf(mark.commons);

  if (!/public domain/i.test(licence)) {
    console.error(
      `Error: ${mark.commons} is "${licence}", not public domain.\n` +
        "  Serving it from our own origin would take on an attribution or\n" +
        "  share-alike obligation the app does not meet. Drop the entry and\n" +
        "  let the broadcaster render as a wordmark instead.",
    );
    process.exit(1);
  }

  const bytes = await download(mark.commons);
  writeFileSync(path.join(OUT, `${mark.slug}.png`), bytes);
  console.log(`  ${mark.slug}.png  ${(bytes.length / 1024).toFixed(1)}kB  ${licence}`);

  credits.push({ slug: mark.slug, commons: mark.commons, licence, artist });
  // Deliberately unhurried: the 429 that motivated this script is a reminder
  // that Commons is someone else's server.
  await sleep(1200);
}

writeFileSync(
  path.join(OUT, "CREDITS.md"),
  `# Broadcaster marks

Downloaded from Wikimedia Commons by \`scripts/sync-broadcaster-marks.ts\` and
served from this app's own origin rather than hotlinked — Commons rate-limits
third-party embedding, and rightly so.

Every file here is public domain: a plain wordmark is not original enough to
attract copyright. The sync script re-checks this on each run and refuses to
write anything that is not, so this list cannot drift from what is served.

The marks are used to identify the broadcaster showing a match. The trademarks
remain the property of their respective owners.

| File | Source on Commons | Licence | Credited |
| --- | --- | --- | --- |
${credits
  .map((c) => `| \`${c.slug}.png\` | [${c.commons}](https://commons.wikimedia.org/wiki/File:${encodeURIComponent(c.commons.replace(/ /g, "_"))}) | ${c.licence} | ${c.artist} |`)
  .join("\n")}
`,
);

console.log(`\nWrote ${credits.length} marks and CREDITS.md to public/marks/`);
