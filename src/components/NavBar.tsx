import { useEffect, useRef, useState } from "react";

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
 * Sticky header with the brand and the section menu.
 *
 * The menu collapses behind a toggle below the `sm` breakpoint. Both the
 * desktop list and the collapsed panel render the same buttons, so a section is
 * reachable at any width — the difference is only whether the list is visible
 * without a tap.
 */
export function NavBar({ current, onNavigate, theme, onToggleTheme }: NavBarProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Escape closes the menu and returns focus to the control that opened it —
  // otherwise focus is stranded on a hidden element.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !toggleRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  /**
   * Entries are real links, so middle-click and "open in new tab" work. Only a
   * plain left-click is intercepted; modified clicks fall through to the
   * browser.
   */
  const select = (event: React.MouseEvent, id: SectionId) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    onNavigate(routeFor(id));
    setOpen(false);
  };

  const itemClass = (id: SectionId, block: boolean) =>
    [
      "rounded-small px-3 py-2 text-sm font-medium",
      block ? "block w-full text-left" : "",
      // The current entry is a filled chip and needs no veil — but it is still
      // focusable, so it takes the ring on its own. Folding the ring into the
      // state layer left this one entry with the browser's 1px default.
      id === current
        ? `bg-ink text-ink-inverted ${FOCUS_RING}`
        : `text-ink-soft ${STATE_LAYER}`,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight">Portal Brasileirão</p>
          <p className="truncate text-xs text-ink-muted">Campeonato Brasileiro Série A</p>
        </div>

        {/* Desktop: the sections sit inline. No `title` — a tooltip never
            appears on touch, and it competes with the visible label for the
            accessible name, which breaks "click <label>" voice control. The
            description is shown as real text in the collapsed panel instead. */}
        <nav className="hidden gap-1 sm:flex" aria-label="Seções">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={formatRoute(routeFor(item.id))}
              onClick={(event) => select(event, item.id)}
              aria-current={item.id === current ? "page" : undefined}
              className={itemClass(item.id, false)}
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
          <span aria-hidden="true">{theme === "light" ? "\u263D" : "\u2600"}</span>
        </Button>

        {/* Mobile: the same sections behind a toggle. */}
        <Button
          ref={toggleRef}
          className="sm:hidden"
          aria-expanded={open}
          aria-controls="menu-secoes"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">{open ? "✕" : "☰"}</span>
        </Button>
      </div>

      <div
        id="menu-secoes"
        ref={panelRef}
        hidden={!open}
        className="border-t border-line sm:hidden"
      >
        <nav className="mx-auto max-w-3xl space-y-1 px-4 py-3" aria-label="Seções">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={formatRoute(routeFor(item.id))}
              onClick={(event) => select(event, item.id)}
              aria-current={item.id === current ? "page" : undefined}
              className={itemClass(item.id, true)}
            >
              <span className="block">{item.label}</span>
              <span className="block text-xs font-normal text-ink-muted">
                {item.description}
              </span>
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
