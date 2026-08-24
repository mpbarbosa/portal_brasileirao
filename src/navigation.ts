/**
 * The app's sections, in the order they appear in the nav bar.
 *
 * Single source of truth for navigation: adding a section means adding an entry
 * here and a case in `App`'s view switch — the nav bar itself needs no change.
 */
export type SectionId = "classificacao" | "rodada" | "artilharia";

export interface NavItem {
  id: SectionId;
  label: string;
  /** Used as the nav link's title, and read out by assistive tech. */
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: "classificacao",
    label: "Classificação",
    description: "Tabela do Campeonato Brasileiro Série A",
  },
  {
    id: "rodada",
    label: "Rodada",
    description: "Jogos da rodada atual",
  },
  {
    id: "artilharia",
    label: "Artilharia",
    description: "Maiores goleadores do campeonato",
  },
];

export const DEFAULT_SECTION: SectionId = "classificacao";
