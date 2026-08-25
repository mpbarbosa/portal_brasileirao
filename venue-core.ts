/**
 * Pure per-stadium derivations. No I/O — the stadium view composes data the
 * client already holds (fixtures, the clubs that came with them) with the
 * curated facts in `src/data/stadiums.ts` (tests/venue-core.test.ts).
 *
 * The whole module exists because **a stadium is not an entity anywhere in the
 * data.** football-data has no venue field at any tier, and CBF's feed reports
 * only a `Stadium - City - UF` string per match, stored verbatim in
 * `venues.ts`. So the stadium roster is derived: group the fixtures by their
 * venue string, and what falls out is a stadium with a location and a set of
 * home clubs.
 *
 * That derivation is why identity is a **slug**. Two spellings of one ground
 * must not become two stadiums, and CBF's casing and accents drift by design —
 * the file records `ARENA MRV` because correcting it there would mean guessing
 * at proper names. `slugify` is the same function club URLs use, deliberately:
 * a second normaliser is how `atletico-mg` and `atlético-mg` come to disagree.
 */
import { slugify } from "@/club-core";
import { compareByKickoff } from "@/matches-core";
import type { Club, Match, Stadium, StadiumFacts, StadiumPhoto, Venue } from "@/src/types";

/**
 * Identity for a venue string. Returns "" for a name with nothing alphanumeric
 * in it, which callers must treat as "no stadium" — never as a valid key.
 */
export const stadiumSlug = (stadium: string): string => slugify(stadium);

/** What a stadium's URL should say. */
export const stadiumKey = (stadium: Stadium): string => stadium.slug;

/**
 * What to call a ground on a page that holds a fixture but not the stadium
 * list — the match page.
 *
 * The curated name where there is one, CBF's own spelling otherwise. Shared
 * rather than looked up at each call site so the match page and the stadium
 * page cannot come to name one ground two ways: CBF writes `ARENA MRV`, and a
 * link whose text disagrees with the heading it leads to reads as a mistake.
 */
export const venueName = (
  venue: Venue,
  facts: Record<string, StadiumFacts> = {},
): string => facts[stadiumSlug(venue.stadium)]?.name ?? venue.stadium;

/**
 * The rendered widths a stadium photograph is served at.
 *
 * Shared rather than declared beside the `<img>`, because `sync-stadium-photos`
 * writes exactly these files and the view requests exactly these widths. Two
 * copies of the list is how the page comes to ask for a size nobody vendored,
 * which fails as a missing image rather than as a build error.
 *
 * The page renders the photo at most 736 CSS pixels wide (see `sizes` in
 * `StadiumView`), so these are the 1× and 2× steps and nothing else. The
 * intermediate sizes that were here while the image came from Commons cost
 * nothing there, because Commons rendered them on demand; every step now costs
 * a committed file per ground.
 */
export const PHOTO_WIDTHS = [736, 1472] as const;

/**
 * Where to fetch a stadium photograph, at a given rendered width.
 *
 * **Served from this app's own origin**, not from Commons. Hotlinking Commons
 * is what `sync-broadcaster-marks` already exists to avoid: Commons answers a
 * browser's third or fourth request with 429, because it is an archive rather
 * than a CDN, and throttling is correct on their side. The photographs were
 * hotlinked when they shipped and are now vendored into `public/stadiums/` by
 * `npm run sync-stadium-photos`, which is the same answer the marks got.
 *
 * Keyed by **stadium slug** rather than by the Commons file title: the slug is
 * already the stadium's identity, it is unique by construction, and it keeps
 * `public/stadiums/maracana-1472.jpg` legible to someone listing the directory.
 * The Commons title stays in the data as the *source*, and `stadiumPhotoPage`
 * still links to it — the licence requires that link, and vendoring the bytes
 * does not vendor the attribution.
 */
export const stadiumPhotoUrl = (slug: string, width: number): string =>
  `/stadiums/${slug}-${width}.jpg`;

