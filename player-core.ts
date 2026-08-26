/**
 * Pure player display logic. No I/O, no React — translation and age are total
 * functions over their inputs (tests/player-core.test.ts).
 */
import { instagramHandle, wikipediaUrl } from "@/club-core";
import type { Player, PlayerPhoto } from "@/src/types";

/**
 * football-data reports positions in English, at two levels of detail: broad
 * lines ("Offence") and specific roles ("Centre-Back"). Both appear, so both are
 * mapped.
 *
 * An unmapped value is shown verbatim rather than replaced with a guess or a
 * dash — if the provider adds a position, a reader seeing the English word is
 * better served than one seeing nothing.
 */
const POSITION_LABELS: Record<string, string> = {
  Goalkeeper: "Goleiro",
  Defence: "Defesa",
  Midfield: "Meio-campo",
  Offence: "Ataque",
  "Centre-Back": "Zagueiro",
  "Left-Back": "Lateral-esquerdo",
  "Right-Back": "Lateral-direito",
  "Defensive Midfield": "Volante",
  "Central Midfield": "Meio-campista",
  "Attacking Midfield": "Meia-atacante",
  "Left Winger": "Ponta-esquerda",
  "Right Winger": "Ponta-direita",
  "Centre-Forward": "Centroavante",
};

export const positionLabel = (position: string | undefined): string | null => {
  const raw = position?.trim();
  if (!raw) return null;
  return POSITION_LABELS[raw] ?? raw;
};

/**
 * Whole years elapsed, counting a birthday as reached only on the day itself.
 * Takes `now` rather than reading the clock so the boundary cases are testable.
 * Returns null for a missing or unparseable date.
 */
