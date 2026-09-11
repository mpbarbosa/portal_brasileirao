/**
 * Instagram addresses: a profile handle or a post shortcode read out of whatever
 * a person pasted, with the URLs built from each.
 *
 * Pure, with no I/O (tests/instagram-core.test.ts).
 */
/**
 * The handle alone, from whatever was written down.
 *
 * Accepts what a person is likely to paste — a bare handle, an `@handle`, or a
 * full URL carrying Instagram's `?hl=pt-br` locale hint — because the handle
 * list is hand-maintained and being strict about the input format buys nothing.
 * Only the handle is kept, so the stored data does not accumulate query strings
 * that mean nothing to another reader.
 *
 * Returns null for anything that is not a plausible handle, which the UI
 * renders as no link rather than a broken one.
 */
export const instagramHandle = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  // Take the first path segment of a URL, or the value itself.
  const handle = (value.includes("instagram.com/")
    ? (value.split("instagram.com/")[1] ?? "")
    : value
  )
    .split(/[/?#]/)[0]
    .replace(/^@/, "");

  // Instagram's own rule: letters, digits, dots and underscores, up to 30.
  return /^[A-Za-z0-9._]{1,30}$/.test(handle) ? handle : null;
};

/**
 * The address for a handle, built from the normalised handle rather than from
 * the raw value — so a link and the `@handle` printed beside it cannot come to
 * disagree about which profile they mean.
 */
export const instagramUrl = (raw: string | null | undefined): string | null => {
  const handle = instagramHandle(raw);
  return handle && `https://www.instagram.com/${handle}/`;
};

/** The path kinds whose code the `/p/` addresses were measured to serve. */
const POST_PATH = /^(?:p|reel)\//;

/**
 * The shortcode of one Instagram **post**, from whatever was written down.
 *
 * `instagramHandle`'s shape one level down: accepts a bare code or a pasted
 * permalink, and keeps only the code. That matters more here than it does for a
 * handle, because Instagram's own "copy link" appends
 * `?utm_source=ig_web_copy_link&stkn=…` — a **share token identifying whoever
 * copied it**, which has no business in a committed file.
 *
 * **`/p/` and `/reel/` are accepted; `/tv/`, `/reels/` and everything else are
 * refused.** A reel's shortcode is a post's shortcode, and that was measured
 * rather than assumed — in a browser on 2026-09-11, against `DbHq1mExfG9`, a
 * reel published by Pedro's own account: `/p/<code>/embed/captioned/` rendered
 * it with its author, the verified badge and the video, and `/p/<code>/` opened
 * it without redirecting. Mounted in the player card in headless Chromium it
 * also reported its own height by `MEASURE` — 899px in the 470px frame, against
 * 953px for Viveros' post in the same run — so `PlayerPosts` sizes it with no
 * special case. A reel is therefore stored like any other post and every
 * address below stays `/p/`; nothing downstream needs to know which it was.
 *
 * `/reels/<code>/` is refused although it carries a code too: logged out it
 * answered Instagram's login wall and nothing else, so nothing here has seen it
 * serve a reel. `/tv/` is refused for the reason reels were until somebody
 * checked. This file's rule everywhere else is that it refuses rather than
 * guesses — `matchPlayerByName`'s bar — so a further path kind is a deliberate
 * change with a check attached, not a regex loosened in passing.
 *
 * Returns null for anything that is not a plausible shortcode — Instagram's are
 * URL-safe base64 of 5 to 30 characters — which the UI renders as no post
 * rather than an empty frame.
 */
export const instagramPostCode = (raw: string | null | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  // The path after the host in a URL, or null for a bare code.
  const path = value.includes("instagram.com/") ? (value.split("instagram.com/")[1] ?? "") : null;

  // A pasted URL of another kind (`/reels/…`, `/tv/…`, a profile) still has a
  // first segment, so stripping a kind below is not on its own a filter — this
  // is. Refusing here rather than later keeps one rule instead of two.
  if (path !== null && !POST_PATH.test(path)) return null;

  const code = (path === null ? value : path.replace(POST_PATH, "")).split(/[/?#]/)[0];
  return /^[A-Za-z0-9_-]{5,30}$/.test(code) ? code : null;
};

/**
 * The address a reader opens, built from the normalised code rather than from
 * the raw value — `instagramUrl`'s rule, so the link and the frame beside it
 * cannot come to disagree about which post they mean.
 */
export const instagramPostUrl = (raw: string | null | undefined): string | null => {
  const code = instagramPostCode(raw);
  return code && `https://www.instagram.com/p/${code}/`;
};

/**
 * The address a **frame** loads: Instagram's own `/embed/captioned/` page.
 *
 * **The canonical post URL cannot be framed and this one can**, which is the
 * whole reason the two functions differ. `/p/<code>/` answers
 * `X-Frame-Options: DENY`; `/p/<code>/embed/captioned/` ships without it,
 * because it exists to be put in an iframe — it is the page Instagram's own
 * `embed.js` builds one of internally. Measured in a browser against a
 * third-party origin, not inferred: a `curl` of either address follows to the
 * login wall, which carries `DENY` and is byte-for-byte the same shell for a
 * real shortcode and an invented one, so the command line cannot answer this
 * question at all — the trap `src/data/player-instagram.ts` already records.
 *
 * **`captioned`, and that is not a preference about captions.** The embed
 * reports its own height by `postMessage`, which is the only way a frame can be
 * sized without Instagram's script, and the two variants do not report it
 * equally well: measured on the seed post at four widths, `/embed/` says **226**
 * against a true content height of **684**, while `/embed/captioned/` says
 * **818** and fits to the pixel. So a frame on `/embed/` sized from its own
 * message clips the picture — which is the shape the sibling repo's
 * `InstagramPostFrame` ships — and the fix is the endpoint rather than the
 * arithmetic.
 */
export const instagramPostEmbedUrl = (raw: string | null | undefined): string | null => {
  const code = instagramPostCode(raw);
  return code && `https://www.instagram.com/p/${code}/embed/captioned/`;
};