/**
 * The file's description page — where the licence, the photographer and the
 * upload history actually live.
 *
 * Every Creative Commons licence in use here asks that the reuser point back at
 * the work, and this is that link. Spaces become underscores because a Commons
 * page title is written that way in a URL; `encodeURIComponent` then handles
 * the accents, and deliberately runs **after** the substitution so it does not
 * percent-encode the underscores it just introduced.
 */
export const stadiumPhotoPage = (photo: StadiumPhoto): string =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.file.replace(/ /g, "_"))}`;

/** Fixtures played at one stadium, in kickoff order. */
export const stadiumMatches = (matches: Match[], slug: string): Match[] =>
  matches
    .filter((match) => match.venue && stadiumSlug(match.venue.stadium) === slug)
    .sort(compareByKickoff);

/**
 * Every stadium named by the fixtures, alphabetical by display name.
 *
 * Location comes from the **first** fixture that names the stadium rather than
 * being merged across all of them: city and state are properties of the ground,
 * so every fixture there reports the same pair, and picking one avoids
 * inventing a rule for a disagreement that cannot happen.
 *
 * A fixture whose venue string slugs to nothing is skipped rather than grouped
 * under an empty key, which would collect unrelated grounds into one page.
 */
export const buildStadiums = (
  matches: Match[],
  clubs: Club[],
  facts: Record<string, StadiumFacts> = {},
): Stadium[] => {
  const byCode = new Map(clubs.map((club) => [club.code, club]));

  interface Bucket {
    slug: string;
    /** CBF's own spelling, the fallback name when nothing is curated. */
    raw: string;
    city: string;
    state: string;
    count: number;
    /** Home club code → how many fixtures it hosted here. */
    hosts: Map<string, number>;
  }

  const buckets = new Map<string, Bucket>();

  for (const match of matches) {
    const venue = match.venue;
    if (!venue) continue;

    const slug = stadiumSlug(venue.stadium);
    if (!slug) continue;

    const bucket = buckets.get(slug) ?? {
      slug,
      raw: venue.stadium,
      city: venue.city,
      state: venue.state,
      count: 0,
      hosts: new Map<string, number>(),
    };

    bucket.count += 1;
    bucket.hosts.set(match.homeCode, (bucket.hosts.get(match.homeCode) ?? 0) + 1);
    buckets.set(slug, bucket);
  }

  return [...buckets.values()]
    .map((bucket): Stadium => {
      const curated = facts[bucket.slug];

      // Most fixtures first, then by code so a tie is stable rather than
      // dependent on which fixture happened to be read first.
      const homeClubs = [...bucket.hosts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([code]) => byCode.get(code))
        .filter((club): club is Club => club !== undefined);

      return {
        slug: bucket.slug,
        name: curated?.name ?? bucket.raw,
        city: bucket.city,
        state: bucket.state,
        ...(curated?.officialName ? { officialName: curated.officialName } : {}),
        ...(curated?.capacity !== undefined ? { capacity: curated.capacity } : {}),
        ...(curated?.opened !== undefined ? { opened: curated.opened } : {}),
        ...(curated?.wikipedia ? { wikipedia: curated.wikipedia } : {}),
        ...(curated?.photo ? { photo: curated.photo } : {}),
        homeClubs,
        matchCount: bucket.count,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
};

/**
 * Resolve a stadium from a URL segment. The segment is already a slug, but it
 * is re-slugged rather than compared raw so that a hand-typed `/estadio/Maracanã`
 * lands on the page instead of 404-ing on an accent.
 */
export const findStadium = (stadiums: Stadium[], key: string): Stadium | null => {
  const needle = stadiumSlug(key);
  if (!needle) return null;
  return stadiums.find((stadium) => stadium.slug === needle) ?? null;
};

/** "Rio de Janeiro – RJ", the one-line location used in headers and metadata. */
export const stadiumLocation = (stadium: Stadium): string =>
  `${stadium.city} – ${stadium.state}`;

/**
 * Capacity in pt-BR digit grouping ("78.838"). Returns null when the stadium
 * has no curated capacity, so the caller leaves the row out rather than
 * rendering "—" against a label.
 */
export const capacityLabel = (stadium: Stadium): string | null =>
  stadium.capacity === undefined ? null : stadium.capacity.toLocaleString("pt-BR");
