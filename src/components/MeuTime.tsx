import { useMemo } from "react";

import { followLabel, type FollowState } from "@/preferences-core";
import { Button } from "@/src/components/Button";
import { ClubCrest } from "@/src/components/ClubCrest";
import { GLYPH } from "@/src/components/ClubLinks";
import { FOCUS_RING, STATE_LAYER } from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";
import { clubKey } from "@/club-core";
import { countdownLabel } from "@/live-core";
import { clubFocus, type ClubFocus, isHome, isImminent, opponentOf } from "@/next-match-core";
import { clubNamer, clubResolver } from "@/src/components/MatchList";
import { formatRoute } from "@/route-core";
import { useNow } from "@/src/useNow";
import type { Club, ClubCode, Match } from "@/src/types";

/**
 * How often the contagem regressiva is redrawn.
 *
 * The same 30 seconds the **Ao vivo** board ticks at, and the same reason:
 * `countdownLabel` has minute granularity, so a faster clock would redraw an
 * identical string. Deliberately *not* the sibling repo's one-second tick,
 * which exists there because its badge counts down in seconds.
 */
const TICK_MS = 30_000;

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
 * A modified click is the browser's, not ours.
 *
 * Middle-click and cmd/ctrl-click open a new tab, and swallowing them is how an
 * `<a href>` comes to behave worse than the plain link it replaced. Shared
 * within this file because the strip now carries two links — the club row and
 * the fixture line — and a second hand-written copy of the four modifier keys
 * is how one of them comes to swallow shift-click.
 */
const isPlainClick = (event: React.MouseEvent): boolean =>
  !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0;

