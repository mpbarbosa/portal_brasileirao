import type { ButtonHTMLAttributes, Ref } from "react";

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
 * The app's bordered control chrome.
 *
 * Exported separately from `Button` because not every control is a `<button>`:
 * the goals link is an anchor and the round picker is a `<select>`, and both
 * should look identical to the buttons beside them. Wrapping those in a
 * polymorphic component would cost more in types than it saves.
 *
 * The disabled styling is harmless on elements that cannot be disabled, and
 * saves every caller from remembering it on the ones that can.
 */
export const controlClasses = (size: ControlSize = "md", extra = ""): string =>
  [
    "rounded-lg border border-line-strong text-sm text-ink-soft transition",
    "hover:bg-raised disabled:cursor-not-allowed disabled:opacity-40",
    PADDING[size],
    extra,
  ]
    .filter(Boolean)
    .join(" ");

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ControlSize;
  /** React 19 passes refs as ordinary props, so no forwardRef wrapper. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * A bordered button.
 *
 * Defaults `type` to `"button"`: the HTML default is `"submit"`, which inside a
 * form silently submits it. None of these controls are submits.
 */
export function Button({ size = "md", className = "", type, ...props }: ButtonProps) {
  return <button type={type ?? "button"} className={controlClasses(size, className)} {...props} />;
}
