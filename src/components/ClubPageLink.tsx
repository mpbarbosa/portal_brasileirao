import type { ReactNode } from "react";

import { clubKey } from "@/club-core";
import { formatRoute } from "@/route-core";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { isPlainClick } from "@/src/components/plainClick";
import type { Club } from "@/src/types";

/**
 * A link to a club's own page, from anywhere a club is named.
 *
 * The contract is three things that have to agree: a real `href`, so
 * middle-click and "open in new tab" work; a click handler that navigates in
 * place for a plain click and **bails out for a modified one**, through the one
 * `isPlainClick`; and the key both of them use, which is `clubKey` rather than
 * the code, so a club's URL says its slug. The Classificação, the Números da
 * temporada, the Curiosidades, the stadium's Mandantes and the scoreboard each
 * wrote that anchor out, and a copy is how one of them comes to push a code
 * where the others push a slug.
 *
 * Layout belongs to the caller, which is `Surface`'s rule: a truncating name in
 * a list and a centred one on a scoreboard want different classes around the
 * same link.
 */
export function ClubPageLink({
  club,
  onSelectClub,
  className = "",
  children,
}: {
  club: Club;
  onSelectClub: (key: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const key = clubKey(club);

  return (
    <a
      href={formatRoute({ section: "clube", key })}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onSelectClub(key);
      }}
      className={[className, LINK_UNDERLINE].filter(Boolean).join(" ")}
    >
      {children}
    </a>
  );
}
