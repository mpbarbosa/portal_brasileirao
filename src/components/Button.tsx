import type { ButtonHTMLAttributes, Ref } from "react";

import { STATE_LAYER, TOUCH_TARGET } from "./interaction";

/**
 * Sizes actually in use, rather than a speculative scale.
 *
 * `md` is the default for standalone controls; `sm` suits a control tucked
 * inside something else, like a dialog's dismiss; `xs` is for a control sitting
 * flush against another, like the round stepper beside its picker.
 */
export type ControlSize = "xs" | "sm" | "md" | "bar";

const PADDING: Record<ControlSize, string> = {
  xs: "px-2 py-1.5",
  sm: "px-2.5 py-1",
  md: "px-3 py-2",
  bar: "px-2",
};

/**
 * The visible box, which is not the touch target — see `TOUCH_TARGET`.
 *
 * `bar` is MD3's **40dp** top-app-bar control and the only size that states a
 * height: the trailing group was measured at 36, 40 and 38 and levelled at 40
 * deliberately, and a floor of 48 on the box is what undid that. Every other
 * size takes the 48 minimum, because nothing argued for a smaller body control
 * and a stepper at 34x32 was simply too small to hit.
 */
const BOX: Record<ControlSize, string> = {
  xs: "min-h-12 min-w-12",
  sm: "min-h-12 min-w-12",
  md: "min-h-12 min-w-12",
  // `min-w-10` as well as `h-10`: MD3's top-app-bar control is a 40dp *square*
  // for an icon, and `px-2` around a single glyph left the toggle 31 wide —
  // level with its neighbour and visibly narrow beside it.
  bar: "h-10 min-w-10",
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
): string =>
  [
    "text-body-medium",
    // MD3's 48dp touch target, on a pseudo-element rather than on the box, so a
    // size can choose a smaller *visible* control without giving up the target.
    // Every control here was under 48 before M9 measured them at 375dp: the
    // round stepper 34x32, its picker 32x61, the highlights links 36 and 40,
    // the theme toggle 38x39.
    //
    // `relative` is what the pseudo positions against, so it belongs here and
    // not at the call sites.
    //
    // Buttons and selects centre their own content against a taller box; the
    // three anchors that use this already carry `inline-flex items-center`, and
    // a new one must too — `min-height` does nothing to an inline box.
    "relative",
    TOUCH_TARGET,
    BOX[size],
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
  className = "",
  type,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      className={controlClasses(size, className, variant)}
      {...props}
    />
  );
}
