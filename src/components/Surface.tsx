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
 * **In MD3's terms this is a fourth card, and naming that is the honest close
 * rather than refactoring it into three.** MD3 has *elevated*, *filled* and
 * *outlined* cards. This is outlined chrome — border, no shadow — that
 * optionally takes the **filled** variant's container colour, which is neither.
 * It works, every card in the app is consistent because they all come through
 * here, and splitting it into three components where the app renders one shape
 * would be a vocabulary with two speakers and a guess about the third. If a
 * genuinely elevated card ever arrives, it takes `shadow-level-1` and this
 * comment is where to record the split.
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
  const classes = ["rounded-small border border-outline-variant", filled ? "bg-surface-container-low" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
