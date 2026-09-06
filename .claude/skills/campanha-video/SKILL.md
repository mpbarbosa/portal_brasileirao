---
name: campanha-video
description: Produce a "Campanha do clube" animation for the Brasileirão — the Manim scenes in scripts/manim/ (campanhas, pontos, velas) plus every artefact that ships beside one: the 1080p60 mp4, the gif, the capa, the -youtube.md copy, the docs/medias/RENDERED line and the club-page entry in src/data/club-videos.ts. Use this whenever someone wants a vídeo, animação, gif or capa of a club's campanha, asks to render or re-render velas/pontos/campanhas for a club, wants the YouTube título, descrição or tags for one, is uploading one and needs a thumbnail, wants a published video put on a club's page, or when tests/manim-renders.test.ts goes red after a sync-seed-data. Reach for it before inventing a new scene too — choosing the drawing and finishing the artefact set are the halves that get skipped.
---

# A campanha do clube, as a video

`scripts/manim/README.md` is the reference: it holds every decision behind these
drawings and the reasoning for each parameter. **Read it before changing a
scene.** This skill is the other half — the order the work goes in, what each
step's failure looks like, and which checks actually catch anything, because
almost nothing here fails loudly.

The animation is a divulgação artefact drawn from the app's own seed. Its whole
claim is that a number in the video is the number on the site, so nothing here
recomputes a standing: the scenes read `rank-history.ts` or call
`computeRankCandles`. A figure wrong in a video is wrong on the site too, which
is what you want.

## Choose the drawing before choosing the format

Three scenes exist, and they answer different questions:

| Scene | Subject | Answers |
|---|---|---|
| `campanhas.py` | **two** clubs | how two campanhas ran against each other, position by rodada, with each round's fixture beside it |
| `pontos.py` | **all twenty** | how far apart the division is, points × rodada, with the classificação re-ordering live |
| `velas.py` | **one** club | what happened *inside* each rodada — corpo abertura→fechamento, pavio best/worst, and pontos acumulados beneath |

The velas scene exists because a line joins the position at the **end** of a
round, so a club that sat 4th on Saturday and finished 9th because three rivals
played on Sunday draws the same segment as one that walked calmly down. If the
request is about a single club's season, that is almost always the drawing.

**A new question is usually a new scene, not a parameter on an old one.**
`export-pontos.ts` refuses a club argument on purpose, and `velas.py` draws one
club per run because two candle series in the same band of positions are
unreadable. Widening an existing scene to cover a second subject is how one
drawing comes to serve neither.

## The artefact set

A video is not one file. Every scene render owes:

| Artefact | Obligatory? | Why |
|---|---|---|
| `docs/medias/<name>.mp4` | yes | 1920×1080 60fps, the deliverable |
| `docs/medias/<name>.gif` | yes | 960×540 15fps, derived from the committed mp4 — plays by itself in a README, an issue, a chat or a Reddit feed that will not open a player |
| `docs/medias/<name>-youtube.md` | before uploading | título, descrição and tags with their measured character counts; the copy existed only in a session transcript before this file did |
| `docs/medias/RENDERED` line | yes, per artefact | `tests/manim-renders.test.ts` names each file in both directions |
| a capa (`-miniatura*.png`) | only where the first seconds are empty | the two older videos have them; **the velas ones deliberately do not** — see the README |
| `src/data/club-videos.ts` entry | once published | the club page is where a club's own video belongs |

`ls docs/medias/` is the count, never a sentence in a document — the README has
had a count go stale twice, once in the very paragraph warning that it would.

## The runbook

### 0. Ask whether there is anything to regenerate

```bash
./scripts/sync-schedule.sh --check
```

Nothing due means the chain redraws the same season and the mp4 comes back with
different bytes purely from the encoder — churn, and exactly what the
`Screenshots-unaffected:` trailer exists to avoid one directory over. What
*obliges* a re-render is `tests/manim-renders.test.ts` going red, and it only
goes red on a sync.

### 1. Work in a worktree, and check where your shell actually is

The chain writes generated files, which is the collision the worktree rule
exists to prevent, and the shared root lags `origin/main`. The prerequisites are
in the README's regeneration block — `npm ci` and a `python3 -m venv .venv-manim`
(~460 MB, minutes). Manim is deliberately not a dependency of this repository.

