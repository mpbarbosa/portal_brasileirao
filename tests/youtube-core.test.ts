import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isYoutubeChannelId,
  videoEmbedUrl,
  videoPressedEmbedUrl,
  videoWatchUrl,
  youtubeChannelHandle,
  youtubeChannelUrl,
  youtubeVideoId,
} from "@/youtube-core";

/**
 * The player address, whose only caller is **Melhores momentos** on the Partida
 * page — tested here beside `videoWatchUrl` because what it must not do is disagree
 * with the watch address about which video it is. Two spellings of one video is
 * how a reader comes to press play on one package and be handed another.
 */
test("the embed address is the same video, on the privacy-enhanced host", () => {
  assert.equal(
    videoEmbedUrl("DiKvx0gRfaQ"),
    "https://www.youtube-nocookie.com/embed/DiKvx0gRfaQ?playsinline=1&rel=0",
  );
  // Curated highlights are stored as full watch URLs, not as bare ids — the
  // opposite of `club-hymns.ts` — so this is the shape the caller actually
  // hands it, and asserting only the bare id would test a case the app has.
  assert.equal(
    videoEmbedUrl("https://www.youtube.com/watch?v=DiKvx0gRfaQ"),
    "https://www.youtube-nocookie.com/embed/DiKvx0gRfaQ?playsinline=1&rel=0",
  );
  // The id both ways round: the frame and the link the same control carries
  // must name one video, and they read the id through one parser to guarantee
  // it. A `&t=` or a `&list=` in the curated line reaches neither.
  const pasted = "https://youtu.be/DiKvx0gRfaQ?t=42";
  assert.equal(youtubeVideoId(pasted), youtubeVideoId(videoEmbedUrl(pasted) ?? ""));

  // **The absence of `autoplay` is the assertion, not an omission from this
  // test.** The frame renders with the section rather than on a click, so a
  // video that started by itself would be the "hino que ninguém pediu" the
  // club page refuses a player over. Adding the parameter back breaks nothing
  // a person would see in a test run, which is exactly why it is pinned here.
  assert.doesNotMatch(videoEmbedUrl("DiKvx0gRfaQ") ?? "", /autoplay/);
  // iOS Safari takes a video fullscreen without this, which is the leaving of
  // the page that the whole section was changed to stop.
  assert.match(videoEmbedUrl("DiKvx0gRfaQ") ?? "", /[?&]playsinline=1(&|$)/);
});

test("the pressed address is the same player, plus the reader's own autoplay", () => {
  const id = "DiKvx0gRfaQ";

  // **Same origin, same parameters, one addition.** The two are built from one
  // `embedAddress` precisely so they cannot drift into two spellings of
  // YouTube — `videoWatchUrl`'s stated rule, applied to the third address.
  assert.equal(videoPressedEmbedUrl(id), `${videoEmbedUrl(id)}&autoplay=1`);
  assert.match(videoPressedEmbedUrl(id) ?? "", /[?&]playsinline=1(&|$|&)/);
  assert.match(videoPressedEmbedUrl(id) ?? "", /[?&]rel=0(&|$)/);

  // **And the split is the whole point: `videoEmbedUrl` must stay silent.**
  // That is the address a section may mount unasked, and the one the club page
  // spent three years refusing a player over. Two named functions rather than
  // a boolean parameter, for `serialiseDevicePreferences`' reason — a flag at a
  // call site is easy to pass wrong and impossible to see in a diff — and this
  // pair of assertions is what makes collapsing them back go red.
  assert.doesNotMatch(videoEmbedUrl(id) ?? "", /autoplay/);
  assert.match(videoPressedEmbedUrl(id) ?? "", /[?&]autoplay=1(&|$)/);

  // It degrades exactly as its two siblings do, so a caller that has no embed
  // to mount also has no half-built address to mount.
  for (const raw of ["short", "not a url/", "", undefined]) {
    assert.equal(videoPressedEmbedUrl(raw), null, `esperava null para ${String(raw)}`);
  }
});

test("the embed address refuses what the watch address refuses", () => {
  // The two degrade together, and the caller relies on it: an entry with no
  // embed keeps the plain link-out, so a parser that answered for one and not
  // the other would render a control that announces a player and opens a tab.
  for (const raw of ["short", "https://www.youtube.com/watch?v=nope", "not a url/", "", undefined]) {
    assert.equal(videoEmbedUrl(raw), null, `esperava null para ${String(raw)}`);
    assert.equal(videoWatchUrl(raw), null, `esperava null para ${String(raw)}`);
  }
});

test("a channel handle becomes the canonical channel address", () => {
  assert.equal(youtubeChannelUrl("BotafogoTV"), "https://www.youtube.com/@BotafogoTV");
  assert.equal(youtubeChannelUrl("@BotafogoTV"), "https://www.youtube.com/@BotafogoTV");
});

test("a pasted channel link is reduced to the handle", () => {
  // What an address bar carries: a tab after the handle, the mobile host, a
  // share parameter, or no scheme at all.
  assert.equal(youtubeChannelHandle("https://www.youtube.com/@BotafogoTV/videos"), "BotafogoTV");
  assert.equal(youtubeChannelHandle("https://m.youtube.com/@TvBahea?si=abc123"), "TvBahea");
  assert.equal(youtubeChannelHandle("youtube.com/@ChapeTv"), "ChapeTv");
});

test("older channel addresses are refused rather than converted", () => {
  // Club websites still link these, and each opens the right channel — measured
  // on Santos's and Chapecoense's sites — but none is the handle the club page
  // prints, so storing one would make a link whose words and address differ.
  assert.equal(youtubeChannelHandle("https://www.youtube.com/c/santosfc"), null);
  assert.equal(youtubeChannelHandle("https://www.youtube.com/user/santostvoficial"), null);
  assert.equal(
    youtubeChannelHandle("https://www.youtube.com/channel/UC5of5voGUqec9K9JqL9al4Q"),
    null,
  );
  // A video is not a channel.
  assert.equal(youtubeChannelHandle("https://www.youtube.com/watch?v=DiKvx0gRfaQ"), null);
});

test("anything that is not a channel handle yields no link", () => {
  // YouTube's own bounds: 3 to 30 characters.
  assert.equal(youtubeChannelUrl("ab"), null);
  assert.equal(youtubeChannelUrl("a".repeat(31)), null);
  assert.equal(youtubeChannelUrl("Flamengo TV"), null);
  // Another host's address is not a YouTube channel, however it is shaped.
  assert.equal(youtubeChannelUrl("https://www.instagram.com/@flamengo"), null);
  assert.equal(youtubeChannelUrl("https://www.youtube.com/"), null);
  assert.equal(youtubeChannelUrl(""), null);
  assert.equal(youtubeChannelUrl(undefined), null);
});

test("a channel id is UC and 22 characters", () => {
  assert.equal(isYoutubeChannelId("UC5of5voGUqec9K9JqL9al4Q"), true);
  assert.equal(isYoutubeChannelId("UC5of5voGUqec9K9JqL9al4"), false);
  assert.equal(isYoutubeChannelId("@ChapeTv"), false);
});
