import type { ButtonHTMLAttributes, Ref } from "react";

import { STATE_LAYER } from "./interaction";

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
