import { Button } from "@/src/components/Button";
import { FOCUS_RING, STATE_LAYER } from "@/src/components/interaction";
import { NAV_ITEMS, type SectionId } from "@/src/navigation";
import { formatRoute, type Route } from "@/route-core";
import { themeToggleLabel, type Theme } from "@/theme-core";

interface NavBarProps {
  current: SectionId;
  onNavigate: (route: Route) => void;
  theme: Theme;
  onToggleTheme: () => void;
}

/** The route a menu entry points at. Sections other than these are drill-downs. */
const routeFor = (id: SectionId): Route =>
  id === "jogos" ? { section: "jogos", round: null } : ({ section: id } as Route);

/**
 * Entries are real links, so middle-click and "open in new tab" work. Only a
 * plain left-click is intercepted; modified clicks fall through to the browser.
 */
const isPlainClick = (event: React.MouseEvent) =>
  !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;

/**
 * The destinations on a phone: Material Design 3's navigation bar.
 *
 * Replaces a toggle that hid three links behind a hamburger — the arrangement
 * this pattern exists to correct. Three destinations are few enough to show at
 * once, and at the bottom edge they sit under a thumb rather than diagonally
 * across the screen from it.
 *
 * A sibling of the header rather than a child, because it is fixed to the
 * opposite edge; nesting it inside a `sticky` element only invites a
 * stacking-context bug later.
 *
 * MD3 marks the active destination with a pill behind the **icon**, not a fill
 * behind the whole item, which is what keeps the label legible against it.
 * `aria-current="page"` carries the same fact to assistive tech, since a
 * coloured pill says nothing to a screen reader.
 */
function NavigationBar({
  current,
  onSelect,
}: {
  current: SectionId;
  onSelect: (event: React.MouseEvent, id: SectionId) => void;
}) {
  return (
    <nav
      aria-label="Seções"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur sm:hidden"
    >
      <ul className="mx-auto flex max-w-3xl items-stretch justify-around">
        {NAV_ITEMS.map((item) => {
          const active = item.id === current;
          return (
            <li key={item.id} className="flex-1">
              <a
                href={formatRoute(routeFor(item.id))}
                onClick={(event) => onSelect(event, item.id)}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 px-2 pb-2 pt-3 ${
                  active ? `text-ink ${FOCUS_RING}` : `text-ink-muted ${STATE_LAYER}`
                }`}
              >
                {/* The indicator is sized by MD3 rather than by the glyph, so
                    all three line up whatever they happen to draw. */}
                <span
                  className={`flex h-8 w-16 items-center justify-center rounded-full transition ${
                    active ? "bg-secondary-container text-on-secondary-container" : ""
                  }`}
                >
                  <item.Icon className="h-6 w-6" />
                </span>
                <span className="text-label-medium font-medium">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The brand and the section destinations.
 *
 * Two presentations of one model. Above the `sm` breakpoint the destinations sit
 * inline in the header, which is MD3's tab arrangement and what the app has
 * always done. Below it they move to a navigation bar pinned to the bottom of
 * the screen. Both render from `NAV_ITEMS`, so a section is reachable at every
 * width and neither list can drift from the other.
 *
 * Note there is no longer any open/closed state here. The hamburger, its panel,
 * the outside-click listener and the Escape handler all existed to manage a
 * disclosure that no longer exists — three destinations are simply shown.
 */
export function NavBar({ current, onNavigate, theme, onToggleTheme }: NavBarProps) {
  const select = (event: React.MouseEvent, id: SectionId) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onNavigate(routeFor(id));
  };

  /** Desktop: destinations inline in the header, which reads as MD3 tabs. */
  const tabClass = (id: SectionId) =>
    [
      "rounded-small px-3 py-2 text-body-medium font-medium",
      // The current entry is a filled chip and takes no veil — but it is still
      // focusable, so it takes the ring on its own. Folding the ring into the
      // state layer once left this one entry with the browser's 1px default.
      id === current
        ? `bg-ink text-ink-inverted ${FOCUS_RING}`
        : `text-ink-soft ${STATE_LAYER}`,
    ].join(" ");

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-title-medium font-bold">Portal Brasileirão</p>
            <p className="truncate text-body-small text-ink-muted">
              Campeonato Brasileiro Série A
            </p>
          </div>

          {/* No `title` on the destinations — a tooltip never appears on touch,
              and it competes with the visible label for the accessible name,
              which breaks "click <label>" voice control. */}
          <nav className="hidden gap-1 sm:flex" aria-label="Seções">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={formatRoute(routeFor(item.id))}
                onClick={(event) => select(event, item.id)}
                aria-current={item.id === current ? "page" : undefined}
                className={tabClass(item.id)}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <Button
            onClick={onToggleTheme}
            aria-label={themeToggleLabel(theme)}
            title={themeToggleLabel(theme)}
          >
            <span aria-hidden="true">{theme === "light" ? "☽" : "☀"}</span>
          </Button>
        </div>
      </header>

      <NavigationBar current={current} onSelect={select} />
    </>
  );
}
