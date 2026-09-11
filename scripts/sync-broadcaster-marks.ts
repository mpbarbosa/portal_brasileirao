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
 * The HTTP is `scripts/commons-api.ts` and the licence rule is `publicDomain` in
 * `commons-core.ts`, as for every other Commons script. This one carried its own
 * client — its own user agent, fetch, HTML stripper and sleep — for as long as
 * the others shared theirs, which is the drift that extraction was for.
 *
 * Usage:
 *   npx tsx scripts/sync-broadcaster-marks.ts
 *
 * Exit codes:
 *   0  marks written.
 *   1  a download failed, a file is missing from Commons, or a file is not
 *      public domain.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { MARKS, type MarkSource } from "@/broadcast-core";
import { commonsFilePage, publicDomain } from "@/commons-core";
import { commonsBytes, commonsFacts, pause } from "@/scripts/commons-api";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/marks");
const CALLER = "sync-broadcaster-marks";

/** Wide enough to stay crisp at 3x on a mark that renders 18 pixels tall. */
const WIDTH = 240;

interface Credit {
  slug: string;
  commons: string;
  licence: string;
  artist: string;
}

mkdirSync(OUT, { recursive: true });

// One entry per file, since two channel spellings can share a mark.
const wanted = new Map<string, MarkSource>();
for (const mark of Object.values(MARKS)) wanted.set(mark.slug, mark);

const credits: Credit[] = [];

for (const mark of wanted.values()) {
  const facts = await commonsFacts(mark.commons, CALLER);
  if (!facts) {
    console.error(`Error: ${mark.commons} is not on Commons — deleted or renamed.`);
    process.exit(1);
  }

  const licence = facts.license || "unknown";
  const artist = facts.artist || "unknown";

  if (!publicDomain(licence)) {
    console.error(
      `Error: ${mark.commons} is "${licence}", not public domain.\n` +
        "  Serving it from our own origin would take on an attribution or\n" +
        "  share-alike obligation the app does not meet. Drop the entry and\n" +
        "  let the broadcaster render as a wordmark instead.",
    );
    process.exit(1);
  }

  const bytes = await commonsBytes(mark.commons, WIDTH, CALLER);
  writeFileSync(path.join(OUT, `${mark.slug}.png`), bytes);
  console.log(`  ${mark.slug}.png  ${(bytes.length / 1024).toFixed(1)}kB  ${licence}`);

  credits.push({ slug: mark.slug, commons: mark.commons, licence, artist });
  // Deliberately unhurried: the 429 that motivated this script is a reminder
  // that Commons is someone else's server.
  await pause(1200);
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
  .map((c) => `| \`${c.slug}.png\` | [${c.commons}](${commonsFilePage(c.commons)}) | ${c.licence} | ${c.artist} |`)
  .join("\n")}
`,
);

console.log(`\nWrote ${credits.length} marks and CREDITS.md to public/marks/`);
