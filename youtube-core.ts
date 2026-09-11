/**
 * YouTube video addresses: the id inside whatever a person pasted, with every
 * address built from it.
 *
 * Pure, with no I/O (tests/youtube-core.test.ts).
 */
/**
 * The video id inside whatever a person pasted.
 *
 * Accepts a bare id, a `watch?v=` link, a `youtu.be` short link or an `embed/`
 * link, because every list that feeds this is hand-maintained and being strict
 * about the input format buys nothing. Only the id is kept, so a link copied
 * while the video played inside a mix or a playlist does not carry
 * `&list=RD…&start_radio=1` into the file and drop every reader into whatever
 * YouTube plays next.
 *
 * Returns null for anything that is not a plausible id — YouTube's are exactly
 * 11 characters of the URL-safe alphabet — which every caller renders as no
 * link rather than as a broken one.
 *
 * **One parser, two curated files.** `club-hymns.ts` and `club-videos.ts` store
 * the same kind of value and a second copy of this is how one of them comes to
 * accept a `youtu.be` link the other rejects. It is the rule `slugify` already
 * carries in `slug-core.ts`, and the one `venue-core.ts` reuses it under.
 */
export const youtubeVideoId = (raw: string | undefined): string | null => {
  const value = raw?.trim();
  if (!value) return null;

  let id = value;
  if (value.includes("/")) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    id =
      url.searchParams.get("v") ??
      // youtu.be/<id>, /embed/<id>, /shorts/<id> — the last path segment.
      (url.pathname.split("/").filter(Boolean).pop() ?? "");
  }

  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
};

/**
 * The watch address for a video id already known to be one.
 *
 * The origin is written **here and nowhere else**, so the hymn link, the
 * Vídeos rail, the highlight search and the YouTube scripts cannot come to
 * point at two spellings of YouTube. That sentence sat on `videoWatchUrl` below
 * while `highlight-search-core.ts` and two scripts each wrote the origin out
 * again; it is true now because they build through this.
 */
export const youtubeWatchUrl = (id: string): string => `https://www.youtube.com/watch?v=${id}`;

/** The canonical watch address for whatever a person pasted, or null if there
 *  is no id to build one from. */
export const videoWatchUrl = (raw: string | undefined): string | null => {
  const id = youtubeVideoId(raw);
  return id && youtubeWatchUrl(id);
};

/**
 * The **player** address for a video — the one that goes in an `<iframe>`.
 *
 * Written here beside `videoWatchUrl` for that function's stated reason: the
 * origin is spelled in one place, so the link a reader can copy and the frame
 * a reader can watch cannot come to disagree about what YouTube is.
 *
 * **The host is `youtube-nocookie.com`, which is YouTube's own
 * privacy-enhanced mode**, and it is the whole reason an embed is defensible
 * here at all: it serves the same player from the same API without writing
 * the tracking cookies `www.youtube.com` writes on load. `CONTEXT.md`'s
 * **Hino do clube** and **Vídeos do clube** entries both refuse an embedded
 * player, and both are about the **club** page, where a video is one of a
 * dozen things offered. `MatchHighlights` records why the Partida page is the
 * one place that argument does not reach; neither entry's own decision
 * changes.
 *
 * **There is deliberately no `autoplay`, and that absence is the load-bearing
 * half.** The frame renders with the section rather than on a click, so a
 * video that started by itself would be **Hino do clube**'s objection exactly
 * — a video nobody asked for, playing at whatever volume the reader's device
 * is on, on a page they may have opened for the scoreline. What renders is a
 * poster and YouTube's own play button, which is one press either way, and the
 * press is the reader's.
 *
 * The two parameters it does set:
 *
 * - **`playsinline=1`** — without it iOS Safari takes the video fullscreen and
 *   out of the page, which is exactly the leaving-the-page this replaces.
 * - **`rel=0`** — since 2018 this no longer removes the end-of-video
 *   suggestions, it restricts them to the **same channel**. That is the honest
 *   description and it is still worth setting: what follows a broadcaster's
 *   package is then more of that broadcaster, not whatever the platform would
 *   like a reader to watch next.
 *
 * Null for anything `youtubeVideoId` will not parse, which the caller renders
 * as an ordinary link-out — the degradation `videoThumbnailUrl` and
 * `hymnUrl` already take.
 */
/**
 * The origin and the parameters every player address here is built from,
 * written **once** for `videoWatchUrl`'s stated reason: two spellings of
 * YouTube is how the link a reader can copy and the frame a reader can watch
 * come to disagree about what YouTube is.
 */
const embedAddress = (id: string, params: string): string =>
  `https://www.youtube-nocookie.com/embed/${id}?${params}`;

const PLAYER_PARAMS = "playsinline=1&rel=0";

