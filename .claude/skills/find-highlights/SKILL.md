---
name: find-highlights
description: Find the "Melhores momentos" YouTube video for a Brasileirão match (ge tv, CazéTV, UOL Esporte) and add it to src/data/highlights.ts. Use this whenever someone wants highlights, melhores momentos, gols or a match video added or checked for a fixture — including when they just paste a YouTube link, a match URL like /partida/554976, a screenshot of a match page, or say something like "add the video for Flamengo x Palmeiras", "find the highlights for round 24", or "this match is missing its video".
---

# Finding a match's "Melhores momentos"

The match page shows a **Melhores momentos** section for every finished fixture.
When `src/data/highlights.ts` has entries it links each broadcaster's own
package, labelled by channel; otherwise it falls back to a YouTube *search* and
says so. This skill upgrades that fallback for a given match.

The whole job is one command. What deserves your attention is not finding a
plausible video — search does that in one request — but refusing the wrong one.

## Why this is not just a search

Searching a fixture returns, from the *same* channel, videos that are
indistinguishable from the one you want:

```
[ge tv] INTERNACIONAL 0 X 0 ATLÉTICO-MG | MELHORES MOMENTOS | 24ª RODADA  ← há 2 dias
[ge tv] INTERNACIONAL 0 X 0 ATLÉTICO-MG | MELHORES MOMENTOS | 31ª RODADA  ← há 9 meses
```

Same clubs, same score, same home-away order, same channel. Only the date and
the round separate them. Publishing the wrong one is worse than publishing
nothing, because the page already degrades honestly — a reader who gets a search
link is mildly inconvenienced, a reader who gets last season's video is
misinformed and has no way to tell.

So the decisive signal is **how close the upload is to kickoff**. Highlights go
up within hours of the final whistle, so a video uploaded *before* kickoff
cannot be that match's package, and among the survivors the closest one wins.
The other checks are cheap pre-filters that spare a page fetch.

## Do this

```bash
npx tsx scripts/find-highlights.ts 554976              # one match
npx tsx scripts/find-highlights.ts --round 24          # every finished match in a round
npx tsx scripts/find-highlights.ts --round 24 --write  # merge into the data file
```

Without `--write` it prints the entry for you to inspect. With `--write` it
splices new entries into `src/data/highlights.ts` and never touches one that is
already there, so hand-written entries and their comments survive.

It reports every candidate and why each was refused, so a run that finds nothing
tells you whether the video is genuinely absent or your fixture is wrong:

```
Internacional 0 x 0 Atlético-MG — rodada 24, 2026-08-22T21:30:00Z
  ✓ [ge tv]  INTERNACIONAL 0 X 0 ATLÉTICO-MG | … | 24ª RODADA
      uploaded 2.3h after kickoff
  · [CazéTV] MELHORES MOMENTOS: ATHLETICO-PR 2 X 0 INTERNACIONAL | …
      different clubs
```

Every accepted candidate is shown, but only the closest upload per channel ends
up in the entry — a channel sometimes posts both a short cut and a long one.

Then run `npm run lint` and `npm run test:unit`, and commit the data file.

**Finding the match id**: it is the last segment of the match URL
(`/partida/554976`). If you have only club names, `--round` over the likely
round is easier than guessing, and the report names each fixture it looked at.

## When it finds nothing

That is a normal outcome, not a failure — treat it as one. Say which channels
were searched and why the candidates were refused, and leave the file alone. The
page keeps its search fallback, which is a reasonable place for a reader to
land.

Reach for `--window <hours>`-style tolerance only if the report shows a genuine
package rejected for being slightly late. Do not widen the net by hand-picking a
video the script refused: if you find yourself pasting a URL the tool rejected,
work out *which* check rejected it and whether that check is wrong, because the
alternative is that you are about to publish last season's video.

## Which channels, and in what order

`KNOWN_CHANNELS` in `highlight-search-core.ts` lists them **in preference
order** — ge tv, then CazéTV, then UOL Esporte. That order is the order the
links appear on the page, so the first entry is the one most readers click.

A match keeps a link from every channel that covered it: packages differ in
length, and one may be taken down while another survives. Ranking decides who
leads, not who is allowed in — so do not drop UOL from a match ge tv also
covered.

To add a channel, append it to the list at the position it deserves. Identity is
the id, never the name, because reupload channels style themselves after the
broadcaster they copy:

```bash
curl -sL "https://www.youtube.com/@CazeTV" | grep -oE 'youtube\.com/channel/UC[A-Za-z0-9_-]{22}' | head -1
```

Write the label the way the channel writes itself — "ge tv", "CazéTV", "UOL
Esporte" — since it is what the reader sees. Nothing else changes.

## Adding a club spelling

Channels differ on names: "Atlético-MG" is "ATLÉTICO MINEIRO" on CazéTV, "Clube
do Remo" is just "REMO". `CLUB_ALIASES` holds those, keyed by club code.

Use whole names, never bare prefixes. "ATLETICO" alone also matches Atlético-GO,
and anything matching on the first four letters merges Corinthians with
Coritiba — the same collision that makes `tla` unusable as club identity
throughout this repo. Note also that several club names *contain* competition
names ("Atlético **Mineiro**", "Corinthians **Paulista**"), which is why the
competition filter only reads what is left after the clubs are removed.

## Where the logic lives

`highlight-search-core.ts` is pure — candidates in, verdicts out, no network —
so the traps above are unit-tested against captured titles rather than whatever
YouTube returns today. `scripts/find-highlights.ts` adds only the fetching and
the file writing. Change a rule in the core module and add a test beside the
existing ones in `tests/highlight-search-core.test.ts`; that file is the record
of every near-miss this has actually hit.
