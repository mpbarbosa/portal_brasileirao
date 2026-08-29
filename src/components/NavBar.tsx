import type { ReactNode } from "react";

import { Button } from "@/src/components/Button";
import { FOCUS_RING, STATE_LAYER } from "@/src/components/interaction";
import { NAV_ITEMS, type SectionId } from "@/src/navigation";
import { useScrolled } from "@/src/useScrolled";
import { formatRoute, type Route } from "@/route-core";
import { themeToggleLabel, type Theme } from "@/theme-core";

interface NavBarProps {
  current: SectionId;
  onNavigate: (route: Route) => void;
  theme: Theme;
  onToggleTheme: () => void;
  /**
   * The account affordance, or nothing.
   *
   * Passed in rather than rendered here, because `NavBar` knows about sections
   * and this is not one — and because it must disappear entirely on a host with
   * accounts switched off, which is a fact `NavBar` has no way to learn.
   */
  accountControl?: ReactNode;
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
      /* MD3 puts the navigation bar at level 2. The shadow points downward and
         most of it is off the bottom of the screen, but the level-2 ambient
         light carries a 2px spread and a 6px blur, so the edge that matters —
         the one content scrolls under — does get its separation. The border
         stays: it is what this bar has always used at rest, and removing it is
         a restyle rather than an elevation. */
      className="fixed inset-x-0 bottom-0 z-20 border-t border-outline-variant bg-surface/95 shadow-level-2 backdrop-blur sm:hidden"
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
                /* No horizontal padding, where four destinations could afford
                   `px-2`. An item's minimum width is its 64dp indicator plus
                   whatever padding it carries, and five items at 80dp is 400dp
                   on a 375dp screen — the fifth label was clipped at the edge
                   with no horizontal scroll to reveal it, which is the failure
                   you only see on a phone. The padding is what gave way because
                   MD3 does not specify it, while it does specify the 64x32dp
                   indicator. Measured at 320, 360 and 375dp. */
                className={`flex flex-col items-center gap-1 pb-2 pt-3 ${
                  active ? `text-on-surface ${FOCUS_RING}` : `text-ink-muted ${STATE_LAYER}`
                }`}
              >
                {/* The indicator is sized by MD3 rather than by the glyph, so
                    all five line up whatever they happen to draw.

                    64dp is MD3's width and what every screen from 360dp up
                    gets. Below that the arithmetic simply forbids it: five
                    indicators at 64dp is 320dp exactly, leaving nothing for
                    "Classificação", whose label alone measures 79dp — so on a
                    320dp screen the choice is a narrower indicator or a fifth
                    destination clipped off the edge. It degrades rather than
                    clips, and only where the spec cannot be satisfied at all. */}
                <span
                  className={`flex h-8 w-14 items-center justify-center rounded-full transition min-[360px]:w-16 ${
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
export function NavBar({
  current,
  onNavigate,
  theme,
  onToggleTheme,
  accountControl,
}: NavBarProps) {
  const scrolled = useScrolled();

  const select = (event: React.MouseEvent, id: SectionId) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onNavigate(routeFor(id));
  };

  /**
   * Desktop: destinations inline in the header, drawn as MD3 primary tabs.
   *
   * They were a **filled chip** until M9 — `on-surface` ground with
   * `inverse-on-surface` text, which is an inverse-surface pairing MD3 uses for
   * selection nowhere. The bottom navigation bar in this same component already
   * used the right idiom, so the app stated "selected" two different ways at two
   * breakpoints and a reader crossing the `sm` breakpoint met both.
   *
   * MD3 marks the active tab with the **label in `primary` over a 3dp
   * indicator**, and that is what this is: the indicator is an `after`
   * pseudo-element rather than a border, so it can be inset from the tab's own
   * padding and take MD3's rounded top edge — a `border-b` would run the full
   * box and square off.
   *
   * **The appearance is MD3's; the semantics stay navigation.** No `role="tab"`,
   * because these are links that change the address, and a tab role promises a
   * `tabpanel` relationship and arrow-key selection that do not exist here.
   * `aria-current="page"` is the right announcement and it is what was already
   * there.
   *
   * The active tab keeps the state layer now, where the chip could not take one
   * — a veil of `on-surface` over an `on-surface` ground is invisible. So the
   * ring no longer has to be composed separately for this one entry, though
   * `STATE_LAYER` carries it for both.
   */
  const tabClass = (id: SectionId) =>
    [
      // MD3's tab height is 48dp, which is also the touch-target floor — these
      // are `sm:` and up, and a tablet at 768 is a touch device. `inline-flex`
      // so the label centres against the taller box and the indicator sits
      // clear of it.
      //
      // **`whitespace-nowrap` is redundant today and kept deliberately.** The
      // header has been tight since the fifth section landed, and the trailing
      // group grew by 9px when the theme toggle took the 48dp floor — enough to
      // break "Ao vivo" onto two lines at 1280. The nowrap was the fix written
      // first; the `inline-flex` this height needs turned out to prevent the
      // wrap on its own, because a flex item does not shrink below its
      // min-content width.
      //
      // Measured, all three ways: with **neither**, "Ao vivo" wraps at 640 and
      // the spec goes red; with **either one alone**, it does not. So a green
      // run after deleting one of them is not evidence that it was unnecessary
      // — it is evidence the other is still there. Kept as the statement of
      // intent that survives someone changing the display mode.
      "relative inline-flex min-h-12 items-center whitespace-nowrap",
      // `px-2` until `lg`, and this is the bottom bar's lesson one breakpoint
      // up: MD3 specifies the indicator and not the padding, so the padding is
      // what gives way when the row will not fit.
      //
      // It has to give here because `whitespace-nowrap` took away the layout's
      // escape valve. Signed in at 640, the header used to fit only because
      // "Ao vivo" was free to wrap onto two lines — so the nowrap turned a
      // silent wrap into a 23px horizontal overflow, which the header-fits spec
      // in `contas.spec.ts` caught. `px-2` on five tabs returns 40px, which is
      // enough at every width the tabs are shown.
      "rounded-small px-2 py-2 text-body-medium font-medium lg:px-3",
      STATE_LAYER,
      id === current
        ? "text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full after:bg-primary"
        : "text-on-surface-variant",
    ].join(" ");

  return (
    <>
      {/* MD3's top app bar is level 0 at rest and level 2 once content scrolls
          beneath it: the elevation is what says the bar is in front of
          something, and at the top of the page there is nothing to be in front
          of. `data-scrolled` is on the element rather than only in the class
          list so an end-to-end spec can assert the state rather than the
          shadow — a computed `box-shadow` mid-transition reports the value it
          is leaving, which is the reading trap M2 recorded.

          The border stays in both states. Dropping it at rest is what MD3
          actually specifies, and it is a visible restyle of every page rather
          than an elevation, so it is not this phase's to make. */}
      <header
        data-scrolled={scrolled ? "true" : "false"}
        className={`sticky top-0 z-20 border-b border-outline-variant bg-surface/90 backdrop-blur transition ${
          scrolled ? "shadow-level-2" : "shadow-level-0"
        }`}
      >
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

          {/* MD3 puts trailing actions at the end of the top app bar. The
              account control sits before the theme toggle because it is the one
              that changes what the page says; the toggle changes how it looks.

              `shrink-0` on the pair: above `sm` the header already carries the
              brand block and five inline tabs inside `max-w-3xl`, and adding a
              second control eats slack that was measured for one. See the
              header-width spec — the bottom bar's fifth entry was clipped with
              no scroll to reveal it, and this is that failure one breakpoint up. */}
          <div className="flex shrink-0 items-center gap-1">
            {accountControl}
            <Button
              onClick={onToggleTheme}
              aria-label={themeToggleLabel(theme)}
              title={themeToggleLabel(theme)}
              /* Asks for the 40dp container the account control beside it
                 keeps — but `controlClasses` carries M9's `min-h-12`, and a
                 minimum beats a height, so this renders 48 and the `h-10` is
                 inert. Left in place deliberately: removing it would read as a
                 preference for 48, and the preference is the floor. Raising the
                 container back to 40 means giving the toggle its own drawn
                 target, the way `TOUCH_TARGET` does next door. */
              className="h-10"
            >
              <span aria-hidden="true">{theme === "light" ? "☽" : "☀"}</span>
            </Button>
          </div>
        </div>
      </header>

      <NavigationBar current={current} onSelect={select} />
    </>
  );
}
