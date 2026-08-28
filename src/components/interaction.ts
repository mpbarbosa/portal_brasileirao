/**
 * How a control reacts to being pointed at, focused or pressed.
 *
 * Material Design 3 models this as a *state layer*: a translucent veil of the
 * container's own "on" colour, at a fixed opacity per state, rather than a
 * different background colour invented per component. That is what stops one
 * control hovering to a slightly different grey than the one beside it — which
 * is what this codebase had, along with a `transition` on some and not others.
 *
 * These are plain string constants rather than a function taking a colour,
 * because Tailwind extracts class names by scanning source text: a template
 * literal like `hover:bg-${role}/8` produces no CSS at all. Every class here
 * has to appear literally somewhere for the utility to exist.
 */

/**
 * The keyboard focus indicator, kept separate from the state layer on purpose.
 *
 * They were one constant first, and that was a bug: the current nav entry is a
 * filled chip that takes no veil, so excluding it from the state layer silently
 * excluded it from the focus ring too, and it fell back to the browser's 1px
 * default. Anything focusable needs this; only things with a container need the
 * veil. Composing them separately is what stops that pairing being accidental.
 *
 * Offset by 2px so the ring sits *outside* the control, on the page rather than
 * on the control's own fill — which is what keeps it legible on the filled chip,
 * where `primary` against a near-white chip would barely register.
 */
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * MD3's state layer opacities: 8% hover, 10% focus, 10% pressed.
 *
 * `on-surface` is the right veil for every control in this app, because they
 * all sit on a surface. A control on a filled `primary` container would need
 * `on-primary` instead — write a second constant when that day comes rather
 * than making this one dynamic, for the extraction reason above.
 *
 * A 10% veil is not a focus indicator on its own, so `FOCUS_RING` rides along
 * here for the controls that take both.
 */
export const STATE_LAYER = [
  "transition",
  "hover:bg-on-surface/8",
  "focus-visible:bg-on-surface/10",
  "active:bg-on-surface/10",
  FOCUS_RING,
].join(" ");

/**
 * A text link inside running copy or a table cell.
 *
 * Underlined at rest and brightened on hover, which is the pattern five of the
 * six links already used. The sixth — the club name in a match row — underlined
 * with `line-strong` and hovered to `ink-muted`, a step darker at both ends for
 * no reason anyone recorded. Unified here rather than left as a difference a
 * reader would have to assume was deliberate.
 *
 * Not a state layer: MD3's veils are for controls with a container, and a veil
 * behind an inline word in a table cell reads as a highlight rather than a
 * hover. The underline is the affordance, so the underline is what changes.
 */
export const LINK_UNDERLINE = [
  "underline decoration-ink-ghost underline-offset-2",
  "transition hover:decoration-on-surface-variant",
  FOCUS_RING,
].join(" ");

/**
 * The "voltar" control at the top of a detail view.
 *
 * Bare text rather than bordered chrome, so it takes no state layer — a veil
 * with no padding to sit in would hug the glyphs. It brightens instead, which
 * is what all four call sites already did; they are shared here so they cannot
 * drift apart.
 */
export const BACK_LINK = [
  "text-body-medium text-ink-muted transition hover:text-on-surface-variant",
  FOCUS_RING,
].join(" ");

/**
 * The veil for a control filled with `primary-container`, and the day the note
 * above anticipated.
 *
 * `STATE_LAYER` veils with `on-surface`, which is right for every control that
 * sits *on* a surface and wrong for one that supplies its own fill: a dark veil
 * over a filled container muddies the fill instead of lightening it, and on the
 * light theme the two are close enough that hover stops reading at all. MD3's
 * rule is that the veil is the container's own "on" colour, so a filled control
 * takes the pair it was filled from.
 *
 * A second constant rather than a parameterised one, for the extraction reason
 * at the top of this file: `hover:bg-${role}/8` generates no CSS whatsoever.
 */
export const STATE_LAYER_ON_PRIMARY_CONTAINER = [
  "transition",
  "hover:bg-on-primary-container/8",
  "focus-visible:bg-on-primary-container/10",
  "active:bg-on-primary-container/10",
  FOCUS_RING,
].join(" ");