export const ageOn = (dateOfBirth: string | undefined, now: Date): number | null => {
  if (!dateOfBirth) return null;

  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;

  let age = now.getUTCFullYear() - born.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - born.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

/**
 * Merge what the card already knows with whatever enrichment arrives. The
 * existing values survive where the enrichment has nothing — a later fetch
 * should be able to fill in a shirt number, not blank out a name.
 */
export const mergePlayer = (base: Player, extra: Player | null): Player => {
  if (!extra) return base;

  return {
    ...base,
    shirtNumber: extra.shirtNumber ?? base.shirtNumber,
    position: extra.position ?? base.position,
    nationality: extra.nationality ?? base.nationality,
    dateOfBirth: extra.dateOfBirth ?? base.dateOfBirth,
    club: extra.club ?? base.club,
  };
};

/**
 * The player's Instagram handle, or null when nothing usable is recorded.
 *
 * Returns the handle rather than the address, so it matches what `Club` carries
 * in `instagram` and the one link component can take either. The address is
 * built from it by `instagramUrl`, in one place, as it is for a club.
 *
 * The handle table is passed in rather than imported, keeping this module free
 * of I/O like every other core module — and letting the tests state the mapping
 * they assert about instead of depending on whoever is in `squads.ts` this
 * season.
 *
 * An unknown id is *absence*, not an error: coverage is partial by design and
 * most of the division has no recorded account. It normalises through
 * `instagramHandle`, so a value written down as `@nome` or as a pasted profile
 * URL still yields the handle rather than something that renders as a broken
 * link.
 */
export const playerInstagram = (
  id: string,
  handles: Record<string, string>,
): string | null => instagramHandle(handles[id]);

/**
 * The player's article on the Portuguese Wikipedia, or null when none is
 * recorded.
 *
 * Returns the **address**, not the title, which is the opposite of
 * `playerInstagram` above and deliberate: a handle is what the Instagram link
 * prints, whereas the Wikipédia link prints the word "Wikipédia" and the title
 * is only ever the destination. Returning what each caller actually renders is
 * what keeps a second normalisation out of the component.
 *
 * The table is passed in rather than imported, keeping this module free of I/O
 * like every other core module.
 *
 * An unknown id is absence, not an error — coverage is partial by design.
 */
export const playerWikipedia = (
  id: string,
  articles: Record<string, string>,
): string | null => wikipediaUrl(articles[id]);

/**
 * The rendered widths a player photograph is vendored at.
 *
 * The card draws it at 64 CSS pixels, so these are the 1× and 2× steps and
 * nothing else — every extra step is a committed file per player, and with a
 * hundred players that arithmetic bites in a way it does not for nineteen
 * grounds. This list lives here rather than beside the `<img>` for the reason
 * `venue-core.ts` gives about its own: `sync-player-photos` writes exactly
 * these files, and two copies of the list is how the card comes to request a
 * size nobody vendored — which fails as a missing image, not as a build error.
 */
export const PLAYER_PHOTO_WIDTHS = [64, 128] as const;

/**
 * Where to fetch a player photograph, at a given rendered width.
 *
 * **Served from this app's own origin**, not from Commons, for the reason
 * `venue-core.ts` sets out at length: Commons is an archive rather than a CDN
 * and answers a browser's third or fourth request with 429. That reasoning is
 * far sharper here than it was for stadiums — a stadium page shows one
 * photograph, but opening several player cards in a row is the ordinary way to
 * read the Jogadores page.
 *
 * Keyed by **player id**, which is already the player's identity and is unique
 * by construction, unlike the name. The Commons title stays in the data as the
 * *source*, and `playerPhotoPage` still links to it — the licence requires that
 * link, and vendoring the bytes does not vendor the attribution.
 */
export const playerPhotoUrl = (id: string, width: number): string =>
  `/players/${id}-${width}.jpg`;

/**
 * The file's description page — where the licence, the photographer and the
 * upload history live. Every Creative Commons licence in use asks the reuser to
 * point back at the work, and this is that link.
 *
 * Spaces become underscores because a Commons page title is written that way in
 * a URL, and `encodeURIComponent` runs **after** the substitution so it does not
 * percent-encode the underscores it just introduced.
 */
export const playerPhotoPage = (photo: PlayerPhoto): string =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.file.replace(/ /g, "_"))}`;

/**
 * Month abbreviations, written down rather than taken from `Intl`.
 *
 * `Intl.DateTimeFormat("pt-BR", { month: "short" })` would answer this, and its
 * answer is whatever ICU the host was built against says — which is a moving
 * target across Node releases and, on a trimmed container image, may be `en`
 * with no error at all. A unit test pinning "13 fev. 1994" would then fail on a
 * machine the code is correct on, and — worse — a production card would print
 * "Feb" without anything going red. Twelve strings are cheaper than that.
 */
const MONTHS_PT = [
  "jan.",
  "fev.",
  "mar.",
  "abr.",
  "mai.",
  "jun.",
  "jul.",
  "ago.",
  "set.",
  "out.",
  "nov.",
  "dez.",
];

/**
 * A birth date as a reader writes one — "13 fev. 1994".
 *
 * Read in **UTC**, like `ageOn` and for the same reason: the upstream sends a
 * bare `1994-02-13`, which `Date` parses as UTC midnight, and formatting that
 * through a local calendar moves the day back by one for every reader west of
 * Greenwich. Brazil is UTC-3, so this is not a hypothetical — it would be
 * wrong for every reader the app has.
 *
 * Null for a missing or unparseable date, the same contract `ageOn` and
 * `positionLabel` keep: an absent value renders as no row rather than a dash.
 */
export const birthDateLabel = (dateOfBirth: string | undefined): string | null => {
  if (!dateOfBirth) return null;

  const born = new Date(dateOfBirth);
  if (Number.isNaN(born.getTime())) return null;

  return `${born.getUTCDate()} ${MONTHS_PT[born.getUTCMonth()]} ${born.getUTCFullYear()}`;
};

/**
 * Where to go looking for a player the app holds little about.
 *
 * The card knows a name, a club and — when the provider answers — a position
 * and a birth date. It will never know what a reader who opened it actually
 * wanted, which is usually *news*. Two search links cost no data, no upstream
 * request and no curation, and they are the only part of this card that works
 * for all ~950 players rather than for the handful with a curated entry.
 *
 * The name is quoted so a search for "Pedro" does not return the whole
 * division, and the club is appended for the same reason — the snapshot has two
 * players called Dudu at one club, and pt-BR football is full of one-word
 * names. `hl`/`gl` ask for Brazilian results, because a player's news is in
 * Portuguese and a reader in São Paulo should not have to say so.
 *
 * `tbm=nws` is the news tab of the same query rather than a second query, so
 * the two links cannot drift apart.
 */
export const playerSearchUrls = (
  name: string,
  clubName?: string,
): { google: string; news: string } => {
  const terms = [`"${name.trim()}"`, clubName?.trim(), "futebol"].filter(Boolean).join(" ");
  const google = `https://www.google.com/search?q=${encodeURIComponent(terms)}&hl=pt-BR&gl=BR`;

  return { google, news: `${google}&tbm=nws` };
};
