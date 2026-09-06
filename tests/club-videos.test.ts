import assert from "node:assert/strict";
import { test } from "node:test";

import {
  videoThumbnailHdUrl,
  videoThumbnailUrl,
  videosFor,
  videoWatchUrl,
  youtubeVideoId,
} from "@/club-core";
import { CLUBS_BY_CODE } from "@/src/data/clubs";
import { CLUB_VIDEOS } from "@/src/data/club-videos";

/**
 * Like `tests/player-photos.test.ts`, these assert the **data** rather than the
 * code — and for the same reason: the compiler is satisfied by an empty string,
 * which reads on the page as a card with no title under a thumbnail.
 *
 * There is deliberately **no `check-club-videos` script**, and that is a
 * property of what can go wrong rather than of diligence. A YouTube id either
 * resolves through oEmbed or it does not, and a script asking that would be
 * worth writing — but what actually rots here is the **curation**: a video that
 * is up, resolves, and is about the wrong club. `check-hymns` exists because a
 * hymn has one right answer per club and a title match narrows it; a video has
 * no such answer, so a checker could only re-confirm that the link works.
 * `curated-data.yml` therefore gains nothing from this file.
 */

test("every recorded video id parses as a YouTube id", () => {
  for (const [code, videos] of Object.entries(CLUB_VIDEOS)) {
    for (const video of videos) {
      assert.equal(
        youtubeVideoId(video.id),
        video.id,
        `club ${code}: "${video.id}" is not a bare 11-character YouTube id`,
      );
    }
  }
});

test("every recorded video names a club in the division", () => {
  for (const code of Object.keys(CLUB_VIDEOS)) {
    assert.ok(CLUBS_BY_CODE.has(code), `club ${code} is not in clubs.ts`);
  }
});

test("every recorded video says what it is and whose it is", () => {
  for (const [code, videos] of Object.entries(CLUB_VIDEOS)) {
    for (const video of videos) {
      assert.ok(video.title.trim(), `club ${code}: video ${video.id} has no title`);
      assert.ok(video.channel.trim(), `club ${code}: video ${video.id} has no channel`);
      // The title is the link text, so an id standing in for one would print a
      // string no reader recognises — `club-hymns.ts`' rule, met the other way
      // round: there the id must never be shown, here it must never be all
      // there is to show.
      assert.notEqual(video.title.trim(), video.id, `club ${code}: title is the video id`);
    }
  }
});

test("a club's rail lists each video once", () => {
  for (const [code, videos] of Object.entries(CLUB_VIDEOS)) {
    const ids = videos.map((video) => video.id);
    assert.equal(new Set(ids).size, ids.length, `club ${code}: the same video is listed twice`);
  }
});

/**
 * The repetition ACROSS clubs is the design and not a duplicate, so this asserts
 * it rather than forbidding it — a comparação naming two clubs belongs on both
 * pages, and a later "de-duplication" would silently take it off one of them.
 * It is written as a live case rather than as a comment for the reason
 * `coaches.spec.ts` carries one: an empty file would otherwise make every rule
 * above pass vacuously.
 */
test("a video about two clubs is listed under both, with one description", () => {
  const byId = new Map<string, { title: string; channel: string; codes: string[] }>();
  for (const [code, videos] of Object.entries(CLUB_VIDEOS)) {
    for (const video of videos) {
      const seen = byId.get(video.id);
      if (seen) {
        // The same video described two ways is how one club's page comes to
        // name it differently from the other's.
        assert.equal(seen.title, video.title, `video ${video.id}: two titles`);
        assert.equal(seen.channel, video.channel, `video ${video.id}: two channels`);
        seen.codes.push(code);
      } else {
        byId.set(video.id, { title: video.title, channel: video.channel, codes: [code] });
      }
    }
  }

  const shared = [...byId.values()].filter((entry) => entry.codes.length > 1);
  assert.ok(shared.length > 0, "no video is shared between clubs — has the seed entry gone?");
});