**Check `pwd` before a relative-path command, not once at the start.** A shell
whose directory silently reset to the root checkout wrote two of this pipeline's
files into the wrong tree in one session; the tell was `git status` in the root
showing edits nobody made there. Absolute paths cost nothing here.

### 2. Put the club in the palette before rendering it

`CLUB_COLOURS` in the scene maps provider code → tone, and a club missing from it
falls back to a grey. Take the tone from `pontos.py`, which already solved the
palette for all twenty by its own rule (distinguishable first, faithful second) —
copying it is what stops two videos of this project disagreeing about a club's
colour. Codes are the provider's numeric ids, never the `tla`: Corinthians and
Coritiba both report `COR`.

### 3. Export, render, and copy **before** the next render

```bash
npx tsx scripts/manim/export-velas.ts 1777 > scripts/manim/velas-bahia.json
VELAS_JSON=$PWD/scripts/manim/velas-bahia.json ./.venv-manim/bin/manim -qh scripts/manim/velas.py Velas
cp media/videos/velas/1080p60/Velas.mp4 docs/medias/velas-bahia.mp4
```

Every velas run writes the same `media/videos/velas/1080p60/Velas.mp4`, because
the path carries the **scene** name and not the club's. Batching the renders and
then the copies puts one club's drawing into every file, under all the right
names, with nothing anywhere to notice. A second club is a second payload beside
the first, never a `velas.json` overwritten — that JSON is the source of an mp4
already committed.

Use `-ql` (480p15, seconds) while the framing is still moving and `-qh` once.

### 4. Open the frames — this is the step that finds things

`manim` exiting 0 means it drew something, not that the something is legible.
Five framing defects in one session came from looking and none from any check:
an axis caption landing on round 1's own pavio, a key running off both edges of
the frame, a card's last row outside its own card, a zone tag underneath the
final candles, and a summary panel covering another label.

```bash
ffmpeg -v error -y -ss 12 -i docs/medias/<name>.mp4 -frames:v 1 /tmp/f.png
```

Then **read the image**. Sample the intro, a middle rodada and the closing panel
at least; a caption that only appears at the end is invisible in every other
frame. Watch for a frame caught mid-cross-fade — the cards swap with a
`Succession`, so a card at 20% opacity is the transition and not a defect.

### 5. Measure the label contrast in the encoded frame

The scenes carry a hand-written palette, so `npm run test:tokens` has never seen
it and nothing goes red when a label is too faint. `INK_FAINT` was used as
**text** across all three scenes and delivered 2.9–3.3:1 against this project's
floor of 4.5 — worst of all on `pontos.py`'s classificação column, which is the
key that makes twenty anonymous lines readable.

```bash
python3 .claude/skills/campanha-video/scripts/measure-contrast.py /tmp/f.png \
  --at "tique de pontos:-6.62,-2.35" \
  --at "crédito do site:4.52,-3.24"
```

`--at` takes the scene coordinates the source is written in, so a label placed at
`[4.52, -3.24, 0]` is sampled by passing those two numbers. It needs only python3
with PIL and numpy — not the Manim venv. Read what it prints, not just the
number: an empty box reports **NO INK** rather than a ratio, and a coloured glyph
means the box reached past the type to a candle or a bar and is reporting a
flattering figure about the wrong subject.

Two things only measurement in the *encoded* frame shows: a narrow glyph loses
its stems to h.264, so a lone `0` measured **2.96** where `50 pts` in the same
colour measured 3.36; and 18px of type on a 1080p frame is about 2 mm on a phone.

`INK_FAINT` is now régua — grid, frame, hairline — and never text. A graphical
mark has a floor of 3, so pass `--floor 3` for one.

### 6. The gif, one palette per video

The commands are in the README under **O gif**, with the reasoning for every
parameter. The one thing to carry in your head: **never generate several gifs in
a loop against one `/tmp/palette.png`.** The palette is extracted from the video
it is about to colour, and reusing a neighbour's draws one club in another club's
colours with nothing to announce it.

The gif is *larger* than the mp4 that made it, at half the resolution and a
quarter of the frames. That is the format, not a bad parameter, and it is why the
gif never replaces the mp4.

### 7. Register it, and expect the test to be the thing that tells you

