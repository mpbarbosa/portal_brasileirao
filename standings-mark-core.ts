/**
 * What the Classificação's mark column shows — the **Campanha**, or the
 * **Forma**.
 *
 * Pure: a stored string in, a kind out (tests/standings-mark-core.test.ts). The
 * shape is `campaign-plot-core.ts`'s to the letter, which is to say
 * `theme-core.ts`'s: a storage key, a parser that tolerates junk, the opposite
 * of a value, and the pt-BR label of the control that switches to it.
 *
 * **It is a second module rather than a third member of `CampaignPlotKind`, and
 * that is the decision this file exists to record.** The two look like one
 * choice and are not:
 *
 * - A **plot kind** says how a campanha is *drawn*, and #235 made it global on
 *   purpose — "the campanha is one mark everywhere, not one per page" — so it
 *   governs the Clube page and the Partida page as well as this column. Adding
 *   `forma` to that union would put pill strips on both: on the Clube page
 *   directly above its own **Últimos resultados**, which is the same five
 *   results twice, eight lines apart.
 * - This says what *this column* holds. There is no campanha column anywhere
 *   else, so there is nothing for it to govern beyond the table.
 *
 * Two questions, two lifetimes, two keys. When the column shows the campanha,
 * the global plot kind still decides whether it is a line or bars — the choices
 * compose rather than competing.
 */

/** The two things the column can show. `campanha` is what it held before this. */
export type StandingsMarkKind = "campanha" | "forma";

export const STANDINGS_MARK_STORAGE_KEY = "portal-brasileirao:classificacao-marca";

/**
 * Narrow an unknown stored value to a kind.
 *
 * Falls back to `campanha` rather than to null, for `parsePlotKind`'s reason:
 * there is no system setting to defer to, so an absent or corrupt value means
 * "the reader has never chosen" and the answer to that is the column the table
 * has always drawn.
 */
export const parseMarkKind = (value: string | null | undefined): StandingsMarkKind =>
  value === "forma" ? "forma" : "campanha";

export const otherMarkKind = (kind: StandingsMarkKind): StandingsMarkKind =>
  kind === "campanha" ? "forma" : "campanha";

/**
 * The column heading for a kind — what the column *is*, not what pressing
 * something would do.
 */
export const markColumnLabel = (kind: StandingsMarkKind): string =>
  kind === "campanha" ? "Campanha" : "Forma";

/**
 * pt-BR label for the control that switches *to* the other kind.
 *
 * Names the destination rather than the current state, which is
 * `themeToggleLabel`'s contract and `plotKindToggleLabel`'s: a one-button
 * toggle is read as "press this to get that", and the column heading beside it
 * is what shows where you are.
 */
export const markToggleLabel = (kind: StandingsMarkKind): string =>
  kind === "campanha" ? "Ver a forma" : "Ver a campanha";
