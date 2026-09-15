/**
 * sync-broadcaster-marks.ts
 * -------------------------
 * Download the broadcaster marks into public/marks/, from FIFA's broadcast
 * guide or from Wikimedia Commons, whichever `MARKS` names for each channel.
 *
 * Run by hand, like the other sync scripts, and rarely — a broadcaster
 * rebrands every few years. The app then serves the files from its own origin.
 *
 * Hotlinking is what this exists to avoid. It works locally and fails in
 * production: Commons answers a browser's third or fourth request with 429,
 * so a reader sees some marks and empty plates where the rest should be.
 * Neither Commons nor FIFA's extranet is a CDN.
 *
 * **The two sources are held to different rules, and `broadcast-core.ts` says
 * why.** A Commons file must still read "public domain" on every run, and the
 * script refuses anything else, so a file re-licensed upstream stops the sync
 * instead of quietly creating an obligation the app does not meet. A FIFA file
 * carries no licence to check: it is the logo copa2026.mpbarbosa.com shows, used
 * to identify the broadcaster, and CREDITS.md says so rather than implying
 * otherwise.
 *
 * **FIFA's files are trimmed, and that needs ImageMagick.** They centre each
 * logo in a fixed 180x152 or 180x90 box with wide margins, so at the 16–20px a
 * plate renders, SporTV's wordmark would be three pixels tall. Three of them
 * (Globo, Globoplay, SporTV) sit on an opaque WHITE ground rather than a
 * transparent one, which is why the trim takes a fuzz: an exact trim finds no
 * border to remove and leaves all 180x152. The white is invisible only because
 * `--color-plate` is #ffffff in both themes. `-strip` keeps the PNG's own
 * timestamps out, so a re-run writes the same bytes.
 *
 * The Commons HTTP is `scripts/commons-api.ts` and the licence rule is
 * `publicDomain` in `commons-core.ts`, as for every other Commons script.
 *
 * Usage:
 *   npx tsx scripts/sync-broadcaster-marks.ts
 *
 * Exit codes:
 *   0  marks written.
 *   1  a download failed, a file is missing upstream, a Commons file is not
 *      public domain, or ImageMagick could not trim a FIFA file.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { MARKS, fifaStationLogoUrl, type MarkSource } from "@/broadcast-core";
import { commonsFilePage, publicDomain } from "@/commons-core";
import { commonsBytes, commonsFacts, pause, userAgent } from "@/scripts/commons-api";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public/marks");
const CALLER = "sync-broadcaster-marks";

/** Wide enough to stay crisp at 3x on a mark that renders 18 pixels tall. */
const WIDTH = 240;

/**
 * How far from the corner colour still counts as margin. Measured on the
 * 2026-09 files: 8% takes Globo from 180x152 to 132x130 without eating the
 * pale rim of its sphere, and leaves the transparent-ground files as an exact
 * trim would.
 */
const TRIM_FUZZ = "8%";

interface Credit {
  slug: string;
  source: string;
  licence: string;
  artist: string;
}

mkdirSync(OUT, { recursive: true });
const scratch = mkdtempSync(path.join(tmpdir(), "marks-"));

// One entry per file, since two channel spellings can share a mark.
const wanted = new Map<string, MarkSource>();
for (const mark of Object.values(MARKS)) wanted.set(mark.slug, mark);

const credits: Credit[] = [];

const fail = (message: string): never => {
  console.error(message);
  rmSync(scratch, { recursive: true, force: true });
  process.exit(1);
};

const syncFifa = async (slug: string, id: number): Promise<Credit> => {
  const url = fifaStationLogoUrl(id);
  const res = await fetch(url, {
    headers: { "User-Agent": userAgent(CALLER) },
    signal: AbortSignal.timeout(20_000),
  });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.startsWith("image/png")) {
    fail(`Error: ${url} answered ${res.status} ${type || "(no type)"} — station ${id} is gone or moved.`);
  }

  const raw = path.join(scratch, `${slug}.png`);
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  const out = path.join(OUT, `${slug}.png`);
  try {
    execFileSync("magick", [raw, "-fuzz", TRIM_FUZZ, "-trim", "+repage", "-strip", out], { stdio: "pipe" });
  } catch (err) {
    fail(
      `Error: could not trim ${url} with ImageMagick (${(err as Error).message.split("\n")[0]}).\n` +
        "  Install it (the `magick` binary) rather than writing the untrimmed file:\n" +
        "  untrimmed, the logo renders a few pixels tall inside its plate.",
    );
  }
  const size = execFileSync("magick", ["identify", "-format", "%wx%h", out]).toString();
  console.log(`  ${slug}.png  ${size}  FIFA station ${id}`);

  return {
    slug,
    source: `[FIFA TV station ${id}](${url})`,
    licence: "None stated — shown to identify the broadcaster",
    artist: "FIFA broadcast guide",
  };
};

const syncCommons = async (slug: string, file: string): Promise<Credit> => {
  const facts = await commonsFacts(file, CALLER);
  if (!facts) fail(`Error: ${file} is not on Commons — deleted or renamed.`);

  const licence = facts!.license || "unknown";
  const artist = facts!.artist || "unknown";

  if (!publicDomain(licence)) {
    fail(
      `Error: ${file} is "${licence}", not public domain.\n` +
        "  Serving it from our own origin would take on an attribution or\n" +
        "  share-alike obligation the app does not meet. Drop the entry and\n" +
        "  let the broadcaster render as a wordmark instead.",
    );
  }

  const bytes = await commonsBytes(file, WIDTH, CALLER);
  writeFileSync(path.join(OUT, `${slug}.png`), bytes);
  console.log(`  ${slug}.png  ${(bytes.length / 1024).toFixed(1)}kB  ${licence}`);

  return { slug, source: `[${file}](${commonsFilePage(file)})`, licence, artist };
};

for (const mark of wanted.values()) {
  credits.push("fifa" in mark ? await syncFifa(mark.slug, mark.fifa) : await syncCommons(mark.slug, mark.commons));
  // Deliberately unhurried: the 429 that motivated this script is a reminder
  // that both hosts are someone else's server.
  await pause(1200);
}

rmSync(scratch, { recursive: true, force: true });

writeFileSync(
  path.join(OUT, "CREDITS.md"),
  `# Broadcaster marks

Downloaded by \`scripts/sync-broadcaster-marks.ts\` and served from this app's
own origin rather than hotlinked.

Two sources. Where FIFA's broadcast guide carries a channel, the mark is the
logo FIFA serves for it — the same one copa2026.mpbarbosa.com shows — trimmed
of its padding. Those files come with **no licence**: they are the
broadcasters' logos, used only to identify the broadcaster showing a match.
The remaining marks come from Wikimedia Commons and are public domain; the sync
re-checks that on each run and refuses anything that is not.

The trademarks remain the property of their respective owners.

| File | Source | Licence | Credited |
| --- | --- | --- | --- |
${credits.map((c) => `| \`${c.slug}.png\` | ${c.source} | ${c.licence} | ${c.artist} |`).join("\n")}
`,
);

console.log(`\nWrote ${credits.length} marks and CREDITS.md to public/marks/`);
