import type { ReactElement } from "react";

import {
  LiveIcon,
  MatchesIcon,
  PlayersIcon,
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
 * `clube`, `partida` and `estadio` are detail views reached by choosing
 * something, not menu entries — none has meaning without a selection, so all
 * three are absent from NAV_ITEMS on purpose. `estadio` in particular could
 * have been a fifth destination and deliberately is not — a stadium is
 * something you arrive at from a match, not a section you set out to browse.
 * `jogadores` took that fifth slot instead, and it is now the last one: see
 * the bound on NAV_ITEMS below.
 */
export type SectionId =
  | "classificacao"
  | "ao-vivo"
  | "jogos"
  | "artilharia"
  | "jogadores"
  | "clube"
  | "partida"
  | "estadio"
  /**
   * `conta` and `entrar` are not destinations either, and for a different
   * reason than the three above: those are drill-downs into something chosen,
   * while these are the reader's own account, reached from a persistent
   * affordance in the top app bar. They are absent from NAV_ITEMS because the
   * bar is **full** at MD3's maximum of five — but they would not belong in it
   * at six, which is the point. An account is not a section of a football
   * portal.
   */
  | "conta"
  | "entrar";

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
 * There are now **five** — Jogadores took the last one. The bar is **full**: a
 * sixth entry puts it off-spec, and off-spec here means crowded rather than
 * broken, so nothing fails, no test goes red and nobody notices. A sixth
 * section wants a different pattern (MD3's navigation drawer), not a sixth
 * entry here.
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
  {
    // Last, and the fifth of five. It is the least time-sensitive destination
    // in the bar — an elenco moves in a transfer window, everything to its left
    // moves every weekend.
    id: "jogadores",
    label: "Jogadores",
    description: "Elencos de todos os clubes da Série A",
    Icon: PlayersIcon,
  },
];

export const DEFAULT_SECTION: SectionId = "classificacao";
