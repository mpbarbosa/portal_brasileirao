import type { Club } from "@/src/types";

interface ClubCrestProps {
  club: Club;
  /** Rendered pixel size; the source PNGs are small, so keep this modest. */
  size?: number;
}

/**
 * A club's crest, or nothing at all.
 *
 * Decorative by design: every crest sits beside the club's name in text, so
 * announcing it again would just make a screen reader say the club twice. Hence
 * `alt=""` rather than a description.
 *
 * Crests come from the data provider's CDN as transparent PNGs, which is why
 * they sit correctly on a dark background. Lazy and async so a 20-row table
 * does not block paint on twenty image requests.
 */
export function ClubCrest({ club, size = 20 }: ClubCrestProps) {
  if (!club.crest) return null;

  return (
    <img
      src={club.crest}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className="inline-block shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
