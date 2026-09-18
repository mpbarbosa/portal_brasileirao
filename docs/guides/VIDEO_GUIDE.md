# Video guide

How a video of this app's data gets made — from picking the drawing to a
YouTube upload and a card on a club page — and the checks that decide whether
it is fit to publish.

This guide is the **map**. The detail lives in two places, and they win where
this file disagrees with them:

- [`scripts/manim/README.md`](../../scripts/manim/README.md) — every decision
  behind each scene, with the measurements.
- [`.claude/skills/campanha-video/SKILL.md`](../../.claude/skills/campanha-video/SKILL.md)
  — the runbook, step by step, with what each failure looks like.

Unlike the other guides here, this one was **not** imported from
`doc_template_lib`: no template covers it. It follows their shape — a principle,
argued from this codebase — so it can be cited in review the same way.

## The principle

**A video is the site's data, drawn — never data typed into a video.** Every
scene reads a JSON payload exported from the app's own seed by a script in
`scripts/manim/`, and nothing in a scene recomputes a standing. So a number that
is wrong in a video is wrong on the site too, which is the point: there is one
place to fix it.

Two consequences follow. **Videos age**: they are drawn from a frozen snapshot
and committed, so every `sync-seed-data` makes them stale, and
`tests/manim-renders.test.ts` goes red on purpose to say so. And **almost
nothing here fails loudly**: `manim` exits 0 over an illegible frame, `ffmpeg`
over a gif in the wrong club's colours. The checks that catch things are the
ones where somebody looks at, or measures, the rendered bytes.

## 1. Choose the drawing

| Scene | Subject | Answers | Payload |
|---|---|---|---|
| `campanhas.py` | two clubs | how two campanhas ran against each other, position by rodada | `export-campanhas.ts <code> <code>` |
| `pontos.py` | all twenty | how far apart the division is — points × rodada as lines | `export-pontos.ts` |
| `barras.py` | all twenty | who overtook whom — bar length is points, row is position | reuses `pontos.json` |
| `velas.py` | one club | what happened *inside* each rodada — a candle per round | `export-velas.ts <code>` |

A single club's season is almost always `velas`. A **fan cut** of the whole
division with one club marked is `barras` with `BARRAS_FOCUS=<code>`. A new
question is usually a new scene, not a parameter on an old one — the README
explains why each export script refuses what it refuses.

Club arguments are always the **provider's numeric code** (`1783` Flamengo),
never the `tla`: Corinthians and Coritiba both report `COR`.

## 2. Set up

```sh
git worktree add .claude/worktrees/<name> -b worktree-<name> origin/main
cd .claude/worktrees/<name> && cp ../../../.env .env && npm ci
python3 -m venv .venv-manim && ./.venv-manim/bin/pip install -q manim   # ~460 MB
```

Manim is deliberately **not** a dependency of this repository; it lives in its
own virtualenv. Work in a worktree because the chain writes generated files, and
check `pwd` before relative-path commands — a shell that silently reset to the
shared root has written this pipeline's files into the wrong tree before.

Before re-rendering anything, ask whether there is new data:
`./scripts/sync-schedule.sh --check`. Re-rendering the same season only produces
encoder churn.

## 3. Export and render

```sh
npx tsx scripts/manim/export-velas.ts 1777 > scripts/manim/velas-bahia.json
VELAS_JSON=$PWD/scripts/manim/velas-bahia.json \
  ./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
cp media/videos/velas/1080p60/Velas.mp4 docs/medias/bahia/velas-bahia.mp4
```

- **`-ql` while the framing is moving, `-qh` once.** `-qh` is the deliverable:
  1920×1080 at 60 fps.
- **Copy each render before starting the next.** The output path is named after
  the *scene*, not the club, so batching renders and then copies puts one club's
  drawing into every file under all the right names.
- **A second club is a second payload file**, never an overwritten
  `velas.json` — that file is the source of an mp4 already committed.
- **A new club needs its colour first.** `CLUB_COLOURS` falls back to grey;
  copy the tone from `pontos.py`, which owns the palette for all twenty.

### Cuts for other platforms

The same scene renders other aspect ratios through one switch; an unknown value
aborts rather than silently rendering 16:9.

| Cut | Switch | Size | For |
|---|---|---|---|
| 16:9 (default) | — | 1920×1080 | YouTube |
| 4:5 | `VELAS_ASPECT=4:5` / `BARRAS_ASPECT=4:5` | 1080×1350 | Instagram feed |
| 9:16 | `VELAS_ASPECT=9:16` / `BARRAS_ASPECT=9:16` | 1080×1920 | Reels, YouTube Shorts |

9:16 is **not** a stretched 4:5: the Reels interface covers about 250 px at the
top and 480 px at the bottom, and the scenes place content inside that safe
area. Files are named `<name>-45.mp4` and `<name>-916.mp4`.

## 4. Check the render — this is where defects are found

In order of what has actually caught something:

### Open the frames

```sh
ffmpeg -v error -y -ss 12 -i docs/medias/<club>/<name>.mp4 -frames:v 1 /tmp/f.png
```

Look at the intro, a middle rodada and the closing panel at least. Five framing
defects in one session were found this way and by no other check.

### Measure label contrast in the encoded frame

```sh
python3 .claude/skills/campanha-video/scripts/measure-contrast.py /tmp/f.png \
  --at "crédito do site:4.52,-3.24"
```

