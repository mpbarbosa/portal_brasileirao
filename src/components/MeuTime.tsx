import { followLabel, type FollowState } from "@/preferences-core";
import { Button } from "@/src/components/Button";
import { ClubCrest } from "@/src/components/ClubCrest";
import { GLYPH } from "@/src/components/ClubLinks";
import { STATE_LAYER } from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";
import { clubKey } from "@/club-core";
import { formatRoute } from "@/route-core";
import type { Club } from "@/src/types";

/**
 * The mark for **Meu time**, filled when the club is followed and outlined when
 * it is not — the same glyph in both states, so the control's meaning does not
 * change with it.
 *
 * It has two call sites, which is why it is exported rather than drawn twice:
 * the control on the club page, and the marker beside a name in the
 * Classificação. Two copies of a path is how one of them comes to be a
 * different star.
 */
export function StarGlyph({ filled = false, className }: { filled?: boolean; className?: string }) {
  return (
    <svg {...GLYPH} className={className ?? GLYPH.className} fill={filled ? "currentColor" : "none"}>
      <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z" />
    </svg>
  );
}

/**
 * Follow this club, or stop.
 *
 * The label carries the club's name rather than saying "Seguir" beside it,
 * because the control is read out on its own by a screen reader and "Seguir"
 * alone does not say what. On a narrow screen the name is hidden visually and
 * kept for assistive tech — the star and the page's own heading already say
 * which club, to a reader who can see them.
 */
export function FollowButton({
  club,
  following,
  onToggle,
}: {
  club: Club;
  following: boolean;
  onToggle: () => void;
}) {
  const label = followLabel(club, following);

  return (
    <Button
      size="sm"
      variant={following ? "tonal" : "outlined"}
      onClick={onToggle}
      aria-pressed={following}
      title={label}
      data-follow={following ? "following" : "not-following"}
      className="shrink-0"
    >
      <StarGlyph filled={following} />
      <span className="hidden sm:inline">{following ? "Meu time" : "Seguir"}</span>
      <span className="sr-only">{label}</span>
    </Button>
  );
}

/**
 * The **Meu time** strip above the Classificação.
 *
 * Renders **nothing at all** when the reader follows nobody, and that is the
 * whole design rather than an unhandled case. `docs/accounts.md` states that
 * guests are first class: a permanent "escolha o seu time" band on the home
 * page for everyone who has not chosen is a nag, and a nag is the soft end of
 * the same thing a sign-in wall is. The control that starts this is on the club
 * page, where somebody is already looking at a club.
 *
 * The unresolved state is the one worth reading. A followed club that the
 * current payload does not name — the list has not landed, or came back empty
 * during an incident — says so plainly and keeps the preference. It never
 * silently reverts to "you follow nobody", which would invite the reader to
 * choose again and overwrite a choice that was never lost.
 */
export function MeuTimeStrip({
  state,
  loading = false,
  onSelectClub,
}: {
  state: FollowState;
  /**
   * Whether the club list is still in flight.
   *
   * Without this the strip announces "não foi possível carregar o seu time"
   * for the length of the first request, every single load — a failure message
   * standing in for a wait. `followState` cannot tell the two apart and should
   * not try: it is pure, it has no clock, and "still loading" is a fact about
   * the fetch rather than about the preference.
   */
  loading?: boolean;
  /** Omit and the club is named without being a link — the strip still stands. */
  onSelectClub?: (key: string) => void;
}) {
  if (state.kind === "none") return null;

  if (state.kind === "unresolved") {
    if (loading) return null;
    return (
      <Surface filled className="mb-4 px-3 py-2">
        <p className="text-body-small text-ink-muted">
          Não foi possível carregar o seu time agora. A sua escolha continua guardada.
        </p>
      </Surface>
    );
  }

  const { club } = state;

  /**
   * One row, and — where the strip can navigate — **one link that is the whole
   * row** rather than a link on the name inside it.
   *
   * The strip has exactly one thing to offer: the club's page. It said so with
   * an underline under a 72px word, in a band 736px wide holding 190px of
   * content, so 545px of it was inert and the target was the smallest part of
   * the largest element on the page. Crest included, since a crest beside a
   * club's name is the thing a reader reaches for first and it was not part of
   * the target at all.
   *
   * `min-h-12` is the touch-target floor, and it applies here where it does not
   * apply to the twenty club names in the table below: this is a standalone
   * control on its own line, not a link inside content — the same distinction
   * `BACK_LINK` draws, and the exclusion `tabs-and-targets.spec.ts` names.
   */
  const contents = (
    <>
      <StarGlyph filled className="h-4 w-4 shrink-0 text-primary" />
      <span className="shrink-0 text-label-large text-ink-muted">Meu time</span>
      <ClubCrest club={club} size={24} />
      <span className="truncate font-medium text-on-surface">{club.shortName}</span>
      {/* The chevron is what makes the empty right-hand side read as *the rest
          of a link* rather than as a band that ran out of things to say. It
          also does the job the underline used to do, now that the underline
          would be sitting under one word of a row-wide target. */}
      {onSelectClub && (
        <svg {...GLYPH} className="ml-auto h-5 w-5 shrink-0 text-ink-muted">
          <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
        </svg>
      )}
    </>
  );

  const shared = "mb-4 flex min-h-12 items-center gap-2 px-3 py-2";

  if (!onSelectClub) {
    return (
      <Surface filled className={shared} data-meu-time={club.code}>
        {contents}
      </Surface>
    );
  }

  return (
    <Surface
      as="a"
      filled
      href={formatRoute({ section: "clube", key: clubKey(club) })}
      onClick={(event: React.MouseEvent) => {
        // Let modified clicks open a new tab, as any link should.
        if (
          event.metaKey || event.ctrlKey || event.shiftKey ||
          event.altKey || event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        onSelectClub(clubKey(club));
      }}
      className={`${shared} ${STATE_LAYER}`}
      data-meu-time={club.code}
    >
      {contents}
    </Surface>
  );
}
