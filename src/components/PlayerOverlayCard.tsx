import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  ageOn,
  birthDateLabel,
  mergePlayer,
  playerInstagram,
  PLAYER_PHOTO_WIDTHS,
  playerPhotoPage,
  playerPhotoUrl,
  playerSearchUrls,
  playerSofascore,
  positionLabel,
} from "@/player-core";
import { Button } from "@/src/components/Button";
import { GLYPH, InstagramLink, WikipediaLink } from "@/src/components/ClubLinks";
import { LINK_UNDERLINE } from "@/src/components/interaction";
import { PLAYER_INSTAGRAM } from "@/src/data/player-instagram";
import { PLAYER_PHOTOS } from "@/src/data/player-photos";
import { PLAYER_SOFASCORE } from "@/src/data/player-sofascore";
import { PLAYER_WIKIPEDIA } from "@/src/data/player-wikipedia";
import type { Player, Scorer } from "@/src/types";

interface PlayerOverlayCardProps {
  /** What the caller already knows — the card renders immediately from this. */
  player: Player;
  /** Season figures, when the player was opened from a scoring table. */
  scorer?: Scorer;
  onClose: () => void;
}

/**
 * One number, sized to be read across the card.
 *
 * The card holds two kinds of fact and they want different shapes. A **number**
 * — a shirt, an age, a goal tally — is what a reader scans for, and it earns the
 * accent and the size. A **word** — a position, a nationality — is read once, and
 * set at the same weight it competes with the numbers and the card turns into a
 * wall of equal-looking values, which is what it was.
 *
 * So numbers go in tiles and words go in `Row` below. The rule is the one thing
 * to keep if this is ever restyled: it is what gives the card a first thing to
 * look at.
 *
 * `flex-col-reverse` puts the value above its label on the page while leaving
 * `dt` before `dd` in the markup, because a description list means nothing to a
 * screen reader in the other order.
 */
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col-reverse border-l-2 border-primary pl-3">
      <dt className="text-label-small uppercase text-ink-faint">{label}</dt>
      <dd className="truncate text-headline-small font-bold tabular-nums text-primary">
        {value}
      </dd>
    </div>
  );
}

/** A word, read once: label left, value right, on a hairline. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
      <dt className="shrink-0 text-label-medium uppercase text-ink-faint">{label}</dt>
      <dd className="truncate text-body-medium font-medium">{value}</dd>
    </div>
  );
}

/** The caption over a group of links or figures. */
function GroupLabel({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-label-medium uppercase text-ink-faint">{children}</h3>;
}

/** A magnifier: the plain web search. */
function SearchGlyph() {
  return (
    <svg {...GLYPH}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

/** A folded newspaper: the same query, restricted to news. */
function NewsGlyph() {
  return (
    <svg {...GLYPH}>
      <path d="M4 5h13v14H5a1 1 0 0 1-1-1z" />
      <path d="M17 9h3v8a2 2 0 0 1-3 1.7" />
      <path d="M7 9h7M7 13h7M7 16h4" />
    </svg>
  );
}

/**
 * A search for the player, on someone else's site.
 *
 * Local rather than in `ClubLinks` because it has one caller, which is the rule
 * that file states — the Wikipédia anchor moved out the moment the match page
 * became its second. It is one component used twice rather than two anchors, so
 * `target`, `rel` and the screen-reader suffix are written once: a second copy
 * missing `rel="noopener"` is a real defect that looks identical on the page.
 */
function SearchLink({
  href,
  label,
  suffix,
  children,
}: {
  href: string;
  label: string;
  suffix: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK_UNDERLINE}>
      {children}
      {label}
      <span className="sr-only"> — {suffix} (abre em nova aba)</span>
    </a>
  );
}

/**
 * A bar chart rather than Sofascore's own wordmark, and drawn here rather than
 * in `ClubLinks`.
 *
 * The mark first: a wordmark is artwork with a fixed form and a fixed colour,
 * so it could not take `currentColor` and would sit cold beside the two links
 * it shares a row with — the same argument `ClubLinks` makes for preferring
 * Instagram's outline to Meta's gradient. Three rising bars say "statistics",
 * which is what the destination is for.
 *
 * The place second: `ClubLinks` holds the links a *club* carries, and a mark
 * moves there when it gains a second call site. This one has one and no club
 * has a Sofascore page, so it stays local exactly as the search and news marks
 * below it do. It still takes `GLYPH` from there, so it cannot drift from the
 * marks printed beside it — that is the part that must not be copied.
 */
function SofascoreGlyph() {
  return (
    <svg {...GLYPH}>
      <path d="M5 20V13" />
      <path d="M12 20V8" />
      <path d="M19 20V4" />
    </svg>
  );
}

/**
 * The player's Sofascore profile, or nothing when none is recorded.
 *
 * Reads as the host, like the Wikipédia link beside it and for the same reason:
 * the stored value is a seven-digit id and nobody scanning a row of links is
 * looking for one. No `subject` argument, because unlike `InstagramLink` and
 * `WikipediaLink` this has a single caller and no club counterpart to be
 * confused with — the suffix can simply say what it is.
 */
function SofascoreLink({ href }: { href: string | null }) {
  if (!href) return null;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`truncate ${LINK_UNDERLINE}`}>
      <SofascoreGlyph />
      Sofascore
      <span className="sr-only"> — estatísticas do jogador (abre em nova aba)</span>
    </a>
  );
}

