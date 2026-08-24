/**
 * The app's sections, in the order they appear in the nav bar.
 *
 * Single source of truth for navigation: adding a section means adding an entry
 * here and a case in `App`'s view switch — the nav bar itself needs no change.
 */
/**
 * `clube` is a detail view reached by choosing a club, not a menu entry — it has
 * no meaning without a selection, so it is absent from NAV_ITEMS on purpose.
 */
export type SectionId =
  | "classificacao"
  | "jogos"
  | "artilharia"
  | "clube"
  | "partida";

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
    id: "jogos",
    label: "Jogos",
    description: "Partidas de qualquer rodada",
  },
  {
    id: "artilharia",
    label: "Artilharia",
    description: "Maiores goleadores do campeonato",
  },
];

export const DEFAULT_SECTION: SectionId = "classificacao";