export const videoEmbedUrl = (raw: string | undefined): string | null => {
  const id = youtubeVideoId(raw);
  return id && embedAddress(id, PLAYER_PARAMS);
};

/**
 * The player address for a video the reader has just **pressed play on**, which
 * is the only address in this file that carries `autoplay`.
 *
 * **Two named functions rather than one taking a flag**, which is the rule
 * `serialiseDevicePreferences` already states: a boolean at a call site is easy
 * to pass wrong and impossible to see in a diff, and the thing being got wrong
 * here is the single parameter `CONTEXT.md` spends two entries refusing.
 *
 * **`autoplay` is not a softening of that refusal — it is what keeps the press
 * count at one.** `videoEmbedUrl` above is for a frame that renders *with* its
 * section, where the reader has asked for nothing and the poster plus YouTube's
 * own play button is the whole safeguard. This one is for a frame that exists
 * **because** the reader pressed play: `ClubVideos` mounts it in the click
 * handler, so without `autoplay` their press would put a second play button
 * under their cursor and ask them to press it again. The video still starts on
 * a user gesture and never on a page load, which is what the objection was
 * always about.
 *
 * Never call it where a frame renders unasked. `ClubVideos` is its only caller
 * and mounts nothing until a card is pressed; `MatchHighlights`, whose frame
 * *does* render with its section, takes `videoEmbedUrl` and must keep to it.
 */
export const videoPressedEmbedUrl = (raw: string | undefined): string | null => {
  const id = youtubeVideoId(raw);
  return id && embedAddress(id, `${PLAYER_PARAMS}&autoplay=1`);
};

/**
 * YouTube's own thumbnail for a video, at the size that always exists.
 *
 * `hqdefault` is 480×360 and is generated for every video — the higher
 * `maxresdefault` is **not**, and 404s for anything uploaded below that
 * resolution, which renders as a broken image on exactly the entries a curator
 * is least likely to re-check. So this is the address the rail falls back to,
 * and `videoThumbnailHdUrl` is the one it tries first; see that function for
 * why the rail needs a second size at all.
 *
 * **Hotlinked rather than vendored, which is the opposite of the stadium and
 * player photographs and rests on a different argument.** Those are somebody's
 * copyrighted work fetched from a volunteer-run host that answers a burst with a
 * 429; this is the platform's own artwork for the video, served from its image
 * CDN for precisely this purpose. Vendoring it would also freeze it: an uploader
 * who changes a thumbnail would leave us serving the old one for ever, with
 * nothing to notice.
 *
 * The host is still a third party the **e2e suite must not reach**, so it is in
 * `OFFLINE_HOSTS` in `tests/e2e/fixtures.ts` beside the crest CDN — that list
 * exists for exactly this decision.
 */
export const videoThumbnailUrl = (raw: string | undefined): string | null => {
  const id = youtubeVideoId(raw);
  return id && `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
};

/**
 * The same thumbnail at 1280×720, which the rail asks for first.
 *
 * **It exists because of the reader's screen rather than the card's width.**
 * The card is capped at 26rem, and `hqdefault` covers that at 1× — 480 CSS px
 * of picture behind 416 of card. Every phone this app is read on is 2× or 3×,
 * so a 328px card on a 360dp screen is asking for **984 device pixels** and
 * `hqdefault` has 480 of them. These entries are Manim renders full of small
 * type, which is the content that shows it first.
 *
 * **It is also the one that is not letterboxed.** `hqdefault` is 4:3 with the
 * picture inside black bars, so the rail's `object-cover` is cropping them
 * away; `maxresdefault` is native 16:9 and nothing is cropped. Two reasons, and
 * the crop is the one that would be easy to read as a rendering bug rather than
 * as the source.
 *
 * **This address may 404 and the caller must survive it**, which is the whole
 * reason the two are separate functions rather than a size parameter with a
 * default: a parameter reads as a preference, and this is a promise the
 * platform does not make. `ClubVideos` swaps to `videoThumbnailUrl` on `error`,
 * the way `ClubCrest` swaps to a monogram. Measured 2026-09-06 against the two
 * ids in `club-videos.ts`: both answer 200 at 1280×720 — which is a reading of
 * today's entries, not a property of the file, since a curator may add a video
 * that was never uploaded above 480p.
 *
 * **Never let this one reach the e2e suite either.** It is the same host, so
 * `img.youtube.com` in `OFFLINE_HOSTS` already covers it — and note what that
 * stub does to the fallback: it fulfils **200**, so the `error` branch is
 * unreachable by default and a spec asserting it has to route a 404 itself, as
 * `crest-fallback.spec.ts` drives a 503.
 */
export const videoThumbnailHdUrl = (raw: string | undefined): string | null => {
  const id = youtubeVideoId(raw);
  return id && `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
};
