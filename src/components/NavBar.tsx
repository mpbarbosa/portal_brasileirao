import { useEffect, useRef, useState } from "react";

import { NAV_ITEMS, type SectionId } from "@/src/navigation";

interface NavBarProps {
  current: SectionId;
  onSelect: (id: SectionId) => void;
}

/**
 * Sticky header with the brand and the section menu.
 *
 * The menu collapses behind a toggle below the `sm` breakpoint. Both the
 * desktop list and the collapsed panel render the same buttons, so a section is
 * reachable at any width — the difference is only whether the list is visible
 * without a tap.
 */
export function NavBar({ current, onSelect }: NavBarProps) {
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

  const select = (id: SectionId) => {
    onSelect(id);
    setOpen(false);
  };

  const itemClass = (id: SectionId, block: boolean) =>
    [
      "rounded-lg px-3 py-2 text-sm font-medium transition",
      block ? "block w-full text-left" : "",
      id === current
        ? "bg-slate-100 text-slate-900"
        : "text-slate-300 hover:bg-slate-800 hover:text-slate-100",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight">Portal Brasileirão</p>
          <p className="truncate text-xs text-slate-400">Campeonato Brasileiro Série A</p>
        </div>

        {/* Desktop: the sections sit inline. No `title` — a tooltip never
            appears on touch, and it competes with the visible label for the
            accessible name, which breaks "click <label>" voice control. The
            description is shown as real text in the collapsed panel instead. */}
        <nav className="hidden gap-1 sm:flex" aria-label="Seções">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => select(item.id)}
              aria-current={item.id === current ? "page" : undefined}
              className={itemClass(item.id, false)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Mobile: the same sections behind a toggle. */}
        <button
          ref={toggleRef}
          type="button"
          className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 sm:hidden"
          aria-expanded={open}
          aria-controls="menu-secoes"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((value) => !value)}
        >
          <span aria-hidden="true">{open ? "✕" : "☰"}</span>
        </button>
      </div>

      <div
        id="menu-secoes"
        ref={panelRef}
        hidden={!open}
        className="border-t border-slate-800 sm:hidden"
      >
        <nav className="mx-auto max-w-3xl space-y-1 px-4 py-3" aria-label="Seções">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => select(item.id)}
              aria-current={item.id === current ? "page" : undefined}
              className={itemClass(item.id, true)}
            >
              <span className="block">{item.label}</span>
              <span className="block text-xs font-normal text-slate-400">
                {item.description}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
