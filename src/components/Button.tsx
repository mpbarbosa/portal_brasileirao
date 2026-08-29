import type { ButtonHTMLAttributes, Ref } from "react";

import { STATE_LAYER, TOUCH_TARGET } from "./interaction";

/**
 * Sizes actually in use, rather than a speculative scale.
 *
 * `md` is the default for standalone controls; `sm` suits a control tucked
 * inside something else, like a dialog's dismiss; `xs` is for a control sitting
 * flush against another, like the round stepper beside its picker.
 */
export type ControlSize = "xs" | "sm" | "md";

const PADDING: Record<ControlSize, string> = {
  xs: "px-2 py-1.5",
  sm: "px-2.5 py-1",
  md: "px-3 py-2",
};

/**
 * Emphasis, in Material Design 3's sense: how loudly a control asks to be used.
 *
 * Only the two the app actually has a use for. MD3 also defines *filled*,
 * *elevated* and *text*, and they are absent for the same reason the size list
 * above is short — nothing renders them, and a variant with no call site is a
 * guess about the future that later has to be maintained or deleted.
 *
 * `outlined` is every control that was here before M2: the round stepper, the
 * theme toggle, the menu toggle, the dialog's dismiss.
 *
 * `tonal` is for the one place the app already drew a distinction in prose but
 * not in pixels — a *curated* highlights link versus the search fallback beside
 * it. The comment at that call site has always said one is a real answer and the
 * other is a guess; they rendered identically until M4.
 */
export type ControlVariant = "outlined" | "tonal";

/**
 * `tonal` takes MD3's pill, `outlined` keeps the shape scale it already had.
 *
 * That split is deliberate rather than half-finished. A fully rounded control
 * beside a right-aligned `tabular-nums` column reads as floating, because the
 * eye takes the pill's widest point as its edge while the number's edge is the
 * glyph box — and the round stepper and the goals link both sit against tables.
 * The tonal links sit in open prose, where nothing is there to misalign with.
 */
const VARIANT: Record<ControlVariant, string> = {
  outlined: "rounded-small border border-outline text-on-surface-variant",
  tonal: "rounded-full bg-secondary-container text-on-secondary-container",
};

/**
 * Which of MD3's two ways of reaching the 48dp touch target a control takes.
 *
 * `grow` puts the floor on the box, so the control itself becomes 48dp. That
 * is right for every control with room to grow, and it is what M9 gave the
 * round stepper, its picker and the highlights links.
 *
 * `overflow` keeps the box at whatever size it was drawn and hangs the target
 * off it — see `TOUCH_TARGET`. It exists for the top app bar, where the bar is
 * 56dp and MD3's own size for a trailing icon button is 40dp: growing the box
 * there does not level the group, it just makes one member of it taller than
 * the size the spec names.
 *
 * Defaulting to `grow` is what keeps this an exemption a call site has to ask
 * for rather than a floor that quietly stopped applying.
 */
export type TouchTargetMode = "grow" | "overflow";

const TARGET: Record<TouchTargetMode, string> = {
  // A minimum rather than a height, so a control that is legitimately taller —
  // a two-line label, a larger glyph — is not clamped down to the floor.
  // `min-w` is a no-op on every text control and does the work on the icon
  // ones, which is why one pair of utilities covers both.
  grow: "min-h-12 min-w-12",
  overflow: TOUCH_TARGET,
};

/**
 * The app's control chrome.
 *
 * Exported separately from `Button` because not every control is a `<button>`:
 * the goals link is an anchor and the round picker is a `<select>`, and both
 * should look identical to the buttons beside them. Wrapping those in a
 * polymorphic component would cost more in types than it saves.
 *
 * The disabled styling is harmless on elements that cannot be disabled, and
 * saves every caller from remembering it on the ones that can.
 */
export const controlClasses = (
  size: ControlSize = "md",
  extra = "",
  variant: ControlVariant = "outlined",
  target: TouchTargetMode = "grow",
): string =>
  [
    "text-body-medium",
    // MD3's minimum touch target is 48dp, and every control here was under it:
    // the round stepper measured 34x32, its picker 32x61, the highlights links
    // 36 and 40 tall. Measured at 375dp rather than reasoned about, in the
    // manner the nav bar's width arithmetic already is.
    //
    // Which of the two ways a control reaches it is `TARGET` above — and it is
    // a parameter rather than something a call site can override through
    // `extra`, because it cannot: `min-h-12` here and an `h-10` passed in have
    // equal specificity, so *stylesheet* order decides which wins and the
    // caller's intent has nothing to do with it. That is not hypothetical; it
    // is what happened to the theme toggle between #173 and #174.
    //
    // Buttons and selects centre their own content against a taller box; the
    // three anchors that use this already carry `inline-flex items-center`, and
    // a new one must too — `min-height` does nothing to an inline box.
    TARGET[target],
    VARIANT[variant],
    // Hover, focus and pressed all come from one place — see `interaction.ts`.
    // Before M2 this was a bare `hover:bg-raised` with no focus state at all.
    STATE_LAYER,
    "disabled:cursor-not-allowed disabled:opacity-40",
    PADDING[size],
    extra,
  ]
    .filter(Boolean)
    .join(" ");

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ControlSize;
  variant?: ControlVariant;
  target?: TouchTargetMode;
  /** React 19 passes refs as ordinary props, so no forwardRef wrapper. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A button.
 *
 * Defaults `type` to `"button"`: the HTML default is `"submit"`, which inside a
 * form silently submits it. None of these controls are submits.
 */
export function Button({
  size = "md",
  variant = "outlined",
  target = "grow",
  className = "",
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={controlClasses(size, className, variant, target)}
      {...props}
    />
  );
}
