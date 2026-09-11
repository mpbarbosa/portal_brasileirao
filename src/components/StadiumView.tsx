import { wikipediaUrl } from "@/wikipedia-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { ClubPageLink } from "@/src/components/ClubPageLink";
import { ExternalLink } from "@/src/components/ExternalLink";
import { NotFoundScreen } from "@/src/components/NotFoundScreen";
import { GLYPH } from "@/src/components/glyph";
import { BACK_LINK, LINK_UNDERLINE } from "@/src/components/interaction";
import { MatchList } from "@/src/components/MatchList";
import { StadiumWeather } from "@/src/components/StadiumWeather";
import { StatTile } from "@/src/components/StatTile";
import { Surface } from "@/src/components/Surface";
import {
  capacityLabel,
  findStadium,
  stadiumLocation,
  stadiumMatches,
  stadiumPhotoPage,
  stadiumPhotoUrl,
  PHOTO_WIDTHS,
} from "@/venue-core";
import type { Club, Match, Stadium, StadiumPhoto } from "@/src/types";

interface StadiumViewProps {
  /** Slug, straight from the URL. */
  stadiumKey: string;
  /**
   * Every stadium the loaded fixtures name. Built by the caller, because the
   * derivation walks the whole season and the club page needs the same list.
   */
  stadiums: Stadium[];
  /** Whether the first load is still in flight. Without it an empty payload and
   *  an unknown stadium are indistinguishable, and the page picks the wrong
   *  one — the same trap `ClubView` and `MatchPage` document. */
  loading?: boolean;
  matches: Match[];
  clubs?: Club[];
  onBack: () => void;
  /** Omit to render fixtures as plain text — the page stands on its own. */
  onSelectMatch?: (id: string) => void;
  onSelectClub?: (key: string) => void;
}

/**
 * An outlined stadium: a bowl seen from the side. Local to this file for the
 * reason `ClubView` keeps its own marks — one call site — and drawn from
 * `GLYPH`, so it cannot drift from the marks beside every other link.
 *
 * It used to be called `WikipediaGlyph`, the name `ClubLinks` gives its open
 * book, while drawing a stadium and typing the attribute bag out by hand: two
 * glyphs under one name, and a third copy of the attributes.
 */
function StadiumGlyph() {
  return (
    <svg {...GLYPH}>
      <path d="M4 7h16" />
      <path d="M7 7v10" />
      <path d="M17 7v10" />
      <path d="M4 17h16" />
      <path d="M9 11h6" />
    </svg>
  );
}

/**
 * The ground itself.
 *
 * Local to this file, like `StadiumGlyph` above and for the same stated
 * reason: one call site. It moves into `src/components/` the day a second view
 * shows a stadium photograph, not before.
 *
 * The credit line is **not** optional chrome that a redesign may quietly drop.
 * Every licence in `stadiums.ts` except CC0 requires the photographer to be
 * named wherever the picture is shown, so the caption is a condition of
 * displaying the image at all — which is why it renders from required fields
 * rather than from optional ones that could be absent.
 *
 * `aspect-[16/9]` with `object-cover` fixes the box before the bytes arrive.
 * These files vary from 4:3 to a 4096×1808 panorama, and a container sized by
 * the image would reflow the whole page on load — the stat tiles, the mandantes
 * and the fixture list all sit below it.
 */
function StadiumPhotoFigure({ slug, photo }: { slug: string; photo: StadiumPhoto }) {
  return (
    <figure className="mt-4" data-stadium-photo={photo.file}>
      <Surface className="overflow-hidden">
        {/* Eager, unlike `ClubCrest`. That component defers twenty small crests
            inside a scrolling table; this is one large image at the top of the
            page, and deferring the element a reader is already looking at only
            delays the thing they came for. */}
        {/* Widths come from `PHOTO_WIDTHS` in venue-core rather than from a
            list here, because `sync-stadium-photos` writes exactly those files.
            A local list would let the page ask for a size nobody vendored,
            which fails as a missing image rather than as a build error. */}
        <img
          src={stadiumPhotoUrl(slug, PHOTO_WIDTHS[0])}
          srcSet={PHOTO_WIDTHS.map((w) => `${stadiumPhotoUrl(slug, w)} ${w}w`).join(", ")}
          sizes="(min-width: 768px) 736px, 100vw"
          alt={photo.alt}
          width={1472}
          height={828}
          decoding="async"
          className="aspect-[16/9] w-full object-cover"
        />
      </Surface>
      <figcaption className="mt-1.5 text-body-small text-ink-muted">
        Foto:{" "}
        <ExternalLink href={stadiumPhotoPage(photo)} suffix="a foto no Wikimedia Commons" className={LINK_UNDERLINE}>
          {photo.credit}
        </ExternalLink>
        {" · "}
        <ExternalLink href={photo.licenseUrl} suffix="a licença" className={LINK_UNDERLINE}>
          {photo.license}
        </ExternalLink>
        {" · via Wikimedia Commons"}
        {/* No stadium name here on purpose. The heading two elements up already
            gave it, and pt-BR would need the article agreed per ground — "da
            Arena MRV" but "do Maracanã" — which is a gender no field in
            `stadiums.ts` carries. */}
        <span className="sr-only"> (os links abrem em nova aba)</span>
      </figcaption>
    </figure>
  );
}

