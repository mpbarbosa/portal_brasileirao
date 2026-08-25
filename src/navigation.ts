import type { ReactElement } from "react";

import {
  LiveIcon,
  MatchesIcon,
  ScorersIcon,
  StandingsIcon,
} from "@/src/components/SectionIcons";

/**
 * The app's sections, in the order they appear in the nav bar.
 *
 * Single source of truth for navigation: adding a section means adding an entry
 * here and a case in `App`'s view switch — the nav bar itself needs no change.
 * That is why the icon lives on the entry rather than in a lookup inside
 * `NavBar`; see the note on `Icon` below.
 */
/**
 * `clube` is a detail view reached by choosing a club, not a menu entry — it has
 * no meaning without a selection, so it is absent from NAV_ITEMS on purpose.
 */
export type SectionId =
  | "classificacao"
  | "ao-vivo"
  | "jogos"
  | "artilharia"
  | "clube"
  | "partida";

export interface NavItem {
  id: SectionId;
  label: string;
  /** Used as the nav link's title, and read out by assistive tech. */
  description: string;
  /**
   * The glyph the navigation bar draws above the label.
   *
   * Held here rather than looked up by id inside `NavBar`, so that adding a
   * section still means an entry in this list and nothing else — the promise
   * `CLAUDE.md` makes. A lookup in `NavBar` would break it silently.
   */
  Icon: (props: { className?: string }) => ReactElement;
}

/**
 * Material Design 3's navigation bar carries **three to five** destinations.
 * There are four. **One** more can be added before the pattern stops fitting,
 * and at the sixth the bar is off-spec — crowded rather than broken, so nothing
 * fails and nobody notices. A sixth section wants a different pattern (MD3's
 * navigation drawer), not a sixth entry here.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    id: "classificacao",
    label: "Classificação",
    description: "Tabela do Campeonato Brasileiro Série A",
    Icon: StandingsIcon,
  },
  {
    // Second rather than first: "/" is the Classificação, and a destination
    // that is not the home page should not sit where the home page's tab does.
    // It is still ahead of Jogos, because "what is being played now" is the
    // more urgent question of the two.
    id: "ao-vivo",
    label: "Ao vivo",
    description: "Jogos em andamento, próximos e resultados recentes",
    Icon: LiveIcon,
  },
  {
    id: "jogos",
    label: "Jogos",
    description: "Partidas de qualquer rodada",
    Icon: MatchesIcon,
  },
  {
    id: "artilharia",
    label: "Artilharia",
    description: "Maiores goleadores do campeonato",
    Icon: ScorersIcon,
  },
];

export const DEFAULT_SECTION: SectionId = "classificacao";
