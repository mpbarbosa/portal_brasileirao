import assert from "node:assert/strict";
import { test } from "node:test";

import {
  instagramHandle,
  instagramPostCode,
  instagramPostEmbedUrl,
  instagramPostUrl,
  instagramUrl,
} from "@/instagram-core";

test("a handle becomes the canonical profile address", () => {
  assert.equal(instagramUrl("palmeiras"), "https://www.instagram.com/palmeiras/");
  assert.equal(instagramUrl("@palmeiras"), "https://www.instagram.com/palmeiras/");
});

test("a pasted profile URL is reduced to the handle", () => {
  // What a person actually copies out of the address bar. The locale hint is
  // Instagram's, means nothing to the next reader, and should not be stored.
  assert.equal(
    instagramUrl("https://www.instagram.com/palmeiras/?hl=pt-br"),
    "https://www.instagram.com/palmeiras/",
  );
  assert.equal(instagramUrl("instagram.com/ecbahia"), "https://www.instagram.com/ecbahia/");
});

test("anything that is not a handle yields no link", () => {
  // Renders as no link at all, rather than a broken one.
  assert.equal(instagramUrl("with spaces"), null);
  assert.equal(instagramUrl("https://www.instagram.com/"), null);
  assert.equal(instagramUrl("a".repeat(31)), null);
  assert.equal(instagramUrl(""), null);
  assert.equal(instagramUrl(undefined), null);
});

test("a post shortcode becomes the canonical post address", () => {
  assert.equal(instagramPostUrl("Dc1GBBADkfo"), "https://www.instagram.com/p/Dc1GBBADkfo/");
  assert.equal(
    instagramPostUrl("https://www.instagram.com/p/Dc1GBBADkfo/"),
    "https://www.instagram.com/p/Dc1GBBADkfo/",
  );
});

test("a pasted post link loses its share token", () => {
  // Exactly what Instagram's own "copy link" puts on the clipboard. `stkn`
  // identifies the account that copied it, so storing the raw URL would commit
  // somebody's share token — which is why `instagramPostCode` exists at all
  // rather than the data file holding permalinks.
  const pasted =
    "https://www.instagram.com/p/Dc1GBBADkfo/?utm_source=ig_web_copy_link&stkn=MzRlODBiNWFlZA==";
  assert.equal(instagramPostCode(pasted), "Dc1GBBADkfo");
  assert.equal(instagramPostUrl(pasted), "https://www.instagram.com/p/Dc1GBBADkfo/");
});

test("the frame address is the captioned embed and not the canonical post", () => {
  // Not interchangeable: `/p/<code>/` answers `X-Frame-Options: DENY` and
  // cannot be framed at all, and `/embed/` (uncaptioned) misreports its own
  // height by a factor of three, so a frame sized from its MEASURE clips the
  // picture. Both were measured in a browser; see `instagramPostEmbedUrl`.
  assert.equal(
    instagramPostEmbedUrl("Dc1GBBADkfo"),
    "https://www.instagram.com/p/Dc1GBBADkfo/embed/captioned/",
  );
  assert.notEqual(instagramPostEmbedUrl("Dc1GBBADkfo"), instagramPostUrl("Dc1GBBADkfo"));
});

test("a pasted reel link yields its code, and every address it builds is a post's", () => {
  // A reel's shortcode is a post's: `/p/<code>/embed/captioned/` rendered this
  // one in a browser, author, badge and video, and `/p/<code>/` opened it
  // without redirecting. So the share token goes exactly as it does for a post,
  // and nothing built from the code says `/reel/`.
  const pasted =
    "https://www.instagram.com/reel/DbHq1mExfG9/?utm_source=ig_web_copy_link&stkn=MzRlODBiNWFlZA==";
  assert.equal(instagramPostCode(pasted), "DbHq1mExfG9");
  assert.equal(instagramPostCode("https://www.instagram.com/reel/DbHq1mExfG9"), "DbHq1mExfG9");
  assert.equal(instagramPostUrl(pasted), "https://www.instagram.com/p/DbHq1mExfG9/");
  assert.equal(
    instagramPostEmbedUrl(pasted),
    "https://www.instagram.com/p/DbHq1mExfG9/embed/captioned/",
  );
});

test("a link that is not a post yields no post", () => {
  // Refuses rather than guesses. `/tv/` has its own path kind and nothing here
  // has checked that `/p/` serves it; `/reels/` answered only the login wall.
  // Both are out until somebody checks — widening this is a deliberate change.
  assert.equal(instagramPostCode("https://www.instagram.com/tv/Dc1GBBADkfo/"), null);
  // `/reels/` is the line that matters, and not only because it is refused:
  // with the kind check deleted, "tv" is refused anyway because it is shorter
  // than a shortcode can be — it passes for a reason that has nothing to do with
  // what it is. "reels" is five characters and clears the same regex, so only
  // the kind check refuses it, and the same holds for a profile handle.
  // Confirmed by mutation.
  assert.equal(instagramPostCode("https://www.instagram.com/reels/Dc1GBBADkfo/"), null);
  assert.equal(instagramPostCode("https://www.instagram.com/palmeiras/"), null);
  // A path that merely begins with the letters of a kind is not that kind.
  assert.equal(instagramPostCode("https://www.instagram.com/reel"), null);
  assert.equal(instagramPostCode("https://www.instagram.com/"), null);
  assert.equal(instagramPostCode("with spaces"), null);
  assert.equal(instagramPostCode("abc"), null);
  assert.equal(instagramPostCode(""), null);
  assert.equal(instagramPostCode(undefined), null);
  // Every caller degrades to no post rather than to a frame pointing nowhere.
  assert.equal(instagramPostUrl("https://www.instagram.com/tv/Dc1GBBADkfo/"), null);
  assert.equal(instagramPostEmbedUrl("with spaces"), null);
});

test("instagramHandle keeps only the handle, whatever was written down", () => {
  // The handle and the URL must never disagree about which profile they mean,
  // which is why the link component prints this rather than the raw value.
  assert.equal(instagramHandle("@palmeiras"), "palmeiras");
  assert.equal(instagramHandle("https://www.instagram.com/palmeiras/?hl=pt-br"), "palmeiras");
  assert.equal(instagramHandle("  ecbahia  "), "ecbahia");
  assert.equal(instagramHandle("não é um perfil"), null);
  assert.equal(instagramHandle(undefined), null);
});