Text needs **4.5:1**, a graphical mark **3:1** (`--floor 3`). The scenes carry a
hand-written palette that `npm run test:tokens` never sees, and h.264 thins
narrow glyphs — a lone `0` measured 2.96 where the palette promised 3.36.

### Check for photosensitive flashing

```sh
python3 scripts/manim/check-flashes.py docs/medias/<club>/<name>.mp4
```

Exits **1** when the video breaks the general flash limit of WCAG 2.3.1 /
ITU-R BT.1702: **no more than three flashes per second** over more than **25% of
a 10° visual field**, where a flash is a pair of opposite changes of at least
10% in relative luminance. It also reports saturated red, which is a trigger of
its own. It needs only python3, numpy and ffmpeg, and reads the video as a
stream in about 220 MB.

This is not theoretical here. The corrida de barras failed it: twenty bright
bars on a near-black background are **stripes**, and when mid-table clubs swap
places a strip of screen goes bar → dark gap → bar → gap within a few frames.
Readings from the checker on the published videos (2026-09-17):

| Video | Worst 10° field | |
|---|---|---|
| `barras-20-clubes.mp4`, round beat 0.45 s | 0.385 | fails |
| `barras-flamengo.mp4`, round beat 0.45 s | 0.375 | fails |
| `barras-flamengo-916.mp4` | 0.188 | passes — rows sit further apart |
| `pontos-20-clubes.mp4` | 0.205 | passes, with the least margin |
| `campanhas-palmeiras-flamengo.mp4`, `velas-flamengo.mp4` | 0.000 | passes |
| barras re-rendered at 0.70 s + 0.20 s rest | 0.105 | passes |

Three things generalise from that fix:

- **Easing does not fix flashing.** Switching the easing curve at the same
  beat changed 0.365 to 0.364. Easing changes speed *within* a move; the hazard
  is how many edges cross one strip of screen *per second*. Space the moves out.
- **The tight cut is where it breaks first.** 16:9 packs twenty rows into less
  height than 9:16, so check the 16:9 even when publishing a vertical cut.
- **The checker is an approximation**, not a certified PEAT or Harding analysis.
  Use it to compare renders and to catch a drawing that fails by a wide margin;
  do not cite it as broadcast clearance.

Any scene that moves many high-contrast rows, stripes or large bright areas
quickly — a new race, a re-sorting table, a full-screen transition — should be
run through it before publishing, and a timing constant it constrains should say
so in a comment beside it, as `BEAT_S` in `barras.py` does.

## 5. The artefact set

A published video is several files, and `ls docs/medias/<club>/` is the count:

| Artefact | When |
|---|---|
| `<name>.mp4` | always |
| `<name>-45.mp4`, `<name>-916.mp4` | only for Instagram |
| `<name>.gif` (960×540, 15 fps, from the committed mp4) | always, **except** beside a vertical cut |
| `<name>-miniatura*.png` (1280×720) | only when the first seconds are empty — `thumbnail*.ts`, which needs Playwright's Chromium and not Manim |
| `<name>-youtube.md` | before uploading |
| a `docs/medias/RENDERED` line per file | always, with the seed's `SNAPSHOT_DATE` |

For the gif, use the two-step palette commands in the README under **O gif**,
**one video at a time** — reusing another video's palette draws one club in
another's colours without any error.

`tests/manim-renders.test.ts` checks `RENDERED` in both directions, including a
new `-youtube.md`:

```sh
node --import tsx --test tests/manim-renders.test.ts
```

It catches forgetting, not a wrong date: it reads a person's claim about the
bytes, never the bytes.

## 6. Publish

**The copy.** Model `<name>-youtube.md` on an existing one and measure it
against YouTube's limits: title ≤ 100 characters, description ≤ 5000 with only
the first two lines visible, tags ≤ 500 counted with the `, ` separators.
`tests/youtube-upload-core.test.ts` refuses a file that breaks them.

**The upload** runs from a workstation, never production, through a Google Cloud
project separate from the one serving sign-in:

```sh
npm run upload-video -- authorize               # once per Google project
npm run upload-video -- velas-bahia --dry-run   # reads and measures, sends nothing
npm run upload-video -- velas-bahia
npm run upload-video -- register <videoId>      # once the video is public
```

Uploads default to private, and each costs 1600 of the API's 10 000 daily
units — about six a day.

**The club page.** A video that is not public answers **403** at oEmbed, so the
`src/data/club-videos.ts` entry is written only after it answers 200, with the
title and channel copied from oEmbed's own response (`register` prints it). That
file is an appearance path: check whether a captured page can actually change
before re-shooting screenshots, and otherwise add a `Screenshots-unaffected:`
trailer.

**Other channels.** The gif exists for Reddit and anywhere that will not open a
player; `docs/post-reddit.md` has the plan per subreddit.

## Checklist

- [ ] The right scene for the question, rendered at `-qh` in a worktree
- [ ] Each render copied to `docs/medias/` before the next one
- [ ] Frames opened and read: intro, a middle rodada, the close
- [ ] Label contrast measured in the encoded frame: ≥ 4.5 text, ≥ 3 marks
- [ ] `check-flashes.py` exits 0 for every cut being published
- [ ] Gif from the committed mp4 with its own palette (none beside a vertical cut)
- [ ] `-youtube.md` measured against the limits
- [ ] Every file listed in `RENDERED`; `tests/manim-renders.test.ts` green
- [ ] Uploaded, public, oEmbed 200, then the `club-videos.ts` entry

When reporting a render, say what you looked at and measured. "Rendered, exit 0"
is not a claim about the video.