Add a line per artefact to `docs/medias/RENDERED` with the seed's
`SNAPSHOT_DATE`, in the same commit. The test checks **both** directions, and the
quiet one is a file present and unlisted — it is then exempt from the staleness
check for ever and nothing says so.

**A new `-youtube.md` in `docs/medias/` reddens that test too.** It has caught two
people, both surprised, because the file is copy rather than a render. It is
listed like the rest: the text quotes the snapshot's own figures in its título,
descrição and tags, so it ages with the video it accompanies — and wrong copy is
worse than an old video, being what people read before they watch.

```bash
node --import tsx --test tests/manim-renders.test.ts
```

### 8. Write the copy before uploading

Follow an existing `docs/medias/*-youtube.md` — the limits at the top, pasteable
blocks below, the reasoning beside each choice. **Measure the blocks against the
file** rather than asserting the counts: título ≤100, descrição ≤5000 with only
the first two lines visible before "mostrar mais", tags ≤500 counted with the
`, ` separators exactly as pasted.

A 21-second video cannot have chapters — YouTube wants three of at least 10s.
And YouTube takes the **filename** as the provisional título, so an upload of
`velas-bahia.mp4` sits in the form as `velasbahia` until somebody changes it.

### 9. Publish, then put it on the club page

**A video that is not public yet answers 403, not 404.** That is the state a
freshly uploaded render sits in, including a scheduled one, and it is why the
club-page entry cannot be written on the day the video is rendered:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://www.youtube.com/oembed?url=https%3A//www.youtube.com/watch%3Fv%3D<id>&format=json"
```

Wait for the 200, then take the **título and canal from oEmbed's own strings**
rather than retyping them — that is `src/data/club-videos.ts`'s own rule, and the
only way to tell a video from a reupload. A single-club video goes under one
code; the two-club comparação belongs under both, which is that file working
rather than a duplicate.

**That file is an appearance path**, so the screenshots gate goes red on the
commit. Check whether a captured page can actually move before reaching for the
camera: the only club page in `docs/screenshots/` is Palmeiras', so an entry
under another code cannot move a pixel — and a `Screenshots-unaffected:` trailer
naming that, in the message's last paragraph beside `Co-Authored-By:`, clears it.

## What verification is worth here

Ranked by what has actually caught something in this pipeline:

1. **Opening a frame.** Five defects, none visible to any other check.
2. **Sampling the pixels** of a label or a mark. One defect across three scenes,
   green everywhere else, including on its own pull request.
3. **`tests/manim-renders.test.ts`.** Catches forgetting, which is the failure
   that happens. It reads a person's claim about the bytes, never the bytes.
4. **Exit codes.** Catch a crash and nothing else. `manim` exits 0 over an
   illegible frame, `ffmpeg` over a gif coloured from the wrong palette.

So when reporting a render, say what you looked at. "Rendered, 21s, exit 0" is
not a claim about the video.

## Definition of done

- [ ] mp4 in `docs/medias/`, and the frames were opened and read
- [ ] labels measured in the encoded frame, ≥4.5 for text
- [ ] gif beside it, from that mp4, with its own palette
- [ ] `-youtube.md` with counts measured against the file
- [ ] every new artefact listed in `docs/medias/RENDERED`
- [ ] `node --import tsx --test tests/manim-renders.test.ts` green, and `npm run test:unit`
- [ ] published → oEmbed answers 200 → `club-videos.ts` entry, with the trailer
- [ ] the loop closed. Measured 2026-09-05: `velas-athletico-pr` and `velas-bahia`
      have copy written and **no `club-videos.ts` entry**, and nothing in the
      repository can tell you whether that is "not published yet" or "published
      and never registered" — which is the whole reason this line is a checkbox

## The open edges, so nobody rediscovers them

- **Nothing links a `-youtube.md` to the video it was written for.** The id lives
  in `club-videos.ts`, and only once the video reached a club page — so "was this
  one published?" has no answer inside the repository. Grep that file for the
  club's code, and if there is no entry, ask the person who uploaded it.
- **Every club is another artefact.** One mp4, one gif, one payload, one copy
  document, several `RENDERED` lines and one more step in the regeneration chain
  — and the chain is where a forgotten club goes unnoticed, because `RENDERED`
  takes the new date either way.