test("videosFor drops an entry whose id will not parse, and keeps the rest", () => {
  const videos = videosFor(
    {
      "1769": [
        { id: "8Kr9MLphoEc", title: "boa", channel: "canal" },
        // Too short to be a YouTube id. One bad line must not take the other
        // with it — `highlights.ts`' rule for `isHighlightUrl`.
        { id: "curto", title: "má", channel: "canal" },
      ],
    },
    "1769",
  );

  assert.deepEqual(videos.map((video) => video.title), ["boa"]);
});

/**
 * **A pasted URL is NOT what this filter drops, and reading it that way is the
 * trap this case exists to close.** `youtubeVideoId` parses a `youtu.be` link
 * happily, so a curator who pasted one gets a working card — the filter is
 * about what would *render broken*, not about the file's format rule. That rule
 * is enforced one test up, where `id` must equal its own parse, and it lives
 * there because that is a claim about the **file** rather than about what the
 * page can draw.
 *
 * The first draft of this file asserted the opposite and went red, which is the
 * only reason the distinction got written down.
 */
test("videosFor keeps an entry whose id was pasted as a link", () => {
  const videos = videosFor(
    { "1769": [{ id: "https://youtu.be/8Kr9MLphoEc?si=x", title: "colada", channel: "canal" }] },
    "1769",
  );

  assert.deepEqual(videos.map((video) => video.title), ["colada"]);
});

test("videosFor answers an empty list for a club with no entry", () => {
  assert.deepEqual(videosFor(CLUB_VIDEOS, "9999"), []);
});

test("the watch and thumbnail addresses are built from the id alone", () => {
  assert.equal(
    videoWatchUrl("https://youtu.be/8Kr9MLphoEc?si=sZ_0UxqbDDeYER0a"),
    "https://www.youtube.com/watch?v=8Kr9MLphoEc",
  );
  assert.equal(
    videoThumbnailUrl("8Kr9MLphoEc"),
    "https://img.youtube.com/vi/8Kr9MLphoEc/hqdefault.jpg",
  );
  // **`videoThumbnailUrl` is the FALLBACK and its whole job is existing.**
  // `maxresdefault` is not generated for every upload and 404s where it is
  // absent, so this address has to stay the one YouTube makes for every video
  // — the rail tries the HD one first and swaps back to this on `error`, which
  // only works while this size is the safe one. Changing it to a larger size to
  // "sharpen the fallback" removes the floor and leaves nothing beneath.
  assert.match(videoThumbnailUrl("8Kr9MLphoEc") ?? "", /hqdefault\.jpg$/);
  assert.equal(videoThumbnailUrl(undefined), null);

  // The HD address, which the rail asks for first. Same id, same host, one
  // path segment apart — asserted whole rather than by suffix, because the two
  // functions differing anywhere *but* that segment would mean a card falling
  // back to a different video's picture.
  assert.equal(
    videoThumbnailHdUrl("8Kr9MLphoEc"),
    "https://img.youtube.com/vi/8Kr9MLphoEc/maxresdefault.jpg",
  );
  // Both sizes read the id through the same parser, so a pasted watch URL
  // reaches both — the fallback swap happens on an `error` from a live CDN,
  // where one of the pair having failed to parse would render as a card with no
  // picture and no way back.
  assert.equal(
    videoThumbnailHdUrl("https://youtu.be/8Kr9MLphoEc?si=sZ_0UxqbDDeYER0a"),
    "https://img.youtube.com/vi/8Kr9MLphoEc/maxresdefault.jpg",
  );
  assert.equal(videoThumbnailHdUrl(undefined), null);
  assert.equal(videoThumbnailHdUrl("curto"), null);
  // **"not-a-video" is a well-formed YouTube id** — eleven characters, all of
  // them in the URL-safe alphabet — and it was this file's first attempt at an
  // invalid one. A fixture that looks wrong to a person and is right to the
  // parser passes against the bug it names; the id has to be the wrong *shape*.
  assert.equal(youtubeVideoId("not-a-video"), "not-a-video");
  assert.equal(videoWatchUrl("curto"), null);
  assert.equal(videoWatchUrl("id-com-caracteres-demais"), null);
  assert.equal(videoWatchUrl("onze!caract"), null);
});
