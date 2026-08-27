import { followLabel, type FollowState } from "@/preferences-core";
import { Button } from "@/src/components/Button";
import { ClubCrest } from "@/src/components/ClubCrest";
import { GLYPH } from "@/src/components/ClubLinks";
import { LINK_UNDERLINE } from "@/src/components/interaction";
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

  return (
    <Surface filled className="mb-4 flex items-center gap-2 px-3 py-2" data-meu-time={club.code}>
      <StarGlyph filled className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-label-large text-ink-muted">Meu time</span>
      <ClubCrest club={club} size={20} />
      {onSelectClub ? (
        <a
          href={formatRoute({ section: "clube", key: clubKey(club) })}
          onClick={(event) => {
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
          className={`truncate rounded-x-small font-medium text-ink ${LINK_UNDERLINE}`}
        >
          {club.shortName}
        </a>
      ) : (
        <span className="truncate font-medium text-ink">{club.shortName}</span>
      )}
    </Surface>
  );
}
