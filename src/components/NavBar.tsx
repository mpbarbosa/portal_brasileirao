import type { ReactNode } from "react";

import { BrandMark } from "@/src/components/BrandMark";
import { Button } from "@/src/components/Button";
import { MoonIcon, SunIcon } from "@/src/components/SectionIcons";
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
 * Two presentations of one model. Above the `sm` breakpoint the destinations are
 * a row of MD3 primary tabs **beneath** the app bar's own row; below it they
 * move to a navigation bar pinned to the bottom of the screen. Both render from
 * `NAV_ITEMS`, so a section is reachable at every width and neither list can
 * drift from the other.
 *
 * The tabs shared the app bar's row until the arithmetic in the JSX below was
 * measured rather than assumed. They are still inside `<header>` — every spec
 * selects them as `header nav[aria-label="Seções"] a` — and only their line
 * changed.
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
      // `px-3` at every width, where this used to be `px-2` until `lg`.
      //
      // The padding was the thing that gave way while the tabs shared a line
      // with the brand and the trailing controls, and giving way was not enough
      // — see the note on the row below for the arithmetic. On a row of their
      // own the five tabs measure 481px against 608px at the narrowest width
      // they are shown, so there is no longer a shortage to spend the padding
      // on, and `px-3` is the same 12dp the label sat in at `lg` before.
      "rounded-small px-3 py-2 text-body-medium font-medium",
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
        <div className="mx-auto max-w-3xl px-4">
        <div className="flex items-center justify-between gap-3 py-3 sm:py-2">
          {/* The wordmark is a link home, which it was not — it was two `<p>`
              elements, so the one control every site on the web puts in this
              corner did nothing here. A reader on `/clube/palmeiras` had to
              find "Classificação" among the destinations to get back.

              `-mx-2 px-2` rather than bare padding: the veil needs room to sit
              in — `BACK_LINK` exists because a state layer with no padding hugs
              the glyphs — while the text itself must stay on the same left edge
              as the content column beneath it. The negative margin buys the one
              without moving the other, and 8px still leaves the row inside the
              container's own `px-4`. */}
          <a
            href="/"
            onClick={(event) => select(event, "classificacao")}
            data-brand
            className={`-mx-2 min-w-0 shrink rounded-small px-2 py-1 ${STATE_LAYER}`}
          >
            {/* The mark sits beside the *title line*, not beside the two-line
                block, and that is arithmetic rather than taste. Below `sm` the
                brand's widest line is the subtitle at 174px against 128px of
                title, and the whole block gets 202px at 375dp signed out — so
                a mark placed beside the block adds its own width to the widest
                line and pushes the subtitle under the Entrar pill. Measured: it
                overflowed its box by 3.6px and painted over the control.
                Beside the title it costs nothing, because 24 + 8 + 128 = 160 is
                still inside the 174 the subtitle already claims. Above `sm`
                there is no subtitle, so the two arrangements are the same
                element in the same place.

                `shrink-0` and a fixed size, never a percentage: this row's
                elastic member is the wordmark, and a logo that gave way under
                pressure would leave the app announcing itself with a sliver of
                an arch. 28px above `sm` against the 40dp trailing controls,
                24px below it.

                `text-primary` rather than `text-on-surface`: the mark is the
                one element on this bar that is the brand rather than a reading
                of it, and primary-as-ink is a pairing the contrast gate already
                measures against every surface this app paints text on. */}
            {/* `whitespace-nowrap` and no `truncate`: the app's own name is the
                one string on this bar that must never be cut, and it was —
                measured signed in at `ad8853c`, it read "Portal Brasile…" at
                1280 and "P…" at 640. See the row note below for why. */}
            <span className="flex items-center gap-2 whitespace-nowrap text-title-medium font-bold text-on-surface">
              <BrandMark className="size-6 shrink-0 text-primary sm:size-7" />
              Portal Brasileirão
            </span>
            {/* Below `sm` only, where the destinations are in the bottom bar and
                this row holds nothing but the brand and two 40dp controls — the
                subtitle measures 174px there against acres of room. Above `sm`
                the tab row underneath says what the app is for, and the full
                name survives in `<title>` and in the page's own `h1`. It was
                the first thing to truncate at every width. */}
            <span className="block whitespace-nowrap text-body-small text-ink-muted sm:hidden">
              Campeonato Brasileiro Série A
            </span>
          </a>

          {/* MD3 puts trailing actions at the end of the top app bar. The
              account control sits before the theme toggle because it is the one
              that changes what the page says; the toggle changes how it looks.

              `shrink-0` on the pair: they are the two fixed-width things in a
              row whose other member is elastic, and the brand is what gives. */}
          {/* `gap-2`, and the 2 is arithmetic rather than taste. Both controls
              here take a 48dp touch target from a 40dp box, so each overhangs
              4px; `gap-1` gave 4px of space to 8px of overhang and the two
              targets overlapped exactly that much. The toggle won all of it, so
              a press on the avatar's right edge changed the theme instead of
              opening the account, and the account control's effective target
              was 44px wide — under the floor the whole exercise was about.
              Measured on `37bb199`; asserted in `touch-targets.spec.ts`. */}
          <div className="flex shrink-0 items-center gap-2">
            {accountControl}
            <Button
              onClick={onToggleTheme}
              aria-label={themeToggleLabel(theme)}
              title={themeToggleLabel(theme)}
              /* `size="bar"` is MD3's 40dp top-app-bar control, which is what
                 levels this with the account control beside it — see the note on
                 `AccountButton`. It was `className="h-10"`, which could not win:
                 `controlClasses` set `min-h-12` for the touch target, and a
                 minimum beats a height whatever the class order. The target now
                 lives on a pseudo-element, so the box is free to be 40. */
              size="bar"
            >
              {/* Hand-drawn, in `currentColor`, like every other glyph here.
                  They were `☽` and `☀` — text glyphs, whose size and weight
                  belong to the font rather than to this app. Measured in the
                  shipped bundle: the crescent drew about a third the height of
                  the 24px icons beside it, so one control had two optical sizes
                  depending on which theme was on, in the one row of this app
                  that had been levelled to the pixel. */}
              {theme === "light" ? (
                <MoonIcon className="h-5 w-5" />
              ) : (
                <SunIcon className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* The destinations, on a row of their own above `sm`.
            ---------------------------------------------------
            They were inline with the brand and the trailing controls, and that
            row was over-subscribed rather than merely tight. Signed in at 640
            it had to hold 345px of tab labels, a 128px wordmark, a 108px
            account control and a 40px toggle inside 608px of content — so the
            brand was the flexible member and it collapsed to **27px**, reading
            "P…". At 1280 the same arithmetic left it 115px against 128px
            needed, so the app's own name was cut on a full desktop too.

            No padding, breakpoint or type step fixes that: the numbers do not
            fit, and every previous attempt spent the tabs' padding buying a few
            pixels back. MD3 does not put a five-destination tab row inside a
            top app bar either — **tabs are a component placed beneath one** —
            so this is the spec's arrangement as well as the one the arithmetic
            allows. The cost is 32px of sticky chrome above `sm`; below it the
            bottom navigation bar is unchanged and this row does not render.

            Left-aligned rather than stretched to fill: the indicator is an
            `after` inset from the tab's own padding, so an equal-width tab
            would draw a 131px rule under "Jogos". MD3's primary-tab indicator
            hugs its label, which is what content-sized tabs give for free. */}
        {/* `-ml-3` cancels the first tab's own `px-3`, so the first *label*
            starts on the same left edge as the wordmark above it rather than
            12px inside it — the two are both the leading edge of this bar, and
            an eye reads them as one column or as a mistake. The tab's state
            layer does extend those 12px further left, which is what a tab's
            container is supposed to do; 4px of the container's `px-4` is left
            over, so nothing overflows. */}
        <nav className="-ml-3 hidden gap-1 sm:flex" aria-label="Seções">
          {/* No `title` on the destinations — a tooltip never appears on touch,
              and it competes with the visible label for the accessible name,
              which breaks "click <label>" voice control. */}
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
        </div>
      </header>

      <NavigationBar current={current} onSelect={select} />
    </>
  );
}
