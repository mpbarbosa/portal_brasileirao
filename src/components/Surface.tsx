import type { ElementType, ReactNode } from "react";

interface SurfaceProps {
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
 */
export function Surface({ children, as, filled = false, className = "" }: SurfaceProps) {
  const Tag = as ?? "div";
  const classes = ["rounded-lg border border-line", filled ? "bg-surface/50" : "", className]
    .filter(Boolean)
    .join(" ");

  return <Tag className={classes}>{children}</Tag>;
}
