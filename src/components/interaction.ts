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
 * MD3's 48dp touch target, without changing what the control looks like.
 *
 * The two are different rules and the header is where that stops being pedantry.
 * MD3 gives a top-app-bar control a **40dp container** and a **48dp touch
 * target**: the box you see and the area a thumb can find are not the same
 * thing. M9 put the floor on the box — `min-h-12` in `controlClasses` — which
 * made every target 48 and, because **`min-height` beats `height` whatever the
 * order**, silently overrode the `h-10` that had just levelled the trailing
 * group. The toggle rendered 48 beside a 40 account control: two PRs each
 * right, and an 8px wobble on production between them.
 *
 * Measured there, at `844cb15`: toggle 48x48, account control 40x97.
 *
 * So the target moves off the box and onto a pseudo-element. It is centred and
 * at least 48 in both axes, and `w-full` lets a control wider than that keep
 * its own width rather than being given a target narrower than itself.
 *
 * Generated content participates in hit testing and its events target the
 * element that owns it, so this really is a bigger target and not a decoration.
 * The owner needs `relative`, which `controlClasses` and both account controls
 * set.
 *
 * Note what this does *not* fix: a control whose visible box is small is still
 * a small thing to look at. That is a design choice per control — 40dp in the
 * bar because MD3 says so and someone measured it, 48dp for the body controls
 * because nothing argued for less.
 */
export const TOUCH_TARGET = [
  "before:absolute before:left-1/2 before:top-1/2",
  "before:h-12 before:min-w-12 before:w-full",
  "before:-translate-x-1/2 before:-translate-y-1/2",
  "before:content-['']",
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
  // `inline-flex` and a 48dp minimum: this is a standalone control on its own
  // line, not a link inside a sentence, so MD3's touch-target floor applies to
  // it the way it applies to a button. It measured **20px** tall. The minimum
  // is on the box and not on the type, so the glyphs are unchanged and only the
  // area a thumb can find grows.
  "inline-flex min-h-12 items-center",
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
