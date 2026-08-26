/**
 * Pure player display logic. No I/O, no React — translation and age are total
 * functions over their inputs (tests/player-core.test.ts).
 */
import { instagramHandle, wikipediaUrl } from "@/club-core";
import type { Player } from "@/src/types";

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
