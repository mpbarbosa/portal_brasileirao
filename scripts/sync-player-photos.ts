/**
 * sync-player-photos.ts
 * ---------------------
 * Download every player photograph from Wikimedia Commons into public/players/,
 * so the app serves them from its own origin.
 *
 * This is `sync-stadium-photos.ts` for the player card, and the argument for
 * vendoring is **stronger** here than it was there. A stadium page shows one
 * photograph, and the case for not hotlinking it had to be made from what a
 * future design might do. Opening several player cards in a row is not a future
 * design — it is the ordinary way to read the Jogadores page, and it is exactly
 * the shape that earns Commons' 429.
 *
 * The licence rule is `redistributable` from `commons-core.ts`, shared with the
 * stadium scripts and with `check-player-photos` rather than restated: a second
 * copy of that judgement is how a checker comes to pass a file this would
 * refuse. It admits CC0, CC BY and CC BY-SA, because a photograph renders its
 * credit as a condition of being displayed, and refuses any licence it cannot
 * *name* rather than anything on a blocklist.
 *
 * **"Public domain" is refused, and that is not a bug to fix casually.** It is
 * the single most common licence among candidate player photographs after
 * CC BY-SA 4.0, so the temptation to widen the rule is real. On Commons it is an
 * umbrella over dozens of tags, some country-specific and some contested, and
 * `deedFor` cannot name the deed a reuser would be relying on. Widening it means
 * deciding which of those tags this app trusts, in `commons-core.ts`, with the
 * stadium photographs downstream of the same change.
 *
 * The credit recorded in `player-photos.ts` is re-read from Commons on every run
 * and must still match, because vendoring makes this app the publisher of its
 * copy. A file whose attribution was corrected upstream after we copied it would
 * otherwise go on being served with the old wording for as long as nobody looks.
 *
 * Usage:
 *   npm run sync-player-photos
 *
 * Exit codes:
 *   0  every photograph written, with CREDITS.md.
 *   1  a download failed, a licence is not one we may republish, or a credit
 *      no longer matches Commons.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { creditMatches, deedFor, redistributable } from "@/commons-core";
import { PLAYER_PHOTO_WIDTHS } from "@/player-core";
import { commonsBytes, commonsFacts, pause } from "@/scripts/commons-api";
import { PLAYER_PHOTOS } from "@/src/data/player-photos";
import { SEED_SQUADS } from "@/src/data/squads";

const OUT = path.join(process.cwd(), "public/players");
const CALLER = "sync-player-photos";

/** Annotated on the declaration, not just on the arrow: TypeScript only
 *  narrows past a never-returning call when the binding itself is typed. */
const fail: (message: string) => never = (message) => {
  console.error(`Error: ${message}`);
  process.exit(1);
};

const named = new Map<string, { name: string; club: string }>();
for (const squad of SEED_SQUADS) {
  for (const player of squad.players) {
    named.set(player.id, { name: player.name, club: squad.club.shortName });
  }
}

mkdirSync(OUT, { recursive: true });

interface Credit {
  id: string;
  name: string;
  club: string;
  file: string;
  license: string;
  credit: string;
}

const credits: Credit[] = [];
let total = 0;

for (const [id, photo] of Object.entries(PLAYER_PHOTOS)) {
  const who = named.get(id);
  // Not fatal: the seed goes stale with every transfer window, and a player
  // leaving the division does not make the photograph unpublishable. It does
  // mean CREDITS.md cannot name them, which the table shows as a blank.
  const label = who ? `${who.name} (${who.club})` : `player ${id}`;

  const there = await commonsFacts(photo.file, CALLER);
  if (!there) fail(`Commons has no File:${photo.file} — deleted or renamed (${label})`);

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

  const deed = deedFor(there.license);
  if (deed && photo.licenseUrl !== deed) {
    fail(
      `${photo.file}: Commons says ${there.license}, whose deed is\n` +
        `  ${deed}\n  but player-photos.ts records ${photo.licenseUrl}.`,
    );
  }

  if (!creditMatches(photo.credit, there)) {
    fail(
      `${photo.file}: Commons now credits "${there.attribution || there.artist}",\n` +
        `  but player-photos.ts records "${photo.credit}". Update the data first —\n` +
        "  serving our own copy with a stale credit is the obligation this sync takes on.",
    );
  }

  for (const width of PLAYER_PHOTO_WIDTHS) {
    const bytes = await commonsBytes(photo.file, width, CALLER);
    writeFileSync(path.join(OUT, `${id}-${width}.jpg`), bytes);
    total += bytes.length;
    console.log(`  ${id}-${width}.jpg  ${(bytes.length / 1024).toFixed(0)}kB  ${label}`);
    await pause(1200);
  }

  credits.push({
    id,
    name: who?.name ?? "",
    club: who?.club ?? "",
    file: photo.file,
    license: there.license,
    credit: photo.credit,
  });
}

writeFileSync(
  path.join(OUT, "CREDITS.md"),
  `# Player photographs

Downloaded from Wikimedia Commons by \`scripts/sync-player-photos.ts\` and served
from this app's own origin rather than hotlinked — Commons rate-limits
third-party embedding, and rightly so. Opening several player cards in a row is
the ordinary way to read the Jogadores page, which is precisely the request
pattern that earns a 429.

**None of these came from a player's own Instagram, and none can.** A player's
photographs are their copyright; a public profile licenses nothing. Every file
here carries a licence that says what a reuser may do.

Like \`public/stadiums/\` and unlike \`public/marks/\`, these are **not** public
domain. Each is used under the licence named below, which requires the
photographer to be credited wherever the picture appears. That credit renders
inside the player card as a condition of showing the photograph, and
\`npm run check-player-photos\` re-reads each licence and credit from Commons so
this table cannot drift from what is served.

| File | Player | Club | Source on Commons | Licence | Credit |
| --- | --- | --- | --- | --- | --- |
${credits
  .map(
    (c) =>
      `| \`${c.id}-*.jpg\` | ${c.name} | ${c.club} | [${c.file}](https://commons.wikimedia.org/wiki/File:${encodeURIComponent(c.file.replace(/ /g, "_"))}) | ${c.license} | ${c.credit} |`,
  )
  .join("\n")}
`,
);

console.log(
  `\n${credits.length} photographs, ${PLAYER_PHOTO_WIDTHS.length} widths each, ${(total / 1024 / 1024).toFixed(1)} MB total`,
);
