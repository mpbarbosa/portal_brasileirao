import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

interface SurfaceProps extends Omit<ComponentPropsWithoutRef<"div">, "className"> {
  children: ReactNode;
  /**
   * Element to render. Defaults to `div`; pass `"li"` inside a list so the
   * chrome does not require an extra wrapper element.
   */
  as?: ElementType;
  /**
   * Fill the surface. Cards are filled; a table container is not — the table
   * inside supplies its own header background, and filling would double it.
   */
  filled?: boolean;
  className?: string;
}

/**
 * The app's raised panel: rounded corners and a hairline border.
 *
 * Exists because that chrome was hand-repeated in five components, which is how
 * a border ends up `line` in four places and `line-strong` in the fifth. Padding
 * and layout stay with the caller — those genuinely differ per use, and folding
 * them in here would mean a prop per variant.
 *
 * Anything else the caller passes reaches the element. Without that, an
 * attribute set on a `Surface` is *silently* dropped: the component renders,
 * the page looks right, and only the selector that depended on the attribute
 * knows. That is how the Ao vivo cards shipped their `data-live-match` hook to
 * nowhere for the length of one test run.
 */
export function Surface({
  children,
  as,
  filled = false,
  className = "",
  ...rest
}: SurfaceProps) {
  const Tag = as ?? "div";
  const classes = ["rounded-small border border-line", filled ? "bg-surface-container-low" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