const countOrDash = (value: number | null | undefined) =>
  value === null || value === undefined ? "—" : String(value);

/**
 * Modal card for one player.
 *
 * It renders from data the caller already holds, then fills in shirt number,
 * position, nationality and birth date from `/api/players/:id`. That request is
 * an enrichment, not a dependency: if it fails or the app is offline, the card
 * still shows everything the page already knew.
 *
 * **Almost every field here is optional, and that is the design constraint.**
 * The competition's team payload carries no shirt number for anyone in the
 * division, so `Camisa` and the watermark exist only once the person endpoint
 * has answered; the artilharia knows a name and four tallies and nothing else.
 * Every block below therefore renders or does not, and nothing renders a dash
 * standing in for a value that was never reported — which is why the card is
 * built from lists of what is present rather than from a fixed grid with holes
 * in it.
 */
export function PlayerOverlayCard({ player, scorer, onClose }: PlayerOverlayCardProps) {
  const [enriched, setEnriched] = useState<Player>(player);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setEnriched(player);

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/players/${encodeURIComponent(player.id)}`);
        if (!response.ok) return;
        const body = (await response.json()) as { data: Player | null };
        if (!cancelled) setEnriched((current) => mergePlayer(current, body.data));
      } catch {
        // Enrichment is optional — the card is already useful without it.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [player]);

  /**
   * Open as a *modal* dialog rather than rendering a fixed overlay.
   *
   * `showModal` is what buys the behaviour this card was missing. Before M4 it
   * looked modal and was not: Tab walked straight out of it into the page
   * behind, which is still there and still focusable. The browser's own modality
   * gives four things at once — a focus trap, `inert` on everything behind, the
   * top layer (so no ancestor's `overflow` can clip it), and focus returned to
   * whatever opened it when it closes. Each is fiddly to hand-roll and easy to
   * get subtly wrong.
   *
   * Escape arrives as `cancel`, not `keydown`, so it is handled below rather
   * than through a document listener.
   */
  useEffect(() => {
    const node = dialogRef.current;
    if (!node || node.open) return;
    node.showModal();
    // The dismiss, not the card: opening on the first *control* means Escape
    // and Enter both do something sensible without a further keystroke.
    closeRef.current?.focus();
  }, []);

  // A modal dialog makes the page inert but does not stop it scrolling behind.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const age = ageOn(enriched.dateOfBirth, new Date());
  const born = birthDateLabel(enriched.dateOfBirth);
  const position = positionLabel(enriched.position);
  /**
   * The club the *page* knows, ahead of the one the enrichment reports.
   *
   * `/api/players/:id` answers with football-data's `currentTeam`, and for an
   * international that is frequently the **national team**: opened from the
   * Corinthians elenco, Memphis Depay's card read "Netherlands" under his name
   * and "Netherlands" again as his nationality. Verified on a live payload —
   * `currentTeam.tla` is `NED`.
   *
   * Whoever opened the card already knows better. `PlayersView` attaches the
   * club whose elenco the player was listed in, and a scorer carries the club
   * they scored for; both are Série A clubs by construction, which is the only
   * kind this app is about. The enrichment is the last resort rather than the
   * first, and `mergePlayer` is left alone — it is right for every other field,
   * and a card that knows the answer should not have to be told.
   */
  const club = player.club ?? scorer?.club ?? enriched.club;

  /**
   * Curated data, keyed by the id the card was opened with rather than by the
   * enriched copy: the enrichment can only confirm the id, never change it, and
   * reading it from `player` means the links are there on first paint instead of
   * appearing a moment later.
   */
  const instagram = playerInstagram(player.id, PLAYER_INSTAGRAM);
  const wikipedia = PLAYER_WIKIPEDIA[player.id];
  const sofascore = playerSofascore(player.id, PLAYER_SOFASCORE);
  const photo = PLAYER_PHOTOS[player.id];
  const search = playerSearchUrls(enriched.name, club?.shortName);

  // Numbers get tiles, words get rows — see `Tile`. Both are filtered rather
  // than rendered with placeholders, because an absent value is not a zero.
  const tiles: Array<{ label: string; value: string }> = [
    ...(enriched.shirtNumber !== undefined
      ? [{ label: "Camisa", value: String(enriched.shirtNumber) }]
      : []),
    /* The bare number, not "32 anos" — an age is in years and the label has
       already said which figure this is. Set at the headline step the unit is
       nearly half the width of the grid on a phone, which pushes the tile
       beside it off the row. */
    ...(age !== null ? [{ label: "Idade", value: String(age) }] : []),
  ];

  const rows: Array<{ label: string; value: string }> = [
    ...(position !== null ? [{ label: "Posição", value: position }] : []),
    ...(enriched.nationality ? [{ label: "Nacionalidade", value: enriched.nationality }] : []),
    ...(born !== null ? [{ label: "Nascimento", value: born }] : []),
  ];

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="jogador-nome"
      // Escape reaches a modal dialog as `cancel`. Prevented so the close runs
      // through React rather than the browser tearing the element out from
      // under it, which would leave the parent still thinking it is open.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the backdrop lands on the dialog element itself, because the
      // backdrop is its pseudo-element. Anything inside the card has the inner
      // wrapper as its target. Using mousedown, not click, so a drag that starts
      // on the card and ends outside does not dismiss.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      // MD3 puts a dialog at its largest corner. The card is rebuilt here, so it
      // takes the shape MD3 gives it; controls elsewhere kept their own.
      // `mt-auto` bottoms it on a phone and `sm:m-auto` centres it above that,
      // reproducing the sheet-then-card behaviour the fixed overlay had.
      // `mt-auto mb-4` bottoms it on a phone with the inset the fixed overlay's
      // `p-4` used to give — flush to the edge would hide the bottom corners the
      // shape scale just widened. `sm:my-auto` centres it vertically above that.
      //
      // `mx-auto` is not redundant with the user agent's `dialog { margin: auto }`:
      // Tailwind's preflight resets `margin: 0` on every element, so relying on
      // the UA rule left the dialog hard against the left edge on desktop while
      // vertical centring worked, because only the vertical margins were set here.
      //
      // `max-h`/`overflow-y-auto` are load-bearing rather than defensive: with a
      // photograph, both link groups and a scorer's figures, a card for a
      // well-covered player is taller than a phone. Without them the top layer
      // simply clips it and the credit at the foot — which the licence requires
      // — becomes unreachable. `dvh` rather than `vh` because a mobile browser's
      // address bar is inside `vh` and outside the screen.
      //
      // Padding lives on the two inner blocks, not here, so the header band's
      // rule can run the full width of the card.
      className="mx-auto mt-auto mb-4 flex max-h-[88dvh] w-full max-w-lg flex-col overflow-y-auto rounded-x-large border border-line-strong bg-surface-container-low text-ink shadow-xl backdrop:bg-scrim/70 backdrop:backdrop-blur-sm sm:my-auto"
    >
      <header className="relative overflow-hidden border-b border-line px-5 py-4">
        {enriched.shirtNumber !== undefined && (
          /* The shirt, once, very large and nearly invisible — the one piece of
             decoration on the card. It is not a second copy of the `Camisa`
             tile competing with it: at this size and this opacity it reads as
             the card's ground rather than as a value, which is exactly why it
             can carry a number that is also printed below.

             Absent for every player until the person endpoint answers, because
             the competition's team payload carries no shirt number at all — so
             this is invisible in the frozen snapshot and present on the live
             site. `aria-hidden` because the tile already says it. */
          <span
            aria-hidden="true"
            /* Bottom-right, not top-right: the close button lives up there, and
               a 57px numeral behind it reads as a rendering fault rather than
               as a ground. Clipped by the header's `overflow-hidden`, which is
               what keeps it from setting the card's height. */
            className="pointer-events-none absolute -bottom-5 right-3 select-none text-display-large font-black leading-none tabular-nums text-primary/10"
          >
            {enriched.shirtNumber}
          </span>
        )}

        <div className="relative flex items-start gap-4">
          {photo && (
            /* Square and cropped rather than letterboxed: these arrive at
               whatever shape their photographer framed, mostly portrait, and a
               row of cards should not shift about. `object-top` because a
               head-and-shoulders portrait keeps the face high in the frame —
               centring the crop cuts foreheads. */
            <img
              src={playerPhotoUrl(player.id, PLAYER_PHOTO_WIDTHS[0])}
              srcSet={PLAYER_PHOTO_WIDTHS.map((w) => `${playerPhotoUrl(player.id, w)} ${w}w`).join(", ")}
              sizes="64px"
              alt={photo.alt}
              width={64}
              height={64}
              decoding="async"
              className="size-16 shrink-0 rounded-medium border border-line object-cover object-top"
            />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-label-small uppercase text-ink-faint">Jogador</p>
            <h2 id="jogador-nome" className="truncate text-headline-small font-bold">
              {enriched.name}
            </h2>
            {club && <p className="truncate text-body-medium text-ink-muted">{club.shortName}</p>}
          </div>

          <Button ref={closeRef} size="sm" onClick={onClose} aria-label="Fechar" className="shrink-0">
            <span aria-hidden="true">✕</span>
          </Button>
        </div>
      </header>

      {/* `space-y` rather than a `mt-*` on each block: every one of these is
          conditional, so a margin belonging to the block would leave a gap
          above whichever happened to be first. The artilharia card, which
          renders none of the identity blocks, opened with exactly that. */}
      <div className="space-y-5 px-5 py-4">
        {tiles.length > 0 && (
          <dl className="grid grid-cols-3 gap-3">
            {tiles.map((tile) => (
              <Tile key={tile.label} {...tile} />
            ))}
          </dl>
        )}

        {rows.length > 0 && (
          /* The hairline above the first row is the section's own, so the block
             reads as a list whether or not there are tiles above it. */
          <dl className="border-t border-line">
            {rows.map((row) => (
              <Row key={row.label} {...row} />
            ))}
          </dl>
        )}

        {scorer && (
          <section>
            <GroupLabel>No campeonato</GroupLabel>
            {/* Four figures, and the reason the card was opened from the
                artilharia at all — so they take the same tiles as the identity
                numbers rather than the small grey treatment they had. */}
            <dl className="grid grid-cols-4 gap-3">
              <Tile label="Gols" value={String(scorer.goals)} />
              <Tile label="Assist." value={countOrDash(scorer.assists)} />
              <Tile label="Pênaltis" value={countOrDash(scorer.penalties)} />
              <Tile label="Jogos" value={countOrDash(scorer.playedMatches)} />
            </dl>
          </section>
        )}

        {(instagram || wikipedia || sofascore) && (
          /* Curated, so present for a minority of the division. A reader with
             none of the three recorded gets no section at all rather than a
             heading over nothing — an absent link is not a missing value. */
          <section>
            <GroupLabel>Onde acompanhar</GroupLabel>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-medium">
              <InstagramLink handle={instagram} subject="do jogador" />
              <WikipediaLink title={wikipedia} subject="do jogador" />
              <SofascoreLink href={sofascore} />
            </div>
          </section>
        )}

        {/* Derived from the name, so unlike everything above it this is here for
            all ~950 players rather than for the handful with a curated entry. It
            is also the honest answer to what the card cannot hold: the app knows
            a position and a birth date, and a reader who opened the card usually
            wanted today's news. */}
        <section>
          <GroupLabel>Pesquisar na web</GroupLabel>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-medium">
            <SearchLink href={search.google} label="Google" suffix="pesquisa sobre o jogador">
              <SearchGlyph />
            </SearchLink>
            <SearchLink href={search.news} label="Notícias" suffix="notícias sobre o jogador">
              <NewsGlyph />
            </SearchLink>
          </div>
        </section>

        {photo && (
          /* Not optional chrome a redesign may quietly drop: every licence in
             `player-photos.ts` except CC0 requires the photographer to be named
             wherever the picture appears, and vendoring the bytes made this app
             the publisher of its copy. If the credit goes, the photograph has
             to go with it.

             At the foot of the card rather than under the image, because the
             image is 64px in a header row and a two-line credit beside it would
             crowd the player's name off the card on a phone. */
          <p className="border-t border-line pt-4 text-body-small text-ink-faint">
            Foto:{" "}
            <a
              href={playerPhotoPage(photo)}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_UNDERLINE}
            >
              {photo.credit}
            </a>
            {" · "}
            <a
              href={photo.licenseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={LINK_UNDERLINE}
            >
              {photo.license}
            </a>
            {" · via Wikimedia Commons"}
          </p>
        )}
      </div>
    </dialog>
  );
}