/**
 * One ground in full: where it is, how big it is, who calls it home, and every
 * fixture of the season played there.
 *
 * Reached from a match or a club rather than from the navigation bar. That is a
 * deliberate limit and not an oversight — MD3's bar carries three to five
 * destinations, four are spent, and a stadium is somewhere you arrive at from a
 * fixture rather than a section you set out to browse.
 *
 * Every field beyond the name and the location is optional, because they come
 * from a hand-maintained file and not from any provider. A stadium with nothing
 * curated still renders: CBF's own spelling as the heading, its city and state
 * beneath, and the fixture list. The stat tiles simply do not appear.
 */
export function StadiumView({
  stadiumKey,
  stadiums,
  loading = false,
  matches,
  clubs,
  onBack,
  onSelectMatch,
  onSelectClub,
}: StadiumViewProps) {
  const stadium = findStadium(stadiums, stadiumKey);

  if (!stadium) {
    return <NotFoundScreen onBack={onBack} loading={loading} missingText="Estádio não encontrado." />;
  }

  const fixtures = stadiumMatches(matches, stadium.slug);
  const capacity = capacityLabel(stadium);
  const article = wikipediaUrl(stadium.wikipedia);

  return (
    <>
      <button type="button" onClick={onBack} className={BACK_LINK}>
        ← Voltar
      </button>

      <header className="mt-3" data-stadium={stadium.slug}>
        <h2 className="text-title-large font-bold">{stadium.name}</h2>
        <p className="text-body-medium text-ink-muted">{stadiumLocation(stadium)}</p>
        {/* The formal name, only where it differs — nobody calls the Maracanã
            "Estádio Jornalista Mário Filho", but it is worth knowing that is
            what it is. */}
        {stadium.officialName && (
          <p className="text-body-small text-ink-faint">{stadium.officialName}</p>
        )}
        {article && (
          <p className="mt-0.5 text-body-medium">
            <ExternalLink href={article} suffix="artigo sobre o estádio" className={LINK_UNDERLINE}>
              <StadiumGlyph />
              Wikipédia
            </ExternalLink>
          </p>
        )}
      </header>

      {stadium.photo && <StadiumPhotoFigure slug={stadium.slug} photo={stadium.photo} />}

      {(capacity || stadium.opened !== undefined) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {capacity && <StatTile label="Capacidade" value={capacity} />}
          {stadium.opened !== undefined && (
            <StatTile label="Inaugurado" value={String(stadium.opened)} />
          )}
        </div>
      )}

      {stadium.homeClubs.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-2 text-body-medium font-medium text-ink-muted">
            {stadium.homeClubs.length === 1 ? "Mandante" : "Mandantes"}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {stadium.homeClubs.map((club) => (
              <Surface as="li" key={club.code} filled className="px-3 py-2">
                {onSelectClub ? (
                  <ClubPageLink club={club} onSelectClub={onSelectClub} className="flex items-center gap-2">
                    <ClubCrest club={club} />
                    {club.shortName}
                  </ClubPageLink>
                ) : (
                  <span className="flex items-center gap-2">
                    <ClubCrest club={club} />
                    {club.shortName}
                  </span>
                )}
              </Surface>
            ))}
          </ul>
        </section>
      )}

      <StadiumWeather slug={stadium.slug} />

      <section className="mt-6">
        <h3 className="mb-2 text-body-medium font-medium text-ink-muted">
          Jogos neste estádio
        </h3>
        <MatchList
          matches={fixtures}
          clubs={clubs}
          onSelectMatch={onSelectMatch}
          emptyLabel="Nenhum jogo registrado neste estádio."
        />
      </section>
    </>
  );
}
