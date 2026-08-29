/**
 * Which mark the **Campanha** column draws — a line, or a column of bars.
 *
 * Pure: a stored string in, a kind out (tests/campaign-plot-core.test.ts). The
 * shape is `theme-core.ts`'s, deliberately and to the letter: a storage key, a
 * parser that tolerates junk, the opposite of a value, and the pt-BR label of
 * the control that switches to it. Both are the same kind of thing — a reader's
 * choice about how this device draws the page, held in `localStorage` and never
 * on the server.
 *
 * That last point is the decision rather than a default. `preferences-core.ts`
 * carries the keys an *account* owns, and CLAUDE.md's rule for which side owns a
 * key is "ask which side owns it before asking how to reconcile it". A plot kind
 * is owned by the device for the same reason the theme is: it is a property of
 * the screen being read, not of the person reading. Nothing here needs a merge
 * rule, because there is no second side that can hold a value.
 */

/** The two marks. `line` is what the column drew before this choice existed. */
export type CampaignPlotKind = "line" | "bars";

export const CAMPAIGN_PLOT_STORAGE_KEY = "portal-brasileirao:campanha-plot";

/**
 * Narrow an unknown stored value to a kind.
 *
 * Falls back to `line` rather than to null: unlike the theme, there is no system
 * setting to defer to, so an absent or corrupt value means "the reader has never
 * chosen" and the answer to that is the mark the column has always drawn.
 */
export const parsePlotKind = (value: string | null | undefined): CampaignPlotKind =>
  value === "bars" ? "bars" : "line";

export const otherPlotKind = (kind: CampaignPlotKind): CampaignPlotKind =>
  kind === "line" ? "bars" : "line";

/**
 * pt-BR label for the control that switches *to* the other mark.
 *
 * Names the destination, not the current state, which is what
 * `themeToggleLabel` does and for the same reason: a one-button toggle is read
 * as "press this to get that", and the page itself already shows which mark is
 * on. **Campanha** and both mark names come from `CONTEXT.md`.
 */
export const plotKindToggleLabel = (current: CampaignPlotKind): string =>
  current === "line" ? "Ver a campanha em barras" : "Ver a campanha em linha";