/** The kickoff in the reader's own zone, as the fixture lists write it. */
const kickoffLabel = (kickoff: string): string => {
  const parsed = new Date(kickoff);
  if (Number.isNaN(parsed.getTime())) return "Horário a definir";

  return parsed.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/** The scoreline while it is still moving, or the separator before it exists. */
const score = (match: Match): string =>
  match.homeGoals === null || match.awayGoals === null
    ? "×"
    : `${match.homeGoals} × ${match.awayGoals}`;

/**
 * The **Próximo jogo do meu time** line inside the strip.
 *
 * Written from the followed club's side rather than as a neutral fixture row —
 * "contra o Vitória, fora de casa" is what somebody who follows a club wants,
 * where the Ao vivo board's job is to be even-handed about both sides. That is
 * the whole reason this is not a `MatchList` of one.
 *
 * Three things here are deliberate and each is a trap avoided:
 *
 * - **No `aria-live` on the contagem regressiva.** The clock ticks every 30
 *   seconds, so a polite live region would interrupt a screen-reader user twice
 *   a minute with a number they did not ask for and cannot act on. The sibling
 *   repo's badge does exactly that at a one-second tick. The label is read on
 *   demand like any other text.
 * - **The countdown comes from `live-core`**, not from a second formatter. The
 *   strip and the Ao vivo board say the same words about the same fixture, and
 *   a reader crossing between them meets one vocabulary.
 * - **Imminence changes the tone, never the wording.** A match tonight and a
 *   match in three weeks are the same sentence; only the rail brightens. Copy
 *   that shouted when a fixture was close would be a second thing to keep true.
 */
function ProximoJogo({
  focus,
  code,
  now,
  clubs,
  onSelectMatch,
}: {
  focus: ClubFocus;
  code: ClubCode;
  now: number;
  /**
   * The clubs the payload named — the list, not a prepared namer.
   *
   * The line needs two answers about each side now, its name and its crest, and
   * threading two callbacks from one call site is how they come to be built
   * from different lists. `clubNamer` and `clubResolver` share a fallback chain
   * precisely so both can be derived here from the one input.
   */
  clubs?: Club[];
  onSelectMatch?: (id: string) => void;
}) {
  if (focus.kind === "none") return null;

  const clubName = clubNamer(clubs);
  const clubOf = clubResolver(clubs);

  const { match } = focus;
  const home = clubOf(match.homeCode);
  const away = clubOf(match.awayCode);
  const playing = focus.kind === "playing";
  const urgent = isImminent(focus, now);

  const heading = playing ? "Bola rolando" : "Próximo jogo";
  const opponent = clubName(opponentOf(match, code));
  const where = isHome(match, code) ? "em casa" : "fora de casa";

  /**
   * What a screen reader hears as the link's name, in one sentence.
   *
   * The visible line is three fragments laid out for the eye — heading, sides,
   * date — and read in sequence they do not make a sentence. This does, and it
   * names the club's own side so the link is not simply "Atlético-MG × Vitória"
   * with no clue why it is on this page.
   */
  const spoken = playing
    ? `Bola rolando: ${clubName(match.homeCode)} ${score(match)} ${clubName(match.awayCode)}, ${where}.`
    : `Próximo jogo: contra o ${opponent}, ${where}, ${kickoffLabel(match.kickoff)}. ${countdownLabel(match.kickoff, now)}.`;

  const body = (
    <>
      {/* The one place the two states differ in colour: `primary` is what
          `StatusChip` already uses for a live match, so a reader meets the same
          signal here as on the fixture lists. */}
      <span
        className={`text-label-medium font-medium ${playing ? "text-primary" : "text-ink-muted"}`}
      >
        {heading}
      </span>
      {/* A flex row rather than a sentence with crests dropped into it, for two
          reasons a run of inline images would get wrong. An `<img>` sits on the
          text baseline, so a 20px mark beside a 16px word rides low and pushes
          the line box taller; `items-center` is what puts the two marks and the
          three words on one optical line. And the row shrinks *both* names
          under pressure instead of truncating the whole string, so a narrow
          screen loses the tail of each club rather than the away side and the
          scoreline entirely. The crest sits before the name on each side, the
          reading order a fixture is written in.

          The marks say nothing a reader does not already have: `ClubCrest` is
          `aria-hidden` by design, the visible body is `aria-hidden` here in any
          case, and `spoken` below is unchanged — the link's accessible name was
          already a sentence naming both clubs. */}
      <span className="flex items-center gap-1.5 font-medium text-on-surface">
        {home && <ClubCrest club={home} size={20} />}
        <span className="truncate">{clubName(match.homeCode)}</span>
        <span className="shrink-0 font-semibold tabular-nums text-on-surface-variant">
          {score(match)}
        </span>
        {away && <ClubCrest club={away} size={20} />}
        <span className="truncate">{clubName(match.awayCode)}</span>
      </span>
      <span className="block truncate text-body-small text-ink-faint">
        {playing ? where : `${kickoffLabel(match.kickoff)} · ${where}`}
      </span>
      {!playing && (
        <span className="block truncate text-body-small text-ink-muted">
          {countdownLabel(match.kickoff, now)}
        </span>
      )}
    </>
  );

  // The rail is the whole of the alert: `primary` while the fixture is near or
  // under way, `outline-variant` once it is merely on the calendar.
  const rail = urgent ? "border-primary" : "border-outline-variant";

  return (
    <div
      data-proximo-jogo={match.id}
      data-imminent={urgent ? "yes" : "no"}
      className={`mx-3 mb-2 border-l-2 pl-3 ${rail}`}
    >
      {onSelectMatch ? (
        <a
          href={formatRoute({ section: "partida", id: match.id })}
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            onSelectMatch(match.id);
          }}
          aria-label={spoken}
          className={`-mx-1 block rounded-x-small px-1 py-0.5 ${STATE_LAYER}`}
        >
          <span aria-hidden="true">{body}</span>
        </a>
      ) : (
        <p className={FOCUS_RING}>
          <span aria-hidden="true">{body}</span>
          <span className="sr-only">{spoken}</span>
        </p>
      )}
    </div>
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
  matches,
  clubs,
  loading = false,
  onSelectClub,
  onSelectMatch,
}: {
  state: FollowState;
  /**
   * The season's fixtures, for the **Próximo jogo** line.
   *
   * Optional, so the strip still stands where the caller has none to hand —
   * during the first load, or on a page that never fetched them. A missing next
   * match is an absence, exactly as a missing coach is on the club page: the
   * line is left out, and nothing claims the season is over.
   */
  matches?: Match[];
  /** The clubs that payload named, for resolving the opponent's own name. */
  clubs?: Club[];
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
  /** Omit and the fixture is named without being a link, on the same terms. */
  onSelectMatch?: (id: string) => void;
}) {
  /**
   * The clock lives here rather than in `App`, which is the same placement
   * `LiveView` uses and for a sharper reason: a tick in `App` would re-render
   * the whole Classificação — twenty rows and twenty sparklines — twice a
   * minute to move four words. `useNow` already tears the timer down while the
   * tab is hidden.
   *
   * Both hooks run before the early returns below, because they must: a
   * reader who follows nobody renders `null` from here, and a hook that ran
   * only on the other branch would change the hook order between renders.
   */
  const now = useNow(TICK_MS);
  const focus = useMemo(
    () => clubFocus(matches ?? [], state.kind === "following" ? state.club.code : null, now),
    [matches, state, now],
  );

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
   * The strip has exactly one thing to offer above the fixture line: the club's
   * page. It said so with an underline under a 72px word, in a band 736px wide
   * holding 190px of content, so 545px of it was inert and the target was the
   * smallest part of the largest element on the page. Crest included, since a
   * crest beside a club's name is the thing a reader reaches for first and it
   * was not part of the target at all.
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

  const row = "flex min-h-12 items-center gap-2 px-3 py-2";

  const clubHref = formatRoute({ section: "clube", key: clubKey(club) });
  const openClub = (event: React.MouseEvent) => {
    // Let modified clicks open a new tab, as any link should.
    if (!isPlainClick(event)) return;
    event.preventDefault();
    onSelectClub?.(clubKey(club));
  };

  /**
   * With no fixture to show, the panel **is** the link — exactly the shape the
   * row-wide target arrived as, unchanged.
   *
   * The fixture line cannot live inside that anchor: it points at the match
   * page, and an `<a>` inside an `<a>` is invalid markup that browsers repair
   * by closing the outer one early — the second link would work and the first
   * would silently stop covering the row. So when there is one, the panel goes
   * back to being a container and the club row becomes a row-wide anchor inside
   * it. The target stays the whole row either way, which is the property that
   * mattered; only which element carries the chrome moves.
   */
  if (focus.kind === "none") {
    if (!onSelectClub) {
      return (
        <Surface filled className={`mb-4 ${row}`} data-meu-time={club.code}>
          {contents}
        </Surface>
      );
    }

    return (
      <Surface
        as="a"
        filled
        href={clubHref}
        onClick={openClub}
        className={`mb-4 ${row} ${STATE_LAYER}`}
        data-meu-time={club.code}
      >
        {contents}
      </Surface>
    );
  }

  return (
    <Surface filled className="mb-4" data-meu-time={club.code}>
      {onSelectClub ? (
        // `rounded-t-small` so the state layer's veil follows the panel's own
        // corners instead of squaring them off at the top.
        <a href={clubHref} onClick={openClub} className={`${row} rounded-t-small ${STATE_LAYER}`}>
          {contents}
        </a>
      ) : (
        <div className={row}>{contents}</div>
      )}

      <ProximoJogo
        focus={focus}
        code={club.code}
        now={now}
        clubs={clubs}
        onSelectMatch={onSelectMatch}
      />
    </Surface>
  );
}
