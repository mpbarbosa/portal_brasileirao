import { ageOn } from "@/player-core";
import { ClubCrest } from "@/src/components/ClubCrest";
import { LINK_UNDERLINE, STATE_LAYER } from "@/src/components/interaction";
import { Surface } from "@/src/components/Surface";
import { clubKey } from "@/club-core";
import { playerPositionLabel, squadSections, totalPlayers } from "@/squad-core";
import type { Club, Player, Squad } from "@/src/types";

interface PlayersViewProps {
  squads: Squad[];
  loading: boolean;
  /** Opens the player card. Omit to render plain names. */
  onSelectPlayer?: (player: Player) => void;
  onSelectClub?: (key: string) => void;
}

/** Whole years, or nothing — an age is a detail, never a reason for a blank. */
const ageLabel = (player: Player, now: Date): string | null => {
  const age = ageOn(player.dateOfBirth, now);
  return age === null ? null : `${age} anos`;
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

function SquadPlayer({
  player,
  club,
  now,
  onSelectPlayer,
}: {
  player: Player;
  club: Club;
  now: Date;
  onSelectPlayer?: (player: Player) => void;
}) {
  const position = playerPositionLabel(player);
  const age = ageLabel(player, now);
  // One line, both details, so a row is the same height whether or not the
  // provider bothered with either.
  const caption = [position, age].filter(Boolean).join(" · ");

  return (
    <li className="py-1">
      {/* The underline is on the name alone, as in the Artilharia table: run
          through the caption too it reads as one two-line link rather than a
          name with a note under it. */}
      {onSelectPlayer ? (
        <button
          type="button"
          /* The club is attached here rather than carried on every entry in
             the payload: it is the squad this player is listed under, and the
             card wants it filled in the moment it opens. */
          onClick={() => onSelectPlayer({ ...player, club })}
          className={`block rounded-x-small text-left font-medium ${LINK_UNDERLINE}`}
        >
          {player.name}
        </button>
      ) : (
        <span className="block font-medium">{player.name}</span>
      )}
      {caption && <span className="block text-body-small text-ink-faint">{caption}</span>}
    </li>
  );
}

/**
 * One club, as a native `<details>`.
 *
 * Closed by default, and that is the whole layout decision. The division fields
 * roughly a thousand players; rendered flat and open, the second club begins
 * some twenty screens below the first, so the by-club structure the page is
 * *for* becomes invisible the moment you scroll. Closed, the page is a
 * twenty-row index with a squad one keystroke away.
 *
 * `<details>` rather than a button and a piece of state: it gives the disclosure
 * semantics, the keyboard behaviour and the `aria-expanded` announcement for
 * free, and — the reason it beats a picker — it lets a reader open two clubs at
 * once to compare them.
 */
function SquadPanel({
  squad,
  now,
  onSelectPlayer,
  onSelectClub,
}: {
  squad: Squad;
  now: Date;
  onSelectPlayer?: (player: Player) => void;
  onSelectClub?: (key: string) => void;
}) {
  const sections = squadSections(squad.players);
  const key = clubKey(squad.club);

  return (
    <Surface as="li" filled data-squad={key}>
      <details>
        {/* The disclosure mark is the browser's own `::marker`, not a glyph of
            ours. Two Tailwind spellings of a rotating chevron —
            `group-open:rotate-90` and an arbitrary `[details[open]_&]` variant —
            both compiled to a rule that *matches* the element and still left
            `rotate` computing to 0deg in the page; measured, not assumed. The
            native marker rotates for free, is what the platform draws
            everywhere else, and cannot fail to compile.

            Hence the inner `<span>` for the flex row: `display: flex` on a
            `summary` removes the marker in Chrome, which is the trap that makes
            people reach for a hand-drawn chevron in the first place. */}
        {/* `text-ink` rather than inheriting it, because every other
            `STATE_LAYER` call site names its colour and one that does not is
            the odd one out the next person has to reason about. It is the
            convention, not a fix: measured across a real theme toggle, the
            inherited value re-resolved correctly on its own. */}
        <summary
          className={`cursor-pointer rounded-small px-3 py-3 text-ink marker:text-ink-muted ${STATE_LAYER}`}
        >
          {/* A heading, not a styled span: it puts the club into the document
              outline between the page's h2 and each line's h4, so the elencos
              are navigable by heading rather than only by eye. The width leaves
              room for the marker the summary now draws — Chrome lays that
              marker out *inline*, so the heading has to be narrower than the
              line or it wraps beneath it and the club name ends up on a second
              row. 1rem was not enough; measured, the marker and its gap take
              closer to 1.5rem. */}
          <h3 className="inline-flex w-[calc(100%-1.5rem)] items-center gap-2 align-middle text-body-medium font-semibold">
            <ClubCrest club={squad.club} size={24} />
            <span>{squad.club.shortName}</span>
            <span className="ml-auto text-body-small font-normal text-ink-faint">
              {squad.players.length === 0
                ? "elenco não informado"
                : plural(squad.players.length, "jogador", "jogadores")}
            </span>
          </h3>
        </summary>

        <div className="border-t border-line px-3 py-3">
          {sections.length === 0 ? (
            <p className="text-body-small text-ink-muted">
              O provedor não lista o elenco deste clube.
            </p>
          ) : (
            <>
              {onSelectClub && (
                <p className="mb-3">
                  <button
                    type="button"
                    onClick={() => onSelectClub(key)}
                    className={`rounded-x-small text-body-small ${LINK_UNDERLINE}`}
                  >
                    Ver a página do {squad.club.shortName}
                  </button>
                </p>
              )}

              {sections.map((section) => (
                <section key={section.line} className="mb-3 last:mb-0">
                  <h4 className="mb-1 text-label-medium uppercase text-ink-muted">
                    {section.label}
                  </h4>
                  <ul className="grid gap-x-4 sm:grid-cols-2">
                    {section.players.map((player) => (
                      <SquadPlayer
                        key={player.id}
                        player={player}
                        club={squad.club}
                        now={now}
                        onSelectPlayer={onSelectPlayer}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </>
          )}
        </div>
      </details>
    </Surface>
  );
}

/**
 * **Jogadores** — every club's elenco, grouped by club and then by line.
 *
 * The one page in the app backed by its own endpoint rather than by the fixture
 * payload: a squad is not derivable from anything already loaded, unlike the
 * campanha or the stadium list. It is a single upstream request for all twenty
 * clubs, so it costs the same as one of them.
 */
export function PlayersView({ squads, loading, onSelectPlayer, onSelectClub }: PlayersViewProps) {
  if (loading && squads.length === 0) {
    return <p className="text-body-medium text-ink-muted">Carregando os elencos…</p>;
  }

  if (squads.length === 0) {
    return <p className="text-body-medium text-ink-muted">Elencos indisponíveis no momento.</p>;
  }

  // Read once per render rather than per row: a page of a thousand players
  // would otherwise construct a thousand Dates that all mean the same instant.
  const now = new Date();

  return (
    <>
      <h2 className="mb-1 text-body-medium font-medium text-ink-muted">Jogadores</h2>
      <p className="mb-3 text-body-small text-ink-faint">
        {plural(totalPlayers(squads), "jogador", "jogadores")} em{" "}
        {plural(squads.length, "clube", "clubes")}. Escolha um clube para ver o elenco.
      </p>

      <ul className="grid gap-2">
        {squads.map((squad) => (
          <SquadPanel
            key={squad.club.code}
            squad={squad}
            now={now}
            onSelectPlayer={onSelectPlayer}
            onSelectClub={onSelectClub}
          />
        ))}
      </ul>
    </>
  );
}
